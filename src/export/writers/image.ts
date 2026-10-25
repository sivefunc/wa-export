import JSZip from "jszip";
import type { ExportBundle } from "../../types";
import { exportFilename } from "../naming";
import { canvasBlob, layOut, pageIsDark, prepareMedia, rasterize } from "../raster/dom";
import { buildPdf, type PdfPage } from "../raster/pdf";
import { chooseScale, linesIn, MAX_SIDE, paginate } from "../raster/plan";
import type { Writer } from "./index";

// Large media is read in full to draw it, like the HTML export.
const LIMITS = { warnBytes: 200 * 1024 * 1024, maxBytes: 500 * 1024 * 1024, hint: "Select fewer large files, or export as ZIP." };

/** Media, layout: the shared first ~40% of the progress bar. */
async function snapshot(b: ExportBundle, report: (pct: number) => void) {
  const doc = document;
  const steps = Math.max(1, b.records.filter((r) => r.exportedMedia).length);
  let done = 0;
  report(0);
  const media = await prepareMedia(doc, b, () => report(Math.floor((++done / steps) * 30)));
  const laid = await layOut(doc, b, media, pageIsDark(doc));
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

function imageWriter(id: "png" | "jpeg"): Writer {
  const type = id === "png" ? "image/png" : "image/jpeg";
  const ext = id === "png" ? "png" : "jpg";
  return {
    id,
    label: id === "png" ? "PNG image (WhatsApp look)" : "JPEG image (WhatsApp look)",
    fileType: id.toUpperCase(),
    description: id === "png" ? "One sharp image of the chat" : "One smaller image of the chat",
    limits: LIMITS,
    wantsAvatars: true,
    async write(b, onProgress, settings) {
      const report = progress(onProgress);
      const { doc, laid } = await snapshot(b, report);
      const name = exportFilename(b.chat.name, b.exportedAt, ext);
      const scale = chooseScale(laid.width, laid.height);
      if (scale) {
        const canvas = await rasterize(doc, laid, { y0: 0, y1: laid.height }, scale);
        report(90);
        const blob = await canvasBlob(canvas, type);
        report(100);
        return { blob, filename: name };
      }
      if (settings?.longImages !== "split") throw new Error(TOO_LONG);
      // Parts at 2×, each within the canvas limit, cut between messages.
      const slices = paginate(laid.blocks, laid.height, Math.floor(MAX_SIDE / 2));
      const zip = new JSZip();
      const width = String(slices.length).length;
      for (const [i, s] of slices.entries()) {
        const canvas = await rasterize(doc, laid, s, 2);
        const blob = await canvasBlob(canvas, type);
        zip.file(name.replace(/\.\w+$/, `-${String(i + 1).padStart(width, "0")}.${ext}`), new Uint8Array(await blob.arrayBuffer()), { compression: "STORE" });
        report(40 + Math.floor(((i + 1) / slices.length) * 55));
      }
      const blob = await zip.generateAsync({ type: "blob", mimeType: "application/zip" });
      report(100);
      return { blob, filename: name.replace(/\.\w+$/, ".zip") };
    },
  };
}

export const pngWriter = imageWriter("png");
export const jpegWriter = imageWriter("jpeg");

// A4 portrait; one page shows PAGE_HEIGHT CSS px of the 900px-wide chat.
const A4 = { widthPt: 595.28, heightPt: 841.89 };

export const pdfWriter: Writer = {
  id: "pdf",
  label: "PDF (WhatsApp look, searchable)",
  fileType: "PDF",
  description: "A4 pages; text can be searched and copied",
  limits: LIMITS,
  wantsAvatars: true,
  async write(b, onProgress) {
    const report = progress(onProgress);
    const { doc, laid } = await snapshot(b, report);
    const pageHeight = Math.round((laid.width * A4.heightPt) / A4.widthPt);
    const slices = paginate(laid.blocks, laid.height, pageHeight);
    const pages: PdfPage[] = [];
    for (const [i, s] of slices.entries()) {
      const canvas = await rasterize(doc, laid, s, 2, pageHeight);
      const jpeg = new Uint8Array(await (await canvasBlob(canvas, "image/jpeg", 0.88)).arrayBuffer());
      const lines = linesIn(laid.lines, s);
      pages.push({ jpeg, pixelWidth: canvas.width, pixelHeight: canvas.height, lines });
      report(40 + Math.floor(((i + 1) / slices.length) * 55));
    }
    const pdf = buildPdf(pages, { ...A4, cssWidth: laid.width, cssHeight: pageHeight });
    report(100);
    return { blob: new Blob([pdf], { type: "application/pdf" }), filename: exportFilename(b.chat.name, b.exportedAt, "pdf") };
  },
};
