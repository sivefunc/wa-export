// A minimal PDF writer for image exports: one JPEG per page, plus invisible text over each line so the
// PDF can be searched and copied. No library: the format needed here is small and fixed.

export interface TextLine {
  x: number; // CSS px, page coordinates (top-left origin)
  y: number;
  w: number;
  h: number;
  text: string;
}

export interface PdfPage {
  jpeg: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
  lines: TextLine[];
}

export interface PdfGeometry {
  widthPt: number;
  heightPt: number;
  cssWidth: number; // the CSS size a page image represents
  cssHeight: number;
}

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const f2 = (n: number) => n.toFixed(2);
const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, "0");
const utf16Hex = (ch: string) => Array.from({ length: ch.length }, (_, i) => hex4(ch.charCodeAt(i))).join("");

/**
 * Text uses a non-embedded Type0 font with Identity-H: each distinct character gets its own CID, and the
 * ToUnicode CMap maps it back, so search and copy work for any script and emoji. Render mode 3 keeps it
 * invisible; the page image shows the real look.
 */
export function buildPdf(pages: PdfPage[], g: PdfGeometry): Uint8Array {
  const cids = new Map<string, number>();
  const cidOf = (ch: string) => {
    let cid = cids.get(ch);
    if (cid === undefined) cids.set(ch, (cid = cids.size + 1));
    return cid;
  };
  const k = g.widthPt / g.cssWidth;

  function content(p: PdfPage): string {
    const ops = [`q ${f2(g.widthPt)} 0 0 ${f2(g.heightPt)} 0 0 cm /Im0 Do Q`];
    for (const line of p.lines) {
      const chars = Array.from(line.text);
      if (!chars.length || line.w <= 0 || line.h <= 0) continue;
      const size = Number(f2(line.h * k * 0.82)); // as written, so the stretch matches what readers use
      const tz = (100 * line.w * k) / (chars.length * 0.5 * size);
      const codes = chars.map((c) => hex4(cidOf(c))).join("");
      ops.push(`BT 3 Tr /F0 ${f2(size)} Tf ${f2(tz)} Tz ${f2(line.x * k)} ${f2(g.heightPt - (line.y + line.h * 0.8) * k)} Td <${codes}> Tj ET`);
    }
    return ops.join("\n");
  }

  // Objects 1–6 are fixed; each page adds page, image and content objects.
  const contents = pages.map(content); // assigns CIDs before the CMap is written
  const objects: (string | Uint8Array[])[] = [];
  const pageIds = pages.map((_, i) => 7 + i * 3);
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type0 /BaseFont /WAExportText /Encoding /Identity-H /DescendantFonts [4 0 R] /ToUnicode 6 0 R >>");
  objects.push(
    "<< /Type /Font /Subtype /CIDFontType2 /BaseFont /WAExportText /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 5 0 R /DW 500 /CIDToGIDMap /Identity >>",
  );
  objects.push("<< /Type /FontDescriptor /FontName /WAExportText /Flags 4 /FontBBox [0 -200 1000 800] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 >>");
  const entries = [...cids].map(([ch, cid]) => `<${hex4(cid)}> <${utf16Hex(ch)}>`);
  const chunks: string[] = [];
  for (let i = 0; i < entries.length; i += 100) {
    const part = entries.slice(i, i + 100);
    chunks.push(`${part.length} beginbfchar\n${part.join("\n")}\nendbfchar`);
  }
  const cmap = [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Identity-UCS def",
    "/CMapType 2 def",
    "1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange",
    ...chunks,
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end",
  ].join("\n");
  objects.push(`<< /Length ${cmap.length} >>\nstream\n${cmap}\nendstream`);
  pages.forEach((p, i) => {
    const [image, stream] = [pageIds[i] + 1, pageIds[i] + 2];
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f2(g.widthPt)} ${f2(g.heightPt)}] /Resources << /XObject << /Im0 ${image} 0 R >> /Font << /F0 3 0 R >> >> /Contents ${stream} 0 R >>`,
    );
    objects.push([
      ascii(`<< /Type /XObject /Subtype /Image /Width ${p.pixelWidth} /Height ${p.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`),
      p.jpeg,
      ascii("\nendstream"),
    ]);
    objects.push(`<< /Length ${contents[i].length} >>\nstream\n${contents[i]}\nendstream`);
  });

  const out: Uint8Array[] = [];
  let size = 0;
  const emit = (b: Uint8Array) => {
    out.push(b);
    size += b.length;
  };
  emit(ascii("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n"));
  const offsets = objects.map((body, i) => {
    const at = size;
    emit(ascii(`${i + 1} 0 obj\n`));
    for (const b of typeof body === "string" ? [ascii(body)] : body) emit(b);
    emit(ascii("\nendobj\n"));
    return at;
  });
  const xref = size;
  emit(ascii(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`));
  emit(ascii(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));

  const pdf = new Uint8Array(size);
  let at = 0;
  for (const b of out) {
    pdf.set(b, at);
    at += b.length;
  }
  return pdf;
}
