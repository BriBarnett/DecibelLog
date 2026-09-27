import { sha256Hex } from "../evidence/sha.ts";
import { SoundLevelEngine } from "./sound-level-engine.ts";
import type { DemoKind, FftSize } from "./types.ts";

let engine: SoundLevelEngine | null = null;
let demoTimer: ReturnType<typeof setInterval> | null = null;
let audioCtx: AudioContext | null = null;
let micStream: MediaStream | null = null;
let lastTick = 0;
let retainAudio = false;
const wavChunks: Float32Array[] = [];
let wavCount = 0;
let wavCapped = false;

export function getEngine(): SoundLevelEngine {
  if (!engine) {
    const zone =
      typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
    engine = new SoundLevelEngine({
      sampleRate: 48_000,
      fftSize: 4096,
      timeZone: zone || "UTC",
      modelLabel: "browser",
    });
  }
  return engine;
}

async function installationHash(): Promise<string> {
  const key = "decibellog-install";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return sha256Hex(new TextEncoder().encode(id));
}

export async function bootEngine(opts: { calOffsetDb: number; fftSize: FftSize; specColor: "c" | "z" }): Promise<void> {
  const eng = getEngine();
  const hash = await installationHash();
  eng.setIdentity(hash, navigator.userAgent, "browser", Intl.DateTimeFormat().resolvedOptions().timeZone);
  eng.setCalibrationOffsetDb(opts.calOffsetDb);
  eng.setFftSize(opts.fftSize);
  eng.setSpectrogramColor(opts.specColor);
}

export function setRetainAudio(on: boolean): void {
  retainAudio = on;
  if (!on) clearWav();
}

export function wasWavCapped(): boolean {
  return wavCapped;
}

export function clearWav(): void {
  wavChunks.length = 0;
  wavCount = 0;
  wavCapped = false;
}

const wavBlobs = new Map<string, Uint8Array>();

export function rememberWav(id: string, wav: Uint8Array | null): void {
  if (wav && wav.length > 44) wavBlobs.set(id, wav);
}

export function recallWav(id: string): Uint8Array | null {
  return wavBlobs.get(id) ?? null;
}

export function takeWav(): Float32Array | null {
  if (wavCount === 0) return null;
  const out = new Float32Array(wavCount);
  let o = 0;
  for (const chunk of wavChunks) {
    out.set(chunk, o);
    o += chunk.length;
  }
  clearWav();
  return out;
}

function keepWav(samples: Float32Array, sampleRate: number, incidentId: string | null): void {
  if (!retainAudio || !incidentId) return;
  const cap = sampleRate * 60;
  if (wavCount >= cap) {
    wavCapped = true;
    return;
  }
  const n = Math.min(samples.length, cap - wavCount);
  wavChunks.push(samples.slice(0, n));
  wavCount += n;
  if (wavCount >= cap) wavCapped = true;
}

function stopDemoTimer(): void {
  if (demoTimer) {
    clearInterval(demoTimer);
    demoTimer = null;
  }
}

export async function stopMic(): Promise<void> {
  micStream?.getTracks().forEach((t) => t.stop());
  micStream = null;
  if (audioCtx) {
    await audioCtx.close().catch(() => undefined);
    audioCtx = null;
  }
}

export function startDemo(kind: DemoKind): void {
  void stopMic();
  stopDemoTimer();
  const eng = getEngine();
  eng.setSampleRate(48_000);
  const label = kind === "bass" ? "Demo · bass-heavy" : kind === "tone1k" ? "Demo · 1 kHz tone" : "Demo · room noise";
  eng.setSourceMeta("demo", label, kind, null);
  lastTick = performance.now();
  demoTimer = setInterval(() => {
    const now = performance.now();
    const gap = now - lastTick;
    if (gap > 200) eng.noteDropout(gap);
    lastTick = now;
    const block = eng.makeDemoBlock(kind);
    const statusBefore = eng.status().incidentId;
    eng.pumpBlock(block, Date.now(), performance.timeOrigin + now);
    keepWav(block, 48_000, statusBefore);
  }, 40);
}

export async function startMic(deviceId: string | null): Promise<string> {
  stopDemoTimer();
  await stopMic();
  const eng = getEngine();
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser has no microphone API.");
  }
  const base: MediaTrackConstraints = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 1,
  };
  if (deviceId) base.deviceId = { exact: deviceId };
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: base });
  } catch {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
    });
  }
  micStream = stream;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new Error("AudioContext is missing.");
  const ctx = new Ctx({ sampleRate: 48_000 });
  audioCtx = ctx;
  if (ctx.state === "suspended") await ctx.resume();
  await ctx.audioWorklet.addModule("/capture-worklet.js");
  const track = stream.getAudioTracks()[0];
  const settings = track?.getSettings() ?? {};
  const rate = ctx.sampleRate || 48_000;
  eng.setSampleRate(rate);
  const label = track?.label || "Microphone";
  const id = settings.deviceId ?? deviceId;
  eng.setSourceMeta("mic", label, null, id ?? null);
  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "capture-processor");
  lastTick = performance.now();
  node.port.onmessage = (event: MessageEvent<Float32Array>) => {
    const now = performance.now();
    const gap = now - lastTick;
    if (gap > 180) eng.noteDropout(gap);
    lastTick = now;
    const samples = event.data;
    const incidentId = eng.status().incidentId;
    eng.pumpBlock(samples, Date.now(), performance.timeOrigin + now);
    keepWav(samples, rate, incidentId);
  };
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(node);
  node.connect(mute);
  mute.connect(ctx.destination);
  return label;
}

export async function listInputs(): Promise<{ id: string; label: string }[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all
    .filter((d) => d.kind === "audioinput")
    .map((d, i) => ({ id: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
}

export function burstFullScale(): void {
  const eng = getEngine();
  const fs = eng.status().sampleRate || 48_000;
  const n = Math.round(fs * 0.2);
  const block = new Float32Array(n);
  for (let i = 0; i < n; i++) block[i] = Math.sin((2 * Math.PI * 1000 * i) / fs);
  eng.pumpBlock(block, Date.now(), performance.timeOrigin + performance.now());
}

export function estimateHours(fftSize: number, saveWav: boolean, screenOn: boolean): number {
  let mA = screenOn ? 230 : 95;
  if (fftSize >= 8192) mA += screenOn ? 35 : 20;
  if (fftSize >= 16384) mA += 40;
  if (saveWav) mA += 25;
  return 4700 / mA;
}
