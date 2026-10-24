import type { MediaKind, WaMessage } from "../types";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "application/pdf": "pdf",
};

const KIND_STEMS: Record<MediaKind, string> = {
  image: "photo",
  video: "video",
  voice: "voice-note",
  audio: "audio",
  document: "file",
  sticker: "sticker",
};

const trimEdges = (s: string) => s.replace(/^[.\- ]+|[.\- ]+$/g, "");

/** A filename that is safe inside a ZIP on any OS: letters, digits, `._ -`, no traversal. */
export function sanitizeFilename(name: string, maxLen = 80): string {
  const cleaned = trimEdges(
    name
      .normalize("NFC")
      .replace(/[^\p{L}\p{N}._ -]+/gu, "-")
      .replace(/\.{2,}/g, ".")
      .replace(/\s*-[\s-]*/g, "-")
      .replace(/-+\./g, ".")
      .replace(/\.-+/g, "."),
  );
  return trimEdges(cleaned.slice(0, maxLen)) || "file";
}

export function extensionFor(mime: string | null, filename: string | null): string {
  const fromName = filename?.match(/\.([A-Za-z0-9]{1,8})$/)?.[1];
  if (fromName) return fromName.toLowerCase();
  const base = mime?.split(";")[0].trim().toLowerCase();
  return (base && MIME_EXTENSIONS[base]) || "bin";
}

/** media/<NNN>-<stem>.<ext> for each media message, numbered in the given order. */
export function assignMediaPaths(records: WaMessage[]): Map<string, string> {
  const paths = new Map<string, string>();
  let index = 0;
  for (const r of records) {
    if (!r.media) continue;
    index += 1;
    const { filename, mime, kind } = r.media;
    const stem = filename ? sanitizeFilename(filename.replace(/\.[^.]+$/, ""), 60) : KIND_STEMS[kind];
    paths.set(r.id, `media/${String(index).padStart(3, "0")}-${stem}.${extensionFor(mime, filename)}`);
  }
  return paths;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function exportFilename(chatName: string | null, at: Date, ext = "zip"): string {
  const name = chatName ? sanitizeFilename(chatName, 60) : "whatsapp-export";
  const stamp = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}`;
  return `${name}-${stamp}.${ext}`;
}
