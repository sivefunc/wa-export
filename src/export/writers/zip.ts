import JSZip from "jszip";
import { exportFilename } from "../naming";
import { renderChatMd } from "../render-chat-md";
import { renderMessagesJson } from "../render-json";
import type { Writer } from "./index";

export const zipWriter: Writer = {
  id: "zip",
  label: "ZIP (chat.md + messages.json + media/)",
  async write(b, onProgress) {
    const zip = new JSZip();
    zip.file("chat.md", renderChatMd(b));
    zip.file("messages.json", renderMessagesJson(b));
    for (const [path, blob] of b.media) {
      // Firefox content scripts: bytes from the page (postMessage, Blob reads) deny `.constructor`
      // to JSZip, which then hangs silently at 33%. A structuredClone made here is our own.
      const bytes = new Uint8Array(structuredClone(await blob.arrayBuffer()));
      // Photos, video and audio are already compressed; deflating them only burns CPU.
      zip.file(path, bytes, { compression: "STORE" });
    }
    let last = -1;
    const blob = await zip.generateAsync(
      { type: "blob", mimeType: "application/zip", compression: "DEFLATE", compressionOptions: { level: 6 } },
      ({ percent }) => {
        const pct = Math.floor(percent);
        if (pct > last) onProgress?.((last = pct));
      },
    );
    if (last < 100) onProgress?.(100);
    return { blob, filename: exportFilename(b.chat.name, b.exportedAt) };
  },
};
