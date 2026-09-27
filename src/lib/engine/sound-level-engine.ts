import { designWeighting, tickCascade, type Biquad } from "../dsp/filters.ts";
import {
  ExpMeanSquare,
  LeqAccumulator,
  PeakHold,
  dbFromMeanSquare,
  dbFromPeak,
} from "../dsp/metrics.ts";
import { FftAnalyzer, foldThirdOctave, type BandLevel } from "../dsp/spectrum.ts";
import { stampFrom, type TimeStamp } from "../evidence/time.ts";
import type {
  DemoKind,
  DeviceHeader,
  EngineStatus,
  FftSize,
  GeoStamp,
  IncidentMeta,
  IncidentRecord,
  IncidentSummary,
  MeterFrame,
  SessionEvent,
  SourceMode,
  SpectrumFrame,
} from "./types.ts";

export type EngineOptions = {
  sampleRate?: number;
  fftSize?: FftSize;
  calOffsetDb?: number;
  sourceLabel?: string;
  timeZone?: string;
  installationIdSha256?: string;
  userAgent?: string;
  modelLabel?: string;
};

type BandAcc = { sum: number; n: number };

function emptyAcc(n: number): BandAcc[] {
  return Array.from({ length: n }, () => ({ sum: 0, n: 0 }));
}

function accToBands(centers: number[], acc: BandAcc[], offset: number): BandLevel[] {
  return acc.map((a, i) => ({
    fc: centers[i] ?? 0,
    db: 10 * Math.log10(a.n > 0 ? a.sum / a.n : 1e-20) + offset,
  }));
}

const BLOCK = 1920;

export class SoundLevelEngine {
  private fs: number;
  private fftSize: FftSize;
  private offset: number;
  private sourceLabel: string;
  private mode: SourceMode = "idle";
  private demoKind: DemoKind | null = null;
  private timeZone: string;
  private installationIdSha256: string;
  private userAgent: string;
  private modelLabel: string;
  private inputDeviceId: string | null = null;

  private a: Biquad[] = [];
  private c: Biquad[] = [];
  private z: Biquad[] = [];
  private fastA = new ExpMeanSquare("fast", 48_000);
  private slowA = new ExpMeanSquare("slow", 48_000);
  private fastC = new ExpMeanSquare("fast", 48_000);
  private slowC = new ExpMeanSquare("slow", 48_000);
  private fastZ = new ExpMeanSquare("fast", 48_000);
  private leqA = new LeqAccumulator();
  private leqC = new LeqAccumulator();
  private peakA = new PeakHold();
  private peakC = new PeakHold();

  private fftA: FftAnalyzer;
  private fftC: FftAnalyzer;
  private fftZ: FftAnalyzer;
  private readonly pendA: number[] = [];
  private readonly pendC: number[] = [];
  private readonly pendZ: number[] = [];
  private spectrum: SpectrumFrame | null = null;
  private specColumns: number[][] = [];
  private specColor: "z" | "c" = "c";
  private specCursorMark = 0;

  private sampleCursor = 0;
  private nextRowAt = 0;
  private clipLatchUntil = 0;
  private clippedNow = false;

  private sessionId: string | null = null;
  private sessionEvents: SessionEvent[] = [];
  private incident: IncidentRecord | null = null;
  private lastIncident: IncidentRecord | null = null;

  private incFastAmax = 0;
  private incSlowAmax = 0;
  private incFastCmax = 0;
  private incSlowCmax = 0;
  private incFastAmin = Infinity;
  private incFastCmin = Infinity;
  private incPeakA = 0;
  private incPeakC = 0;
  private incClipRows = 0;
  private incOctA: BandAcc[] = [];
  private incOctC: BandAcc[] = [];
  private incOctCenters: number[] = [];
  private settled = 0;

  private baselineSamplesLeft = 0;
  private baselineLeqA = new LeqAccumulator();
  private baselineLeqC = new LeqAccumulator();
  private baselineStarted: TimeStamp | null = null;
  private baselineTargetSec = 0;

  private demoPhase = 0;
  private listeners = new Set<(frame: MeterFrame, status: EngineStatus) => void>();

