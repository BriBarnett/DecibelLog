import type { IncidentRecord } from "../engine/types.ts";
import { DISCLAIMER, APP_VERSION, SDK_VERSION } from "./disclaimer.ts";
import { renderMetersCsv } from "./csv.ts";
import { renderTextPdf } from "./pdf.ts";
import { fileStamp, slugPart } from "./time.ts";
import { sha256Hex } from "./sha.ts";

export { sha256Hex };
import { zipStore } from "./zip.ts";

export const SESSION_SCHEMA_ID = "https://decibellog.local/schema/session-v1.json";

function n(v: number): number {
  return Number.isFinite(v) ? Math.round(v * 1000) / 1000 : v;
}

export function sessionDocument(inc: IncidentRecord) {
  return {
    schema: "decibellog.session/v1",
    $schema: SESSION_SCHEMA_ID,
    appVersion: APP_VERSION,
    sdkVersion: SDK_VERSION,
    sessionId: inc.sessionId,
    incidentId: inc.id,
    levelsOnly: inc.levelsOnly,
    startedAt: inc.startedAt,
    endedAt: inc.endedAt,
    meta: inc.meta,
    device: inc.device,
    location: inc.location,
    summary: inc.summary
      ? {
          ...inc.summary,
          laeq: n(inc.summary.laeq),
          lceq: n(inc.summary.lceq),
          lcMinusLa: n(inc.summary.lcMinusLa),
        }
      : null,
    baseline: inc.baseline,
    events: inc.events,
    sampleCount: inc.samples.length,
    disclaimer: DISCLAIMER,
  };
}

export function slateText(inc: IncidentRecord): string {
  const m = inc.meta;
  return [
    `DecibelLog slate`,
    `incident: ${inc.id}`,
    `session: ${inc.sessionId}`,
    `name: ${m.name || "(not given)"}`,
    `address: ${m.address || "(not given)"}`,
    `room: ${m.room || "(not given)"}`,
    `windows: ${m.windows}`,
    `perceived direction: ${m.direction}`,
    `noise type: ${m.noiseType}`,
    `note: ${m.note || ""}`,
    `started: ${inc.startedAt.iso} ${inc.startedAt.timeZone}`,
    `ended: ${inc.endedAt?.iso ?? "(open)"}`,
    ``,
    DISCLAIMER,
    ``,
  ].join("\n");
}

export function reportBody(inc: IncidentRecord): string {
  const s = inc.summary;
  const lines = [
    `Incident ${inc.id}`,
    `Session ${inc.sessionId}`,
    `${inc.meta.room || "room"} · ${inc.meta.noiseType} · windows ${inc.meta.windows}`,
    `Address: ${inc.meta.address || "(not given)"}`,
    `Name: ${inc.meta.name || "(not given)"}`,
    `Direction (perceived, not measured): ${inc.meta.direction}`,
    `Start ${inc.startedAt.iso} (${inc.startedAt.timeZone})`,
    `End ${inc.endedAt?.iso ?? "open"}`,
    `Source ${inc.device.sourceLabel} @ ${inc.device.sampleRate} Hz`,
    `Calibration offset ${inc.device.calOffsetDb.toFixed(1)} dB`,
    `Clock: ${inc.device.clockNote}`,
    `Install ${inc.device.installationIdSha256.slice(0, 16) || "(none)"}`,
    "",
  ];
  if (s) {
    lines.push(
      `Duration ${s.durationSec.toFixed(1)} s`,
      `LAeq ${s.laeq.toFixed(1)}   LCeq ${s.lceq.toFixed(1)}   LC-LA ${s.lcMinusLa.toFixed(1)}`,
      `LAmax,F ${s.lafMax.toFixed(1)}   LCmax,F ${s.lcfMax.toFixed(1)}`,
      `LASmax ${s.lasMax.toFixed(1)}   LCSmax ${s.lcsMax.toFixed(1)}`,
      `LAFmin ${s.lafMin.toFixed(1)}   LCpeak ${s.lcPeak.toFixed(1)}`,
      `Clipped meter rows ${s.clippedRows}`,
      "",
      "1/3-octave Leq (FFT-binned, low bands limited by bin width):",
    );
    const cs = s.octave.c;
    for (const band of s.octave.a) {
      const c = cs.find((x) => x.fc === band.fc);
      lines.push(`${band.fc} Hz   A ${band.db.toFixed(1)}   C ${c ? c.db.toFixed(1) : "--"}`);
    }
  } else {
    lines.push("Incident is still open. Summary is written when it ends.");
  }
  if (inc.baseline) {
    lines.push(
      "",
      `Quiet baseline ${inc.baseline.seconds}s  LAeq ${inc.baseline.laeq.toFixed(1)}  LCeq ${inc.baseline.lceq.toFixed(1)}`,
    );
  }
  if (inc.location) {
    lines.push(`Location ${inc.location.lat.toFixed(5)}, ${inc.location.lon.toFixed(5)} ±${Math.round(inc.location.accuracyM)} m`);
  }
  lines.push("", "FOOTER", DISCLAIMER);
  return lines.join("\n");
}

export function packBaseName(inc: IncidentRecord): string {
  const when = new Date(inc.startedAt.epochMs);
  return `${fileStamp(when)}_${slugPart(inc.meta.room, "room")}_${slugPart(inc.meta.noiseType, "noise")}`;
}

export async function buildEvidencePack(
  inc: IncidentRecord,
  wav?: Uint8Array | null,
): Promise<{ filename: string; bytes: Uint8Array }> {
  const base = packBaseName(inc);
  const enc = new TextEncoder();
  const csv = enc.encode(renderMetersCsv(inc.samples));
  const session = enc.encode(JSON.stringify(sessionDocument(inc), null, 2) + "\n");
  const slate = enc.encode(slateText(inc));
  const pdf = renderTextPdf(`DecibelLog ${base}`, reportBody(inc));
  const files: { name: string; data: Uint8Array }[] = [
    { name: `${base}_slate.txt`, data: slate },
    { name: `${base}_meters.csv`, data: csv },
    { name: `${base}_session.json`, data: session },
    { name: `${base}_report.pdf`, data: pdf },
  ];
  if (wav && wav.length > 44) files.push({ name: `${base}_audio.wav`, data: wav });
  const hashes = await Promise.all(files.map(async (f) => `${await sha256Hex(f.data)}  ${f.name}`));
  files.push({ name: `${base}_hashes.sha256`, data: enc.encode(hashes.join("\n") + "\n") });
  const bytes = zipStore(files, new Date(inc.startedAt.epochMs));
  return { filename: `${base}_pack.zip`, bytes };
}
