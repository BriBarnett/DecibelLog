/** Store-only ZIP (method 0). Enough for an evidence pack; no compression dependency. */

export type ZipEntry = { name: string; data: Uint8Array };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(date: Date): { time: number; day: number } {
  const time =
    ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f);
  const day =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0xf) << 5) |
    (date.getDate() & 0x1f);
  return { time, day };
}

export function zipStore(entries: ZipEntry[], when = new Date()): Uint8Array {
  const { time, day } = dosTime(when);
  const enc = new TextEncoder();
  const names = entries.map((e) => enc.encode(e.name));
  const crcs = entries.map((e) => crc32(e.data));
  let localTotal = 0;
  let centralTotal = 0;
  for (let i = 0; i < entries.length; i++) {
    localTotal += 30 + names[i]!.length + entries[i]!.data.length;
    centralTotal += 46 + names[i]!.length;
  }
  const end = 22;
  const out = new Uint8Array(localTotal + centralTotal + end);
  const view = new DataView(out.buffer);
  let p = 0;
  const offsets: number[] = [];
  for (let i = 0; i < entries.length; i++) {
    offsets.push(p);
    const name = names[i]!;
    const data = entries[i]!.data;
    view.setUint32(p, 0x04034b50, true);
    view.setUint16(p + 4, 20, true);
    view.setUint16(p + 6, 0, true);
    view.setUint16(p + 8, 0, true);
    view.setUint16(p + 10, time, true);
    view.setUint16(p + 12, day, true);
    view.setUint32(p + 14, crcs[i]!, true);
    view.setUint32(p + 18, data.length, true);
    view.setUint32(p + 22, data.length, true);
    view.setUint16(p + 26, name.length, true);
    view.setUint16(p + 28, 0, true);
    p += 30;
    out.set(name, p);
    p += name.length;
    out.set(data, p);
    p += data.length;
  }
  const centralStart = p;
  for (let i = 0; i < entries.length; i++) {
    const name = names[i]!;
    const data = entries[i]!.data;
    view.setUint32(p, 0x02014b50, true);
    view.setUint16(p + 4, 20, true);
    view.setUint16(p + 6, 20, true);
    view.setUint16(p + 8, 0, true);
    view.setUint16(p + 10, 0, true);
    view.setUint16(p + 12, time, true);
    view.setUint16(p + 14, day, true);
    view.setUint32(p + 16, crcs[i]!, true);
    view.setUint32(p + 20, data.length, true);
    view.setUint32(p + 24, data.length, true);
    view.setUint16(p + 28, name.length, true);
    view.setUint16(p + 30, 0, true);
    view.setUint16(p + 32, 0, true);
    view.setUint16(p + 34, 0, true);
    view.setUint16(p + 36, 0, true);
    view.setUint32(p + 38, 0, true);
    view.setUint32(p + 42, offsets[i]!, true);
    p += 46;
    out.set(name, p);
    p += name.length;
  }
  view.setUint32(p, 0x06054b50, true);
  view.setUint16(p + 4, 0, true);
  view.setUint16(p + 6, 0, true);
  view.setUint16(p + 8, entries.length, true);
  view.setUint16(p + 10, entries.length, true);
  view.setUint32(p + 12, p - centralStart, true);
  view.setUint32(p + 16, centralStart, true);
  view.setUint16(p + 20, 0, true);
  return out;
}

export function zipNames(data: Uint8Array): string[] {
  const names: string[] = [];
  const dec = new TextDecoder();
  for (let i = 0; i < data.length - 4; i++) {
    if (data[i] === 0x50 && data[i + 1] === 0x4b && data[i + 2] === 0x01 && data[i + 3] === 0x02) {
      const nameLen = data[i + 28]! | (data[i + 29]! << 8);
      names.push(dec.decode(data.subarray(i + 46, i + 46 + nameLen)));
    }
  }
  return names;
}