  constructor(opts: EngineOptions = {}) {
    this.fs = opts.sampleRate ?? 48_000;
    this.fftSize = opts.fftSize ?? 4096;
    this.offset = opts.calOffsetDb ?? 0;
    this.sourceLabel = opts.sourceLabel ?? "idle";
    this.timeZone = opts.timeZone ?? "UTC";
    this.installationIdSha256 = opts.installationIdSha256 ?? "";
    this.userAgent = opts.userAgent ?? "";
    this.modelLabel = opts.modelLabel ?? "browser";
    this.retune(this.fs);
    this.fftA = new FftAnalyzer(this.fftSize, 0.5);
    this.fftC = new FftAnalyzer(this.fftSize, 0.5);
    this.fftZ = new FftAnalyzer(this.fftSize, 0.5);
  }

  private retune(fs: number): void {
    this.fs = fs;
    this.a = designWeighting("A", fs);
    this.c = designWeighting("C", fs);
    this.z = designWeighting("Z", fs);
    this.fastA = new ExpMeanSquare("fast", fs);
    this.slowA = new ExpMeanSquare("slow", fs);
    this.fastC = new ExpMeanSquare("fast", fs);
    this.slowC = new ExpMeanSquare("slow", fs);
    this.fastZ = new ExpMeanSquare("fast", fs);
    this.leqA.reset();
    this.leqC.reset();
    this.peakA.reset();
    this.peakC.reset();
    this.sampleCursor = 0;
    this.nextRowAt = Math.round(fs / 8);
  }

  setIdentity(hash: string, userAgent: string, modelLabel: string, timeZone?: string): void {
    this.installationIdSha256 = hash;
    this.userAgent = userAgent;
    this.modelLabel = modelLabel;
    if (timeZone) this.timeZone = timeZone;
  }

  setCalibrationOffsetDb(offset: number): void {
    const next = Math.max(-20, Math.min(20, offset));
    if (next === this.offset) return;
    this.offset = next;
    this.pushEvent("cal-change", `offset ${next.toFixed(1)} dB`);
  }

  resetPeakHold(): void {
    this.peakA.reset();
    this.peakC.reset();
  }

  setFftSize(size: FftSize): void {
    if (size === this.fftSize) return;
    this.fftSize = size;
    this.fftA = new FftAnalyzer(size, 0.5);
    this.fftC = new FftAnalyzer(size, 0.5);
    this.fftZ = new FftAnalyzer(size, 0.5);
    this.pendA.length = 0;
    this.pendC.length = 0;
    this.pendZ.length = 0;
  }

  setSpectrogramColor(color: "z" | "c"): void {
    this.specColor = color;
  }

  setSourceMeta(mode: SourceMode, label: string, demoKind: DemoKind | null, deviceId: string | null): void {
    const changed = mode !== this.mode || label !== this.sourceLabel || deviceId !== this.inputDeviceId;
    this.mode = mode;
    this.sourceLabel = label;
    this.demoKind = demoKind;
    this.inputDeviceId = deviceId;
    if (changed && this.sessionId) this.pushEvent("source-change", label);
  }

  setSampleRate(fs: number): void {
    if (fs === this.fs) return;
    this.retune(fs);
    this.fftA.reset();
    this.fftC.reset();
    this.fftZ.reset();
  }

  subscribe(fn: (frame: MeterFrame, status: EngineStatus) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    if (this.listeners.size === 0) return;
    const frame = this.frame(this.nowStamp());
    const status = this.status();
    for (const fn of this.listeners) fn(frame, status);
  }

  status(): EngineStatus {
    return {
      running: this.mode !== "idle",
      mode: this.mode,
      demoKind: this.demoKind,
      sourceLabel: this.sourceLabel,
      sampleRate: this.fs,
      calOffsetDb: this.offset,
      sessionId: this.sessionId,
      incidentId: this.incident?.id ?? null,
      incidentStartedEpochMs: this.incident?.startedAt.epochMs ?? null,
      baselineRemainingSec: this.baselineSamplesLeft > 0 ? this.baselineSamplesLeft / this.fs : 0,
      clippedLatch: this.clippedNow,
    };
  }

  getSpectrum(): SpectrumFrame | null {
    return this.spectrum;
  }

  getSpectrogram(): { centers: number[]; columns: number[][] } {
    const bands = (this.specColor === "c" ? this.spectrum?.c : this.spectrum?.z) ?? [];
    return {
      centers: bands.map((b) => b.fc).filter((fc) => fc <= 2000),
      columns: this.specColumns,
    };
  }

