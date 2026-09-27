export function fmtDb(n: number | null | undefined): string {
  if (n === undefined || n === null || !Number.isFinite(n) || n < -160) return "—";
  return n.toFixed(1);
}

export function fmtDur(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function downloadBytes(filename: string, bytes: Uint8Array, mime: string): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function levelPct(db: number, offset: number): number {
  const lo = offset - 70;
  const hi = offset + 3;
  if (!Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db - lo) / (hi - lo)));
}
