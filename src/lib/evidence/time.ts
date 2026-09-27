export type TimeStamp = {
  epochMs: number;
  monotonicMs: number;
  iso: string;
  timeZone: string;
};

export function pad(n: number, width = 2): string {
  return String(Math.trunc(Math.abs(n))).padStart(width, "0");
}

/** ISO-8601 local time with numeric offset, millisecond precision. */
export function isoWithOffset(date: Date): string {
  const offMin = -date.getTimezoneOffset();
  const sign = offMin >= 0 ? "+" : "-";
  const abs = Math.abs(offMin);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

export const ISO_OFFSET_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/;

export function stampFrom(epochMs: number, monotonicMs: number, timeZone: string): TimeStamp {
  return {
    epochMs,
    monotonicMs,
    iso: isoWithOffset(new Date(epochMs)),
    timeZone,
  };
}

export function stampNow(): TimeStamp {
  const epochMs = Date.now();
  const monotonicMs =
    typeof performance !== "undefined" ? performance.timeOrigin + performance.now() : epochMs;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return stampFrom(epochMs, monotonicMs, timeZone);
}

export function fileStamp(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export function slugPart(value: string, fallback: string): string {
  const s = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return s || fallback;
}
