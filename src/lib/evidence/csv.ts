import type { BandLevel } from "../dsp/spectrum.ts";
import type { MeterRow } from "../engine/types.ts";
import { ISO_OFFSET_RE } from "./time.ts";

const METER_HEADER = [
  "t_epoch_ms",
  "t_monotonic_ms",
  "t_iso",
  "timezone",
  "laf",
  "las",
  "lcf",
  "lcs",
  "lzf",
  "lapeak_hold",
  "lcpeak_hold",
  "laeq",
  "lceq",
  "lc_minus_la",
  "clipped",
  "cal_offset_db",
  "source",
] as const;

function num(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3) : "";
}

function cell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function renderMetersCsv(rows: readonly MeterRow[]): string {
  const lines = [METER_HEADER.join(",")];
  for (const row of rows) {
    lines.push(
      [
        String(Math.round(row.tEpochMs)),
        String(Math.round(row.tMonotonicMs)),
        row.tIso,
        row.timeZone,
        num(row.laf),
        num(row.las),
        num(row.lcf),
        num(row.lcs),
        num(row.lzf),
        num(row.lapeak),
        num(row.lcpeak),
        num(row.laeq),
        num(row.lceq),
        num(row.lcMinusLa),
        row.clipped ? "1" : "0",
        num(row.calOffsetDb),
        cell(row.sourceLabel),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export function csvTimestampsOk(csv: string): { monotonic: boolean; iso: boolean; rows: number } {
  const lines = csv.trim().split("\n").slice(1);
  let prev = -Infinity;
  let monotonic = true;
  let iso = true;
  for (const line of lines) {
    if (!line) continue;
    const [epoch, , tIso] = line.split(",");
    const t = Number(epoch);
    if (!(t > prev)) monotonic = false;
    prev = t;
    if (!tIso || !ISO_OFFSET_RE.test(tIso)) iso = false;
  }
  return { monotonic, iso, rows: lines.filter(Boolean).length };
}

export function renderSpectrumCsv(
  rows: { tIso: string; tEpochMs: number; bands: BandLevel[] }[],
): string {
  const centers = rows[0]?.bands.map((b) => b.fc) ?? [];
  const header = ["t_epoch_ms", "t_iso", ...centers.map((fc) => `hz_${fc}`)];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [String(Math.round(row.tEpochMs)), row.tIso, ...row.bands.map((b) => num(b.db))].join(","),
    );
  }
  return lines.join("\n") + "\n";
}
