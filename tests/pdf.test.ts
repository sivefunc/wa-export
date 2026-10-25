import { describe, expect, it } from "vitest";
import { buildPdf, type PdfPage } from "../src/export/raster/pdf";

const latin1 = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join("");
const jpeg = (n: number) => new Uint8Array([0xff, 0xd8, ...Array.from({ length: n }, (_, i) => i % 251), 0xff, 0xd9]);

function page(lines: PdfPage["lines"] = []): PdfPage {
  return { jpeg: jpeg(40), pixelWidth: 1800, pixelHeight: 2546, lines };
}

describe("buildPdf", () => {
  const A4 = { widthPt: 595.28, heightPt: 841.89, cssWidth: 900, cssHeight: 1273 };

  it("is a PDF whose xref offsets point at every object", () => {
    const pdf = latin1(buildPdf([page(), page()], A4));
    expect(pdf.startsWith("%PDF-1.7\n")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    const startxref = Number(pdf.match(/startxref\n(\d+)\n%%EOF/)![1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");
    const [, count] = pdf.slice(startxref).match(/xref\n0 (\d+)\n/)!;
    const entries = pdf.slice(startxref).split("\n").slice(3, 2 + Number(count));
    entries.forEach((e, i) => {
      const offset = Number(e.slice(0, 10));
      expect(pdf.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
  });

  it("has one A4 page per image, with the JPEG embedded unchanged", () => {
    const a = page();
    const bytes = buildPdf([a, page()], A4);
    const pdf = latin1(bytes);
    expect(pdf).toContain("/Type /Pages /Kids [");
    expect(pdf).toMatch(/\/Count 2\b/);
    expect(pdf.match(/\/MediaBox \[0 0 595.28 841.89\]/g)).toHaveLength(2);
    expect(pdf).toContain("/Subtype /Image /Width 1800 /Height 2546 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length 44");
    expect(pdf).toContain(latin1(a.jpeg));
    expect(pdf).toContain("595.28 0 0 841.89 0 0 cm /Im0 Do");
  });

  it("writes each line as invisible text placed and stretched over its box", () => {
    const pdf = latin1(buildPdf([page([{ x: 90, y: 100, w: 180, h: 20, text: "Hi 🐼" }])], A4));
    const k = 595.28 / 900;
    const size = (20 * k * 0.82).toFixed(2);
    expect(pdf).toContain("3 Tr");
    expect(pdf).toContain(`/F0 ${size} Tf`);
    // Baseline at 80% of the box, from the bottom of the page.
    expect(pdf).toContain(`${(90 * k).toFixed(2)} ${(841.89 - (100 + 20 * 0.8) * k).toFixed(2)} Td`);
    // 4 characters at 0.5 em each, stretched to the box width.
    const tz = ((100 * 180 * k) / (4 * 0.5 * Number(size))).toFixed(2);
    expect(pdf).toContain(`${tz} Tz`);
    expect(pdf).toMatch(/<0001000200030004> Tj/);
  });

  it("maps every character back to Unicode, emoji included", () => {
    const pdf = latin1(buildPdf([page([{ x: 0, y: 0, w: 10, h: 10, text: "aé🐼a" }])], A4));
    expect(pdf).toContain("/Encoding /Identity-H");
    expect(pdf).toMatch(/<0001> <0061>/);
    expect(pdf).toMatch(/<0002> <00E9>/);
    expect(pdf).toMatch(/<0003> <D83DDC3C>/);
    expect(pdf).toContain("<0001000200030001> Tj"); // the repeated "a" reuses its CID
  });

  it("a page without text has no text block", () => {
    const pdf = latin1(buildPdf([page()], A4));
    expect(pdf).not.toContain("BT");
  });
});
