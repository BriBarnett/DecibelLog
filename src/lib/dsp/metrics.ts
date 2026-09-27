/** Exponential time weighting, peak hold, and Leq. Digital: dB = 10 log10(mean square) + offset. */

export type ImplementedTimeWeight = "fast" | "slow";

/** Impulse (35 ms rise / 1.5 s decay) is a v1 stub — not used by the engine. */
export type TimeWeightName = ImplementedTimeWeight | "impulse";

export const TIME_CONSTANT_S: Record<ImplementedTimeWeight, number> = {
  fast: 0.125,
  slow: 1,
};

export function timeWeightAlpha(kind: ImplementedTimeWeight, fs: number): number {
  return Math.exp(-1 / (TIME_CONSTANT_S[kind] * fs));
}

export function createImpulseWeighting(): null {
  return null;
}

export class ExpMeanSquare {
  private y = 0;
  readonly alpha: number;

  constructor(kind: ImplementedTimeWeight, fs: number) {
    this.alpha = timeWeightAlpha(kind, fs);
  }

  reset(): void {
    this.y = 0;
  }

  push(x: number): number {
    const oneMinus = 1 - this.alpha;
    this.y = this.alpha * this.y + oneMinus * x * x;
    return this.y;
  }

  get ms(): number {
    return this.y;
  }
}

export class LeqAccumulator {
  sumSq = 0;
  count = 0;

  reset(): void {
    this.sumSq = 0;
    this.count = 0;
  }

  push(x: number): void {
    this.sumSq += x * x;
    this.count += 1;
  }

  pushBlock(xs: ArrayLike<number>): void {
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i]!;
      this.sumSq += x * x;
    }
    this.count += xs.length;
  }

  get meanSquare(): number {
    return this.count > 0 ? this.sumSq / this.count : 0;
  }
}

export class PeakHold {
  peak = 0;

  reset(): void {
    this.peak = 0;
  }

  push(x: number): number {
    const a = Math.abs(x);
    if (a > this.peak) this.peak = a;
    return this.peak;
  }
}

/** 10 log10(ms) + offset. Empty / silence floors at -200 so logs stay finite. */
export function dbFromMeanSquare(ms: number, offsetDb: number): number {
  if (!(ms > 0)) return -200 + offsetDb;
  return 10 * Math.log10(ms) + offsetDb;
}

export function dbFromPeak(peakAbs: number, offsetDb: number): number {
  if (!(peakAbs > 0)) return -200 + offsetDb;
  return 20 * Math.log10(peakAbs) + offsetDb;
}

/** RMS of a unit-amplitude sine is 1/sqrt(2), so its digital level is about -3.0103 dB. */
export function fullScaleSineDb(offsetDb: number): number {
  return 10 * Math.log10(0.5) + offsetDb;
}
