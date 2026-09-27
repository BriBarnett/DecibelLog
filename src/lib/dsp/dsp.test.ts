import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { designWeighting, magnitudeDb, TARGET_SAMPLE_RATE } from "./filters.ts";
import { ExpMeanSquare, fullScaleSineDb } from "./metrics.ts";
import { measureSine } from "../engine/sound-level-engine.ts";

const FS = TARGET_SAMPLE_RATE;

describe("IEC weighting", () => {
  it("A-weight is 0 dB at 1 kHz, about -19.1 at 100 Hz, about -50.5 at 20 Hz", () => {
    const a = designWeighting("A", FS);
    assert.ok(Math.abs(magnitudeDb(a, 1000, FS)) < 0.05);
    const at100 = magnitudeDb(a, 100, FS);
    const at20 = magnitudeDb(a, 20, FS);
    assert.ok(Math.abs(at100 - -19.1) < 0.5, `100 Hz was ${at100.toFixed(2)} dB`);
    assert.ok(Math.abs(at20 - -50.5) < 0.5, `20 Hz was ${at20.toFixed(2)} dB`);
  });

  it("C-weight is 0 dB at 1 kHz and near -3 dB at 31.5 Hz", () => {
    const c = designWeighting("C", FS);
    assert.ok(Math.abs(magnitudeDb(c, 1000, FS)) < 0.05);
    const at31 = magnitudeDb(c, 31.5, FS);
    assert.ok(at31 < -2.3 && at31 > -3.7, `31.5 Hz was ${at31.toFixed(2)} dB`);
  });
});

describe("time weighting", () => {
  it("Fast and Slow reach 1 - 1/e after one time constant", () => {
    for (const kind of ["fast", "slow"] as const) {
      const tau = kind === "fast" ? 0.125 : 1;
      const ms = new ExpMeanSquare(kind, FS);
      const n = Math.round(tau * FS);
      for (let i = 0; i < n; i++) ms.push(1);
      const expected = 1 - Math.exp(-1);
      assert.ok(Math.abs(ms.ms - expected) < 0.002, `${kind} ${ms.ms} vs ${expected}`);
    }
  });
});

describe("Leq", () => {
  it("matches 20 log10(rms) + offset for a digital full-scale 1 kHz sine", () => {
    const offset = 6.5;
    const frame = measureSine(1000, 0.6, 1, offset);
    const expected = fullScaleSineDb(offset);
    assert.ok(Math.abs(frame.laeq - expected) < 0.35, `LAeq ${frame.laeq} vs ${expected}`);
    assert.ok(Math.abs(frame.lceq - expected) < 0.35, `LCeq ${frame.lceq} vs ${expected}`);
  });

  it("reads C higher than A on a bass tone", () => {
    const frame = measureSine(55, 0.6, 0.5, 0);
    assert.ok(frame.lcf > frame.laf + 12, `LCF ${frame.lcf} LAF ${frame.laf}`);
  });
});
