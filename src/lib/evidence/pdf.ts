/** Tiny single-font PDF writer. Text is ASCII; the disclaimer is wrapped, not typeset. */

function ascii(text: string): string {
  return text
    .replaceAll("−", "-")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replace(/[^\x20-\x7E\n]/g, "?");
}

export function wrapText(text: string, width = 88): string[] {
  const out: string[] = [];
  for (const raw of ascii(text).split("\n")) {
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > width && line) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function pdfEscape(text: string): string {
  return ascii(text).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

export function renderTextPdf(title: string, body: string): Uint8Array {
  const lines = [title, "", ...wrapText(body)];
  const commands: string[] = ["BT", "/F1 11 Tf", "14 TL", "48 760 Td"];
  let used = 0;
  for (const line of lines) {
    if (used === 0) commands.push(`/F1 14 Tf (${pdfEscape(line)}) Tj`);
    else commands.push(`/F1 10 Tf (${pdfEscape(line)}) Tj`);
    commands.push("T*");
    used++;
    if (used > 62) break;
  }
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
