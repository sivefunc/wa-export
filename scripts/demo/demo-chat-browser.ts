// The fictional "Bamboo team" chat, built from any source of the demo asset files (no Node APIs here,
// so the browser checks can bundle it).
import type { ExportBundle, ExportRecord, MediaKind } from "../../src/types";

const T0 = Date.UTC(2026, 9, 24, 10, 0) / 1000;
const BAO = { jid: "100000000000001@lid", name: "Bao the Panda" };
const MEI = { jid: "100000000000002@lid", name: "Mei" };
const ME = { jid: null, name: null };

/** The same chat from any source of the asset files (the browser checks pass them in). */
export function demoChatFrom(file: (name: string, mime: string) => Blob): ExportBundle {
  const media = new Map<string, Blob>();
  let n = 0;
  let minute = 0;
  const msg = (sender: typeof BAO | typeof ME, o: Partial<ExportRecord> = {}): ExportRecord => ({
    id: `DEMO${++n}`,
    fromMe: sender === ME,
    type: "chat",
    timestamp: T0 + (minute += 1) * 60,
    sender,
    text: "",
    quoted: null,
    quotedUnavailable: false,
    media: null,
    isViewOnce: false,
    isForwarded: false,
    exportedMedia: null,
    problems: [],
    ...o,
  });
  const withMedia = (sender: typeof BAO | typeof ME, kind: MediaKind, name: string, mime: string, o: Partial<ExportRecord> = {}) => {
    const path = `media/${String(media.size + 1).padStart(3, "0")}-${name}`;
    const blob = file(name, mime);
    media.set(path, blob);
    const filename = kind === "document" ? name : null;
    return msg(sender, {
      type: { image: "image", video: "video", voice: "ptt", audio: "audio", document: "document", sticker: "sticker" }[kind],
      media: { kind, mime, filename, size: blob.size, durationSec: kind === "voice" ? 6 : kind === "video" ? 4 : null },
      exportedMedia: { path, mime, filename, size: blob.size, source: "wa-js" },
      ...o,
    });
  };

  const records: ExportRecord[] = [
    msg(BAO, { text: "Morning! 🎋 Who's trying the *new export* today?" }),
    msg(ME, { text: "Me! Selecting a few messages now" }),
    withMedia(MEI, "image", "photo-mockup.jpg", "image/jpeg", { text: "Here's the mockup for v0.2" }),
    withMedia(BAO, "sticker", "sticker-bao.webp", "image/webp"),
    msg(ME, {
      text: "Love it. The _menu_ looks just like WhatsApp's",
      quoted: { id: "DEMO3", fromMe: false, senderName: MEI.name, timestamp: null, text: "Here's the mockup for v0.2", kind: "image" },
    }),
    withMedia(MEI, "voice", "voice-note.ogg", "audio/ogg; codecs=opus"),
    withMedia(BAO, "document", "release-notes.pdf", "application/pdf", { text: "release-notes.pdf", isForwarded: true }),
    withMedia(ME, "video", "demo-clip.mp4", "video/mp4", { text: "Quick demo of the animation" }),
    msg(MEI, { text: "Run it with `pnpm build && pnpm test` ✅" }),
    msg(BAO, { text: "Repo: https://github.com/sivefunc/wa-export" }),
  ];
  return {
    chat: { jid: "100000000000000@g.us", name: "Bamboo team" },
    exportedAt: new Date((T0 + 15 * 60) * 1000),
    records,
    media,
    problems: [],
    avatars: new Map([
      ["100000000000000@g.us", file("avatar-group.jpg", "image/jpeg")],
      [BAO.jid, file("avatar-bao.jpg", "image/jpeg")],
      [MEI.jid, file("avatar-mei.jpg", "image/jpeg")],
    ]),
  };
}
