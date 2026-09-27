/** In-place radix-2 FFT, Hann window, ISO nominal 1/3-octave fold. */

export const OCTAVE_CENTERS = [
  25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600,
  2000, 2500, 3150, 4000, 5000, 6300, 8000, 10_000, 12_500, 16_000,
] as const;

const SIXTH = Math.pow(2, 1 / 6);

export function bandEdges(fc: number): { lo: number; hi: number } {
  return { lo: fc / SIXTH, hi: fc * SIXTH };
}

export function hannWindow(n: number): Float64Array {
  const w = new Float64Array(n);
  if (n <= 1) {
    if (n === 1) w[0] = 1;
    return w;
  }
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  return w;
}

export function fftRadix2(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n !== im.length || (n & (n - 1)) !== 0) throw new Error("FFT length must be a power of two");
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const uRe = re[i + j]!;
        const uIm = im[i + j]!;
        const vRe = re[i + j + half]! * wRe - im[i + j + half]! * wIm;
        const vIm = re[i + j + half]! * wIm + im[i + j + half]! * wRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + half] = uRe - vRe;
        im[i + j + half] = uIm - vIm;
        const nextRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nextRe;
      }
    }
  }
}

export type BandLevel = { fc: number; db: number };

export type SpectrumPower = {
  /** Single-sided mean-square per bin (DC..Nyquist-1), same units as a time-domain mean square. */
  binHz: number;
  binMs: Float64Array;
};

/**
 * Windowed real FFT → per-bin mean square.
 * A full-scale sine (amplitude 1) concentrates about 0.5 mean square near its bin.
 */
export function spectrumMeanSquare(
  samples: ArrayLike<number>,
  window: Float64Array,
  workRe: Float64Array,
  workIm: Float64Array,
): SpectrumPower {
  const n = window.length;
  let sumW2 = 0;
  for (let i = 0; i < n; i++) {
    const w = window[i]!;
    sumW2 += w * w;
    workRe[i] = samples[i]! * w;
    workIm[i] = 0;
  }
  fftRadix2(workRe, workIm);
  const half = n >> 1;
  const binMs = new Float64Array(half);
  const norm = sumW2 > 0 ? 1 / sumW2 : 0;
  for (let k = 0; k < half; k++) {
    const p = (workRe[k]! * workRe[k]! + workIm[k]! * workIm[k]!) * norm;
    binMs[k] = k === 0 ? p : 2 * p;
  }
  return { binHz: 0, binMs };
}

export function foldThirdOctave(
  binMs: Float64Array,
  fs: number,
  offsetDb: number,
  fMax = 20_000,
): BandLevel[] {
  const n = binMs.length * 2;
  const binHz = fs / n;
  const out: BandLevel[] = [];
  for (const fc of OCTAVE_CENTERS) {
    if (fc >= fMax || fc >= fs / 2) break;
    const { lo, hi } = bandEdges(fc);
    let acc = 0;
    let any = false;
    const k0 = Math.max(1, Math.ceil(lo / binHz));
    const k1 = Math.min(binMs.length - 1, Math.floor(hi / binHz));
    for (let k = k0; k <= k1; k++) {
      acc += binMs[k]!;
      any = true;
    }
    if (!any) {
      const k = Math.min(binMs.length - 1, Math.max(1, Math.round(fc / binHz)));
      acc = binMs[k]!;
    }
    out.push({ fc, db: 10 * Math.log10(Math.max(acc, 1e-20)) + offsetDb });
  }
  return out;
}

export class FftAnalyzer {
  readonly size: number;
  readonly window: Float64Array;
  private readonly re: Float64Array;
  private readonly im: Float64Array;
  private readonly ring: Float64Array;
  private readonly ordered: Float64Array;
  private write = 0;
  private count = 0;
  private hop: number;
  private sinceHop = 0;

  constructor(size: number, overlap = 0.5) {
    if ((size & (size - 1)) !== 0 || size < 256) throw new Error("bad fft size");
    this.size = size;
    this.window = hannWindow(size);
    this.re = new Float64Array(size);
    this.im = new Float64Array(size);
    this.ring = new Float64Array(size);
    this.ordered = new Float64Array(size);
    this.hop = Math.max(1, Math.round(size * (1 - overlap)));
  }

  reset(): void {
    this.write = 0;
    this.count = 0;
    this.sinceHop = 0;
  }

  /**
   * Push samples. `onHop` fires each time a new window is ready (50% overlap by default).
   * Returns the latest hop, or null if the buffer has not filled yet.
   */
  push(
    samples: ArrayLike<number>,
    fs: number,
    onHop?: (spec: SpectrumPower) => void,
  ): SpectrumPower | null {
    let ready: SpectrumPower | null = null;
    const size = this.size;
    for (let i = 0; i < samples.length; i++) {
      this.ring[this.write] = samples[i]!;
      this.write++;
      if (this.write === size) this.write = 0;
      if (this.count < size) this.count++;
      this.sinceHop++;
      if (this.count === size && this.sinceHop >= this.hop) {
        this.sinceHop = 0;
        const start = this.write;
        for (let k = 0; k < size; k++) {
          const idx = start + k;
          this.ordered[k] = this.ring[idx < size ? idx : idx - size]!;
        }
        const spec = spectrumMeanSquare(this.ordered, this.window, this.re, this.im);
        spec.binHz = fs / size;
        ready = spec;
        onHop?.(spec);
      }
    }
    return ready;
  }
}
