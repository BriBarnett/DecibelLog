import { writeFileSync } from "node:fs";
import { SoundLevelEngine } from "../src/lib/engine/sound-level-engine.ts";
import { renderMetersCsv } from "../src/lib/evidence/csv.ts";
import { renderTextPdf } from "../src/lib/evidence/pdf.ts";
import { buildEvidencePack, reportBody, sessionDocument } from "../src/lib/evidence/pack.ts";

const fs = 48_000;
const engine = new SoundLevelEngine({
  sampleRate: fs,
  fftSize: 4096,
  calOffsetDb: 0,
  timeZone: "America/Chicago",
  sourceLabel: "Demo · bass-heavy",
  modelLabel: "browser-demo",
  installationIdSha256: "sample",
});
engine.setSourceMeta("demo", "Demo · bass-heavy", "bass", null);
engine.startIncident(
  {
    name: "Sample",
    address: "Unit 4",
    room: "bedroom",
    windows: "closed",
    direction: "adjacent",
    noiseType: "bass",
    note: "60 second generated demo, not a live recording",
  },
  null,
  true,
);

const chunk = 4096;
const total = fs * 60;
let phase = 0;
for (let done = 0; done < total; done += chunk) {
  const n = Math.min(chunk, total - done);
  const block = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = (phase + i) / fs;
    block[i] = 0.35 * Math.sin(2 * Math.PI * 55 * t) + 0.08 * Math.sin(2 * Math.PI * 1000 * t);
  }
  phase += n;
  engine.pushSamples(block, Date.parse("2026-09-26T22:30:00.000-05:00") + (done / fs) * 1000, done);
}
const inc = engine.stopIncident();
if (!inc) throw new Error("no incident");
const base = "/workspace/public/samples";
writeFileSync(`${base}/demo-60s-meters.csv`, renderMetersCsv(inc.samples));
writeFileSync(`${base}/demo-60s-session.json`, JSON.stringify(sessionDocument(inc), null, 2) + "\n");
writeFileSync(`${base}/demo-60s-report.pdf`, renderTextPdf("DecibelLog 60s demo", reportBody(inc)));
const pack = await buildEvidencePack(inc);
writeFileSync(`${base}/demo-60s-pack.zip`, pack.bytes);
console.log(`rows ${inc.samples.length} laeq ${inc.summary?.laeq.toFixed(1)} lceq ${inc.summary?.lceq.toFixed(1)}`);