  private lastUiEmit = 0;

  /** Feed already-captured PCM. `epochMs` is the timestamp of the first sample. */
  pushSamples(samples: Float32Array | Float64Array, epochMs: number, monotonicMs: number): void {
    const fs = this.fs;
    const a = this.a;
    const c = this.c;
    const zf = this.z;
    let clipped = false;
    const pendA = this.pendA;
    const pendC = this.pendC;
    const pendZ = this.pendZ;
    const rowEvery = Math.round(fs / 8);
    const logging = this.incident !== null;

    for (let i = 0; i < samples.length; i++) {
      const x = samples[i]!;
      if (Math.abs(x) >= 0.98) {
        clipped = true;
        this.clippedNow = true;
        this.clipLatchUntil = epochMs + ((i + 1) / fs) * 1000 + 800;
      }
      const ya = tickCascade(a, x);
      const yc = tickCascade(c, x);
      const yz = tickCascade(zf, x);
      const msFa = this.fastA.push(ya);
      const msSa = this.slowA.push(ya);
      const msFc = this.fastC.push(yc);
      const msSc = this.slowC.push(yc);
      this.fastZ.push(yz);
      const inBaseline = this.baselineSamplesLeft > 0;
      if (!inBaseline) {
        this.leqA.push(ya);
        this.leqC.push(yc);
        this.peakA.push(ya);
        this.peakC.push(yc);
        if (logging) {
          if (msFa > this.incFastAmax) this.incFastAmax = msFa;
          if (msSa > this.incSlowAmax) this.incSlowAmax = msSa;
          if (msFc > this.incFastCmax) this.incFastCmax = msFc;
          if (msSc > this.incSlowCmax) this.incSlowCmax = msSc;
          if (this.settled > fs * 0.2) {
            if (msFa < this.incFastAmin) this.incFastAmin = msFa;
            if (msFc < this.incFastCmin) this.incFastCmin = msFc;
          }
          if (Math.abs(ya) > this.incPeakA) this.incPeakA = Math.abs(ya);
          if (Math.abs(yc) > this.incPeakC) this.incPeakC = Math.abs(yc);
          this.settled++;
        }
      } else {
        this.baselineLeqA.push(ya);
        this.baselineLeqC.push(yc);
        this.baselineSamplesLeft--;
        if (this.baselineSamplesLeft === 0) this.finishBaseline(epochMs + (i / fs) * 1000, monotonicMs + (i / fs) * 1000);
      }
      pendA.push(ya);
      pendC.push(yc);
      pendZ.push(yz);
      this.sampleCursor++;
      if (logging && this.sampleCursor >= this.nextRowAt) {
        this.nextRowAt += rowEvery;
        const rowEpoch = epochMs + (i / fs) * 1000;
        const row = this.frame(stampFrom(rowEpoch, monotonicMs + (i / fs) * 1000, this.timeZone));
        if (row.clipped) this.incClipRows++;
        this.incident!.samples.push(row);
        if (this.incident!.samples.length > 8 * 60 * 60 * 4) {
          this.incident!.samples.splice(0, rowEvery);
        }
      }
    }

    if (clipped) {
      this.clipLatchUntil = epochMs + samples.length * (1000 / fs) + 800;
      this.clippedNow = true;
    } else if (epochMs > this.clipLatchUntil) {
      this.clippedNow = false;
    }

    const flush = (buf: number[], analyzer: FftAnalyzer, which: "a" | "c" | "z") => {
      if (buf.length < 256 && which !== "z") return;
      const block = new Float64Array(buf);
      buf.length = 0;
      analyzer.push(block, fs, (spec) => {
        if (which === "a") this.onHopA(spec.binMs, fs);
        else if (which === "c") this.onHopC(spec.binMs, fs);
        else this.onHopZ(spec.binMs, fs);
      });
    };
    // Keep analyzers in lockstep: only flush when all three have the same count.
    const n = Math.min(pendA.length, pendC.length, pendZ.length);
    if (n >= 1024) {
      flush(pendA.splice(0, n), this.fftA, "a");
      flush(pendC.splice(0, n), this.fftC, "c");
      flush(pendZ.splice(0, n), this.fftZ, "z");
    }

    if (logging && this.incident && this.listeners.size === 0) {
      /* headless */
    }
  }

