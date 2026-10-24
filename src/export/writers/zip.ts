import JSZip from "jszip";
import { exportFilename } from "../naming";
import { renderChatMd } from "../render-chat-md";
import { renderMessagesJson } from "../render-json";
import type { Writer } from "./index";

export const zipWriter: Writer = {
  id: "zip",
  label: "ZIP (chat.md + messages.json + media/)",
  async write(b) {
    const zip = new JSZip();
    zip.file("chat.md", renderChatMd(b));
    zip.file("messages.json", renderMessagesJson(b));
    // Photos, video and audio are already compressed; deflating them only burns CPU.
    for (const [path, blob] of b.media) zip.file(path, blob, { compression: "STORE" });
    const blob = await zip.generateAsync({
      type: "blob",
      mimeType: "application/zip",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    return { blob, filename: exportFilename(b.chat.name, b.exportedAt) };
  },
};
