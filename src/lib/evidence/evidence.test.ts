import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SoundLevelEngine, sineBlock } from "../engine/sound-level-engine.ts";
import { csvTimestampsOk, renderMetersCsv } from "./csv.ts";
import { DISCLAIMER } from "./disclaimer.ts";
import { buildEvidencePack } from "./pack.ts";
import { renderTextPdf } from "./pdf.ts";
import { zipNames, zipStore } from "./zip.ts";

describe("evidence files", () => {
  it("writes monotonic CSV timestamps with an ISO offset", () => {
    const engine = new SoundLevelEngine({
      sampleRate: 48_000,
      calOffsetDb: 0,
      timeZone: "America/Chicago",
      fftSize: 4096,
    });
    engine.setSourceMeta("demo", "sine", "tone1k", null);
    engine.startIncident(
      {
        name: "Ada",
        address: "12 Example",
        room: "bedroom",
        windows: "closed",
        direction: "adjacent",
        noiseType: "bass",
        note: "",
      },
      null,
      true,
    );
    const fs = 48_000;
    const chunk = 2048;
    for (let done = 0; done < fs; done += chunk) {
      engine.pushSamples(sineBlock(1000, fs, chunk, 0.4), 1_700_000_000_000 + (done / fs) * 1000, done);
    }
    const inc = engine.stopIncident();
    assert.ok(inc);
    const csv = renderMetersCsv(inc!.samples);
    const check = csvTimestampsOk(csv);
    assert.ok(check.rows >= 6, `rows ${check.rows}`);
    assert.equal(check.monotonic, true);
    assert.equal(check.iso, true);
    assert.match(csv, /America\/Chicago/);
  });

  it("puts the disclaimer in the PDF and the pack names in the zip", async () => {
    const engine = new SoundLevelEngine({ sampleRate: 48_000, fftSize: 4096 });
    engine.setSourceMeta("demo", "room", "room", null);
    engine.startIncident(
      {
        name: "Ada",
        address: "unit 4",
        room: "bedroom",
        windows: "closed",
        direction: "above",
        noiseType: "music",
        note: "after 10pm",
      },
      null,
      true,
    );
    engine.pushSamples(sineBlock(220, 48_000, 48_000, 0.2), 1_700_000_000_000, 0);
    const inc = engine.stopIncident()!;
    const pdf = new TextDecoder().decode(renderTextPdf("DecibelLog", DISCLAIMER));
    assert.match(pdf, /not a certified/);
    const pack = await buildEvidencePack(inc);
    const names = zipNames(pack.bytes);
    assert.ok(names.some((n) => n.endsWith("_meters.csv")));
    assert.ok(names.some((n) => n.endsWith("_session.json")));
    assert.ok(names.some((n) => n.endsWith("_report.pdf")));
    assert.ok(names.some((n) => n.endsWith("_hashes.sha256")));
    assert.ok(names.some((n) => n.endsWith("_slate.txt")));
    const tiny = zipStore([{ name: "a.txt", data: new TextEncoder().encode("hi") }]);
    assert.deepEqual(zipNames(tiny), ["a.txt"]);
  });
});