  /** One demo/mic block at `epochMs` for the block start, then notify UI. */
  pumpBlock(samples: Float32Array | Float64Array, epochMs: number, monotonicMs: number): MeterFrame {
    this.pushSamples(samples, epochMs, monotonicMs);
    const endEpoch = epochMs + (samples.length / this.fs) * 1000;
    const frame = this.frame(stampFrom(endEpoch, monotonicMs, this.timeZone));
    if (samples.length > 0 && endEpoch - this.lastUiEmit < 90) return frame;
    this.lastUiEmit = endEpoch;
    const status = this.status();
    for (const fn of this.listeners) fn(frame, status);
    return frame;
  }

  makeDemoBlock(kind: DemoKind): Float32Array {
    const out = new Float32Array(BLOCK);
    const fs = this.fs;
    let p = this.demoPhase;
    for (let i = 0; i < BLOCK; i++) {
      const t = p / fs;
      if (kind === "tone1k") out[i] = 0.5 * Math.sin(2 * Math.PI * 1000 * t);
      else if (kind === "bass") {
        out[i] =
          0.4 * Math.sin(2 * Math.PI * 55 * t) +
          0.15 * Math.sin(2 * Math.PI * 110 * t) +
          0.03 * Math.sin(2 * Math.PI * 1000 * t);
      } else {
        const n = ((p * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
        out[i] = 0.03 * (n * 2 - 1) + 0.04 * Math.sin(2 * Math.PI * 187 * t);
      }
      p++;
    }
    this.demoPhase = p;
    return out;
  }

  private onHopA(binMs: Float64Array, fs: number): void {
    const bands = foldThirdOctave(binMs, fs, 0);
    if (!this.spectrum) {
      this.spectrum = {
        binHz: fs / this.fftSize,
        fftSize: this.fftSize,
        a: bands.map((b) => ({ ...b, db: b.db + this.offset })),
        c: [],
        z: [],
      };
    } else {
      this.spectrum.a = bands.map((b) => ({ ...b, db: b.db + this.offset }));
      this.spectrum.binHz = fs / this.fftSize;
      this.spectrum.fftSize = this.fftSize;
    }
    if (this.incident) {
      if (this.incOctCenters.length === 0) this.incOctCenters = bands.map((b) => b.fc);
      if (this.incOctA.length !== bands.length) this.incOctA = emptyAcc(bands.length);
      for (let i = 0; i < bands.length; i++) {
        const ms = Math.pow(10, bands[i]!.db / 10);
        this.incOctA[i]!.sum += ms;
        this.incOctA[i]!.n += 1;
      }
    }
  }

  private onHopC(binMs: Float64Array, fs: number): void {
    const bands = foldThirdOctave(binMs, fs, 0);
    if (!this.spectrum) return;
    this.spectrum.c = bands.map((b) => ({ ...b, db: b.db + this.offset }));
    if (this.incident) {
      if (this.incOctC.length !== bands.length) this.incOctC = emptyAcc(bands.length);
      for (let i = 0; i < bands.length; i++) {
        const ms = Math.pow(10, bands[i]!.db / 10);
        this.incOctC[i]!.sum += ms;
        this.incOctC[i]!.n += 1;
      }
    }
  }

  private onHopZ(binMs: Float64Array, fs: number): void {
    const bands = foldThirdOctave(binMs, fs, 0, 2000);
    if (this.spectrum) {
      this.spectrum.z = bands.map((b) => ({ ...b, db: b.db + this.offset }));
    }
    if (this.sampleCursor - this.specCursorMark < this.fs / 4) return;
    this.specCursorMark = this.sampleCursor;
    const colored =
      this.specColor === "c" && this.spectrum?.c.length
        ? this.spectrum.c
        : bands.map((b) => ({ ...b, db: b.db + this.offset }));
    const col = colored.filter((b) => b.fc <= 2000).map((b) => b.db);
    this.specColumns.push(col);
    const maxCols = 120 * 4;
    if (this.specColumns.length > maxCols) this.specColumns.splice(0, this.specColumns.length - maxCols);
  }

  private frame(at: TimeStamp): MeterFrame {
    const off = this.offset;
    const laf = dbFromMeanSquare(this.fastA.ms, off);
    const lcf = dbFromMeanSquare(this.fastC.ms, off);
    return {
      tEpochMs: at.epochMs,
      tIso: at.iso,
      tMonotonicMs: at.monotonicMs,
      timeZone: at.timeZone,
      laf,
      las: dbFromMeanSquare(this.slowA.ms, off),
      lcf,
      lcs: dbFromMeanSquare(this.slowC.ms, off),
      lzf: dbFromMeanSquare(this.fastZ.ms, off),
      laeq: dbFromMeanSquare(this.leqA.meanSquare, off),
      lceq: dbFromMeanSquare(this.leqC.meanSquare, off),
      lapeak: dbFromPeak(this.peakA.peak, off),
      lcpeak: dbFromPeak(this.peakC.peak, off),
      lcMinusLa: lcf - laf,
      clipped: this.clippedNow,
      sourceLabel: this.sourceLabel,
      calOffsetDb: off,
    };
  }

  private nowStamp(): TimeStamp {
    return stampFrom(Date.now(), Date.now(), this.timeZone);
  }

  private device(): DeviceHeader {
    return {
      installationIdSha256: this.installationIdSha256,
      userAgent: this.userAgent,
      modelLabel: this.modelLabel,
      sampleRate: this.fs,
      calOffsetDb: this.offset,
      sourceLabel: this.sourceLabel,
      sourceMode: this.mode,
      demoKind: this.demoKind,
      fftSize: this.fftSize,
      inputDeviceId: this.inputDeviceId,
      autoTime: "unknown-browser-clock",
      clockNote:
        "Browser clock. DecibelLog cannot read Settings.Global.AUTO_TIME. If this device clock is set manually, timestamps follow that clock.",
    };
  }

  private pushEvent(kind: SessionEvent["kind"], detail: string): void {
    const ev: SessionEvent = { kind, at: this.nowStamp(), detail };
    this.sessionEvents.push(ev);
    if (this.incident) this.incident.events.push(ev);
  }

  startSession(): string {
    if (this.sessionId) return this.sessionId;
    this.sessionId = `ses_${Math.random().toString(36).slice(2, 10)}`;
    this.sessionEvents = [];
    this.leqA.reset();
    this.leqC.reset();
    this.peakA.reset();
    this.peakC.reset();
    this.pushEvent("session-start", this.sourceLabel);
    this.emit();
    return this.sessionId;
  }

  stopSession(): void {
    if (this.incident) this.stopIncident();
    if (!this.sessionId) return;
    this.pushEvent("session-stop", "stopped");
    this.sessionId = null;
    this.emit();
  }

  startIncident(meta: IncidentMeta, location: GeoStamp = null, levelsOnly = true): IncidentRecord {
    if (!this.sessionId) this.startSession();
    if (this.incident) this.stopIncident();
    const id = `inc_${Math.random().toString(36).slice(2, 10)}`;
    this.incFastAmax = 0;
    this.incSlowAmax = 0;
    this.incFastCmax = 0;
    this.incSlowCmax = 0;
    this.incFastAmin = Infinity;
    this.incFastCmin = Infinity;
    this.incPeakA = 0;
    this.incPeakC = 0;
    this.incClipRows = 0;
    this.incOctA = [];
    this.incOctC = [];
    this.incOctCenters = [];
    this.settled = 0;
    this.nextRowAt = this.sampleCursor + Math.round(this.fs / 8);
    this.leqA.reset();
    this.leqC.reset();
    this.peakA.reset();
    this.peakC.reset();
    const started = this.nowStamp();
    this.incident = {
      id,
      sessionId: this.sessionId!,
      meta: { ...meta },
      startedAt: started,
      endedAt: null,
      summary: null,
      samples: [],
      baseline: null,
      events: [...this.sessionEvents],
      device: this.device(),
      location,
      levelsOnly,
    };
    this.pushEvent("incident-start", meta.noiseType);
    this.emit();
    return this.incident;
  }

  stopIncident(): IncidentRecord | null {
    const inc = this.incident;
    if (!inc) return this.lastIncident;
    const ended = this.nowStamp();
    inc.endedAt = ended;
    inc.device = this.device();
    const off = this.offset;
    const durationSec = Math.max(0, (ended.epochMs - inc.startedAt.epochMs) / 1000);
    const summary: IncidentSummary = {
      durationSec,
      laeq: dbFromMeanSquare(this.leqA.meanSquare, off),
      lceq: dbFromMeanSquare(this.leqC.meanSquare, off),
      lafMax: dbFromMeanSquare(this.incFastAmax, off),
      lcfMax: dbFromMeanSquare(this.incFastCmax, off),
      lasMax: dbFromMeanSquare(this.incSlowAmax, off),
      lcsMax: dbFromMeanSquare(this.incSlowCmax, off),
      lafMin: Number.isFinite(this.incFastAmin) ? dbFromMeanSquare(this.incFastAmin, off) : dbFromMeanSquare(0, off),
      lcfMin: Number.isFinite(this.incFastCmin) ? dbFromMeanSquare(this.incFastCmin, off) : dbFromMeanSquare(0, off),
      laPeak: dbFromPeak(this.incPeakA, off),
      lcPeak: dbFromPeak(this.incPeakC, off),
      lcMinusLa: dbFromMeanSquare(this.leqC.meanSquare, 0) - dbFromMeanSquare(this.leqA.meanSquare, 0),
      clippedRows: this.incClipRows,
      octave: {
        a: accToBands(this.incOctCenters, this.incOctA, off),
        c: accToBands(this.incOctCenters, this.incOctC, off),
      },
    };
    inc.summary = summary;
    this.pushEvent("incident-end", `${durationSec.toFixed(1)} s`);
    this.incident = null;
    this.lastIncident = inc;
    this.emit();
    return inc;
  }

  captureBaseline(seconds = 45): void {
    const target = this.incident ?? this.lastIncident;
    if (!target) return;
    this.baselineTargetSec = seconds;
    this.baselineSamplesLeft = Math.round(seconds * this.fs);
    this.baselineLeqA.reset();
    this.baselineLeqC.reset();
    this.baselineStarted = this.nowStamp();
    this.pushEvent("baseline-start", `${seconds}s`);
    this.emit();
  }

  private finishBaseline(epochMs: number, monotonicMs: number): void {
    const target = this.incident ?? this.lastIncident;
    const started = this.baselineStarted;
    if (!target || !started) return;
    const ended = stampFrom(epochMs, monotonicMs, this.timeZone);
    target.baseline = {
      seconds: this.baselineTargetSec,
      startedAt: started,
      endedAt: ended,
      laeq: dbFromMeanSquare(this.baselineLeqA.meanSquare, this.offset),
      lceq: dbFromMeanSquare(this.baselineLeqC.meanSquare, this.offset),
    };
    const ev: SessionEvent = {
      kind: "baseline-end",
      at: ended,
      detail: `LAeq ${target.baseline.laeq.toFixed(1)}`,
    };
    this.sessionEvents.push(ev);
    target.events.push(ev);
    this.emit();
  }

  noteDropout(gapMs: number): void {
    if (this.sessionId) this.pushEvent("dropout", `${Math.round(gapMs)} ms gap`);
  }

  get activeIncident(): IncidentRecord | null {
    return this.incident;
  }

  get recentIncident(): IncidentRecord | null {
    return this.lastIncident ?? this.incident;
  }
}

export function sineBlock(freq: number, fs: number, n: number, amp = 1, phase0 = 0): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin(phase0 + (2 * Math.PI * freq * i) / fs);
  return out;
}

/** Run `seconds` of a steady sine through a fresh engine. Returns the last meter frame. */
export function measureSine(freq: number, seconds: number, amp = 1, offset = 0): MeterFrame {
  const fs = 48_000;
  const engine = new SoundLevelEngine({ sampleRate: fs, calOffsetDb: offset, fftSize: 4096 });
  engine.setSourceMeta("demo", "sine", "tone1k", null);
  const chunk = 4096;
  const total = Math.round(seconds * fs);
  let phase = 0;
  for (let done = 0; done < total; done += chunk) {
    const n = Math.min(chunk, total - done);
    const block = sineBlock(freq, fs, n, amp, phase);
    phase += (2 * Math.PI * freq * n) / fs;
    engine.pushSamples(block, done * (1000 / fs), done * (1000 / fs));
  }
  return engine.pumpBlock(new Float32Array(0), total * (1000 / fs), total * (1000 / fs));
}
