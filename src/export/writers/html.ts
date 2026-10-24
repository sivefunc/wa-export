import { exportFilename } from "../naming";
import { renderChatHtml } from "../render-chat-html";
import type { Writer } from "./index";

// Base64 per block: a multiple of 3 bytes so blocks concatenate, and small enough that no single string
// (in this script or in the page that decodes it) comes near browser string limits.
const BLOCK_BYTES = 6 * 1024 * 1024;

function base64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export const htmlWriter: Writer = {
  id: "html",
  label: "HTML (WhatsApp look, opens in any browser)",
  fileType: "HTML",
  // Base64 adds a third, and the browser opening the page holds all of it in memory.
  limits: { warnBytes: 200 * 1024 * 1024, maxBytes: 500 * 1024 * 1024, hint: "Select fewer large files, or export as ZIP." },
  async write(b, onProgress) {
    const parts = renderChatHtml(b);
    const blobs = parts.flatMap((p) => (typeof p !== "string" && b.media.has(p.media) ? [b.media.get(p.media)!] : []));
    const total = blobs.reduce((sum, blob) => sum + blob.size, 0);
    let done = 0;
    let last = -1;
    const report = (pct: number) => {
      if (pct > last) onProgress?.((last = pct));
    };
    report(0);

    const out: BlobPart[] = [];
    for (const p of parts) {
      if (typeof p === "string") {
        out.push(p);
        continue;
      }
      const blob = b.media.get(p.media);
      if (!blob) continue;
      // Firefox content scripts: page-world bytes deny `.constructor`; a structuredClone made here is our own.
      const bytes = new Uint8Array(structuredClone(await blob.arrayBuffer()));
      for (let i = 0; i < bytes.length; i += BLOCK_BYTES) {
        const block = bytes.subarray(i, i + BLOCK_BYTES);
        out.push(`<script type="application/octet-stream" data-for="${p.id}">`, base64(block), "</script>\n");
        done += block.length;
        report(total ? Math.floor((done / total) * 99) : 0);
      }
    }
    report(100);
    return { blob: new Blob(out, { type: "text/html;charset=utf-8" }), filename: exportFilename(b.chat.name, b.exportedAt, "html") };
  },
};
