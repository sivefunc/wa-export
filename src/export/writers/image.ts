import type { ExportBundle } from "../../types";
import { exportFilename } from "../naming";
import type { Settings } from "../../settings";
import { canvasBlob, layOut, prepareMedia, rasterize, useDarkTheme } from "../raster/dom";
import { buildPdf, type PdfPage } from "../raster/pdf";
import { chooseScale, linesIn, MAX_SIDE, paginate, qualityPreset } from "../raster/plan";
import { writerCatalog } from "./catalog";
import type { Writer } from "./index";
import { buildZip, type ZipEntry } from "./zip-archive";

// Large media is read in full to draw it, like the HTML export.
const LIMITS = { warnBytes: 200 * 1024 * 1024, maxBytes: 500 * 1024 * 1024, hint: "Select fewer large files, or export as ZIP." };

/** Media, layout: the shared first ~40% of the progress bar. */
async function snapshot(b: ExportBundle, report: (pct: number) => void, settings?: Settings) {
  const doc = document;
  const steps = Math.max(1, b.records.filter((r) => r.exportedMedia).length);
  let done = 0;
  report(0);
  const media = await prepareMedia(doc, b, () => report(Math.floor((++done / steps) * 30)));
  const laid = await layOut(doc, b, media, useDarkTheme(doc, settings?.theme));
  report(40);
  return { doc, laid };
}

function progress(onProgress?: (pct: number) => void) {
  let last = -1;
  return (pct: number) => {
    if (pct > last) onProgress?.((last = Math.min(100, pct)));
  };
}

export const TOO_LONG =
  "This chat is too long for one image. Turn on ⚙ → Long images → Split into parts, or select fewer messages.";

/** A PNG or JPEG writer: one image of the chat, or (Long images → Split) a ZIP of parts cut between messages. */
function imageWriter(id: "png" | "jpeg"): Writer {
  const type = id === "png" ? "image/png" : "image/jpeg";
  const ext = id === "png" ? "png" : "jpg";
  return {
    ...writerCatalog[id],
    limits: LIMITS,
    wantsAvatars: true,
    async write(b, onProgress, settings) {
      const report = progress(onProgress);
      const preset = qualityPreset(settings ?? { quality: "best", customQuality: 75 });
      const { doc, laid } = await snapshot(b, report, settings);
      const name = exportFilename(b.chat.name, b.exportedAt, ext);
      const scale = chooseScale(laid.width, laid.height, preset.scale);
      if (scale) {
        const canvas = await rasterize(doc, laid, { y0: 0, y1: laid.height }, scale);
        report(90);
        const blob = await canvasBlob(canvas, type, preset.jpeg);
        report(100);
        return { blob, filename: name };
      }
      if (settings?.longImages !== "split") throw new Error(TOO_LONG);
      // Parts at the preset's scale, each within the canvas limit, cut between messages.
      const slices = paginate(laid.blocks, laid.height, Math.floor(MAX_SIDE / preset.scale));
      const parts: ZipEntry[] = [];
      const width = String(slices.length).length;
      for (const [i, s] of slices.entries()) {
        const canvas = await rasterize(doc, laid, s, preset.scale);
        const blob = await canvasBlob(canvas, type, preset.jpeg);
        const path = name.replace(/\.\w+$/, `-${String(i + 1).padStart(width, "0")}.${ext}`);
        parts.push({ path, data: new Uint8Array(await blob.arrayBuffer()), compress: false });
        report(40 + Math.floor(((i + 1) / slices.length) * 55));
      }
      const blob = await buildZip(parts);
      report(100);
      return { blob, filename: name.replace(/\.\w+$/, ".zip") };
    },
  };
}

export const pngWriter = imageWriter("png");
export const jpegWriter = imageWriter("jpeg");

// A4 portrait; one page shows PAGE_HEIGHT CSS px of the 900px-wide chat.
const A4 = { widthPt: 595.28, heightPt: 841.89 };

/** A4 PDF: each page is a JPEG of a slice of the chat, with an invisible text layer for search and copy. */
export const pdfWriter: Writer = {
  ...writerCatalog.pdf,
  limits: LIMITS,
  wantsAvatars: true,
  async write(b, onProgress, settings) {
    const report = progress(onProgress);
    const preset = qualityPreset(settings ?? { quality: "best", customQuality: 75 });
    const { doc, laid } = await snapshot(b, report, settings);
    const pageHeight = Math.round((laid.width * A4.heightPt) / A4.widthPt);
    const slices = paginate(laid.blocks, laid.height, pageHeight);
    const pages: PdfPage[] = [];
    for (const [i, s] of slices.entries()) {
      const canvas = await rasterize(doc, laid, s, preset.scale, pageHeight);
      const jpeg = new Uint8Array(await (await canvasBlob(canvas, "image/jpeg", preset.jpeg)).arrayBuffer());
      const lines = linesIn(laid.lines, s);
      pages.push({ jpeg, pixelWidth: canvas.width, pixelHeight: canvas.height, lines });
      report(40 + Math.floor(((i + 1) / slices.length) * 55));
    }
    const pdf = buildPdf(pages, { ...A4, cssWidth: laid.width, cssHeight: pageHeight });
    report(100);
    return { blob: new Blob([pdf], { type: "application/pdf" }), filename: exportFilename(b.chat.name, b.exportedAt, "pdf") };
  },
};
