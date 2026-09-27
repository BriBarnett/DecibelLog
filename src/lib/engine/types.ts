import type { BandLevel } from "../dsp/spectrum.ts";
import type { TimeStamp } from "../evidence/time.ts";

export type DemoKind = "bass" | "room" | "tone1k";
export type SourceMode = "idle" | "demo" | "mic";
export type NoiseType =
  | "music"
  | "bass"
  | "barking"
  | "impact"
  | "traffic"
  | "mechanical"
  | "other";
export type WindowState = "open" | "closed" | "unknown";
export type Direction =
  | "above"
  | "below"
  | "adjacent"
  | "street"
  | "inside"
  | "unknown";

export type FftSize = 4096 | 8192 | 16384;

export type IncidentMeta = {
  name: string;
  address: string;
  room: string;
  windows: WindowState;
  direction: Direction;
  noiseType: NoiseType;
  note: string;
};

export type MeterFrame = {
  tEpochMs: number;
  tIso: string;
  tMonotonicMs: number;
  timeZone: string;
  laf: number;
  las: number;
  lcf: number;
  lcs: number;
  lzf: number;
  laeq: number;
  lceq: number;
  lapeak: number;
  lcpeak: number;
  lcMinusLa: number;
  clipped: boolean;
  sourceLabel: string;
  calOffsetDb: number;
};

export type MeterRow = MeterFrame;

export type SpectrumFrame = {
  binHz: number;
  fftSize: FftSize;
  a: BandLevel[];
  c: BandLevel[];
  z: BandLevel[];
};

export type SessionEvent = {
  kind:
    | "session-start"
    | "session-stop"
    | "incident-start"
    | "incident-end"
    | "baseline-start"
    | "baseline-end"
    | "cal-change"
    | "source-change"
    | "dropout";
  at: TimeStamp;
  detail: string;
};

export type OctaveSnapshot = { a: BandLevel[]; c: BandLevel[] };

export type BaselineSummary = {
  seconds: number;
  startedAt: TimeStamp;
  endedAt: TimeStamp;
  laeq: number;
  lceq: number;
};

export type IncidentSummary = {
  durationSec: number;
  laeq: number;
  lceq: number;
  lafMax: number;
  lcfMax: number;
  lasMax: number;
  lcsMax: number;
  lafMin: number;
  lcfMin: number;
  laPeak: number;
  lcPeak: number;
  lcMinusLa: number;
  clippedRows: number;
  octave: OctaveSnapshot;
};

export type GeoStamp = { lat: number; lon: number; accuracyM: number } | null;

export type DeviceHeader = {
  installationIdSha256: string;
  userAgent: string;
  modelLabel: string;
  sampleRate: number;
  calOffsetDb: number;
  sourceLabel: string;
  sourceMode: SourceMode;
  demoKind: DemoKind | null;
  fftSize: FftSize;
  inputDeviceId: string | null;
  /** Browser stand-in for Settings.Global.AUTO_TIME — always unknown here. */
  autoTime: "unknown-browser-clock";
  clockNote: string;
};

export type IncidentRecord = {
  id: string;
  sessionId: string;
  meta: IncidentMeta;
  startedAt: TimeStamp;
  endedAt: TimeStamp | null;
  summary: IncidentSummary | null;
  samples: MeterRow[];
  baseline: BaselineSummary | null;
  events: SessionEvent[];
  device: DeviceHeader;
  location: GeoStamp;
  levelsOnly: boolean;
};

export type EngineStatus = {
  running: boolean;
  mode: SourceMode;
  demoKind: DemoKind | null;
  sourceLabel: string;
  sampleRate: number;
  calOffsetDb: number;
  sessionId: string | null;
  incidentId: string | null;
  incidentStartedEpochMs: number | null;
  baselineRemainingSec: number;
  clippedLatch: boolean;
};

export const EMPTY_META: IncidentMeta = {
  name: "",
  address: "",
  room: "",
  windows: "unknown",
  direction: "unknown",
  noiseType: "bass",
  note: "",
};
