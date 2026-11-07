import { MAX_BYTES, WARN_BYTES } from "../collect";
import { exportFilename } from "../naming";
import { renderChatMd } from "../render-chat-md";
import { renderMessagesJson } from "../render-json";
import { writerCatalog } from "./catalog";
import type { Writer } from "./index";
import { buildZip, type ZipEntry } from "./zip-archive";

export const zipWriter: Writer = {
  ...writerCatalog.zip,
  limits: { warnBytes: WARN_BYTES, maxBytes: MAX_BYTES, hint: "Select fewer large files." },
  /** chat.md and messages.json (deflated) plus every media file (stored), in one ZIP. */
  async write(b, onProgress) {
    const entries: ZipEntry[] = [
      { path: "chat.md", data: renderChatMd(b), compress: true },
      { path: "messages.json", data: renderMessagesJson(b), compress: true },
    ];
    for (const [path, blob] of b.media) {
      // Firefox content scripts: bytes from the page (postMessage, Blob reads) deny `.constructor`
      // to libraries, which can then fail silently. A structuredClone made here is our own.
      entries.push({ path, data: new Uint8Array(structuredClone(await blob.arrayBuffer())), compress: false });
    }
    const blob = await buildZip(entries, onProgress);
    return { blob, filename: exportFilename(b.chat.name, b.exportedAt) };
  },
};
