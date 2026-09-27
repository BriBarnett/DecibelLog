/** IEC 61672-1 analog prototypes, bilinear transform, gain-normalized at 1 kHz. */

export type Biquad = {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
  z1: number;
  z2: number;
};

export const IEC = {
  f1: 20.598997,
  f2: 107.65265,
  f3: 737.86223,
  f4: 12194.217,
} as const;

export const TARGET_SAMPLE_RATE = 48_000;

export function resetBiquad(section: Biquad): void {
  section.z1 = 0;
  section.z2 = 0;
}

export function cloneSections(sections: readonly Biquad[]): Biquad[] {
  return sections.map((s) => ({ ...s, z1: 0, z2: 0 }));
}

/** Transposed direct form II. H(z) = (b0 + b1 z^-1 + b2 z^-2) / (1 + a1 z^-1 + a2 z^-2). */
export function tickBiquad(section: Biquad, x: number): number {
  const y = section.b0 * x + section.z1;
  section.z1 = section.b1 * x - section.a1 * y + section.z2;
  section.z2 = section.b2 * x - section.a2 * y;
  return y;
}

export function tickCascade(sections: Biquad[], x: number): number {
  let y = x;
  for (let i = 0; i < sections.length; i++) y = tickBiquad(sections[i]!, y);
  return y;
}

function highpass1(fc: number, fs: number): Biquad {
  const w = 2 * Math.PI * fc;
  const k = 2 * fs;
  const norm = 1 / (k + w);
  return { b0: k * norm, b1: -k * norm, b2: 0, a1: (w - k) * norm, a2: 0, z1: 0, z2: 0 };
}

function lowpass1(fc: number, fs: number): Biquad {
  const w = 2 * Math.PI * fc;
  const k = 2 * fs;
  const norm = 1 / (k + w);
  return { b0: w * norm, b1: w * norm, b2: 0, a1: (w - k) * norm, a2: 0, z1: 0, z2: 0 };
}

function biquadH(section: Biquad, omega: number): { re: number; im: number } {
  const z1r = Math.cos(omega);
  const z1i = -Math.sin(omega);
  const z2r = z1r * z1r - z1i * z1i;
  const z2i = 2 * z1r * z1i;
  const nr = section.b0 + section.b1 * z1r + section.b2 * z2r;
  const ni = section.b1 * z1i + section.b2 * z2i;
  const dr = 1 + section.a1 * z1r + section.a2 * z2r;
  const di = section.a1 * z1i + section.a2 * z2i;
  const den = dr * dr + di * di;
  return { re: (nr * dr + ni * di) / den, im: (ni * dr - nr * di) / den };
}

/** Magnitude of a cascade at `freq` Hz. Does not depend on filter state. */
export function magnitude(sections: readonly Biquad[], freq: number, fs: number): number {
  const omega = (2 * Math.PI * freq) / fs;
  let re = 1;
  let im = 0;
  for (const section of sections) {
    const h = biquadH(section, omega);
    const nre = re * h.re - im * h.im;
    const nim = re * h.im + im * h.re;
    re = nre;
    im = nim;
  }
  return Math.hypot(re, im);
}

export function magnitudeDb(sections: readonly Biquad[], freq: number, fs: number): number {
  return 20 * Math.log10(Math.max(magnitude(sections, freq, fs), 1e-20));
}

function normalizeAt1k(sections: Biquad[], fs: number): Biquad[] {
  const g = magnitude(sections, 1000, fs);
  const scale = 1 / g;
  const first = sections[0]!;
  first.b0 *= scale;
  first.b1 *= scale;
  first.b2 *= scale;
  return sections;
}

export type Weighting = "A" | "C" | "Z";

/** Digital A, C, or band-limited Z. Fresh delay state. Gain is 0 dB at 1 kHz. */
export function designWeighting(kind: Weighting, fs: number): Biquad[] {
  if (!(fs > 0)) throw new Error("sample rate must be positive");
  if (kind === "A") {
    return normalizeAt1k(
      [
        highpass1(IEC.f1, fs),
        highpass1(IEC.f1, fs),
        highpass1(IEC.f2, fs),
        highpass1(IEC.f3, fs),
        lowpass1(IEC.f4, fs),
        lowpass1(IEC.f4, fs),
      ],
      fs,
    );
  }
  if (kind === "C") {
    return normalizeAt1k(
      [highpass1(IEC.f1, fs), highpass1(IEC.f1, fs), lowpass1(IEC.f4, fs), lowpass1(IEC.f4, fs)],
      fs,
    );
  }
  return normalizeAt1k([highpass1(10, fs), lowpass1(20_000, fs)], fs);
}
