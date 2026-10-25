// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderChatSnapshot, snapshotCss } from "../src/export/render-chat-html";
import type { ExportBundle, ExportRecord } from "../src/types";
import { media, record } from "./fixtures/messages";

const T = 1792845296;
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const JPG = "data:image/jpeg;base64,/9j/4AAQ";

function bundle(records: ExportRecord[], extra: Partial<ExportBundle> = {}): ExportBundle {
  return { chat: { jid: "1@g.us", name: "Team" }, exportedAt: new Date(T * 1000), records, media: new Map(), problems: records.flatMap((r) => r.problems), ...extra };
}
const exported = (path: string, mime: string, filename: string | null = null) => ({ exportedMedia: { path, mime, filename, size: 2048, source: "wa-js" as const } });
const parse = (html: string) => new DOMParser().parseFromString(`<div class="wa">${html}</div>`, "text/html");

function render(records: ExportRecord[], srcs: Record<string, string> = {}, posters: Record<string, string> = {}, extra: Partial<ExportBundle> = {}) {
  const pieces = renderChatSnapshot(bundle(records, extra), { locale: "en-US", srcs: new Map(Object.entries(srcs)), posters: new Map(Object.entries(posters)) });
  return { pieces, doc: parse(pieces.header + pieces.blocks.join("") + pieces.end) };
}

describe("renderChatSnapshot", () => {
  it("has no script, controls, buttons or placeholders", () => {
    const { doc } = render([record({ timestamp: T, media: media("video", { mime: "video/mp4" }) }, exported("media/001-video.mp4", "video/mp4"))]);
    expect(doc.querySelectorAll("script, button, video, audio, a[download], [data-media]")).toHaveLength(0);
  });

  it("cuts the page into a header, one block per day chip, problem box and message, and the end note", () => {
    const r = record({ timestamp: T, media: media("image") });
    r.problems.push({ messageId: r.id, code: "media_expired", detail: "x" });
    const { pieces } = render([r, record({ timestamp: T + 60 })]);
    expect(pieces.title).toBe("Team");
    expect(pieces.header).toMatch(/^<header class="top">/);
    expect(pieces.blocks.map((b) => b.match(/class="([a-z]+)/)![1])).toEqual(["system", "day", "row", "row"]);
    expect(pieces.end).toContain("Exported with WA Export");
  });

  it("uses the prepared data: URLs for photos, stickers and profile pictures", () => {
    const photo = record({ timestamp: T, sender: { jid: "123@lid", name: "Ana" }, media: media("image", { mime: "image/jpeg" }) }, exported("media/001-photo.jpg", "image/jpeg"));
    const sticker = record({ timestamp: T, media: media("sticker", { mime: "image/webp" }) }, exported("media/002-sticker.webp", "image/webp"));
    const { doc } = render([photo, sticker], { "media:media/001-photo.jpg": JPG, "media:media/002-sticker.webp": PNG, "avatars:123@lid": JPG }, {}, {
      avatars: new Map([["123@lid", new Blob([], { type: "image/jpeg" })]]),
    });
    expect(doc.querySelector("img.photo")!.getAttribute("src")).toBe(JPG);
    expect(doc.querySelector("img.sticker")!.getAttribute("src")).toBe(PNG);
    expect(doc.querySelector("img.pp")!.getAttribute("src")).toBe(JPG);
  });

  it("a photo that couldn't be prepared becomes a labeled card", () => {
    const { doc } = render([record({ timestamp: T, media: media("image", { mime: "image/jpeg" }) }, exported("media/001-photo.jpg", "image/jpeg"))]);
    expect(doc.querySelector("img.photo")).toBeNull();
    expect(doc.querySelector(".missing")!.textContent).toBe("📷 Image");
  });

  it("shows a video as its first frame with a play badge and duration", () => {
    const v = record({ timestamp: T, media: media("video", { mime: "video/mp4", durationSec: 4 }) }, exported("media/001-video.mp4", "video/mp4"));
    const withFrame = render([v], {}, { "media/001-video.mp4": JPG }).doc;
    expect(withFrame.querySelector(".video.still img.frame")!.getAttribute("src")).toBe(JPG);
    expect(withFrame.querySelector(".video.still .play")!.textContent).toBe("▶");
    expect(withFrame.querySelector(".video.still .vdur")!.textContent).toBe("🎥 0:04");
    expect(render([v]).doc.querySelector(".video.still img")).toBeNull();
  });

  it("shows a voice note as a drawn player that is the same every time", () => {
    const voice = record({ id: "VOICE1", timestamp: T, media: media("voice", { mime: "audio/ogg", durationSec: 42 }) }, exported("media/001-voice-note.ogg", "audio/ogg"));
    const a = render([voice]).doc;
    expect(a.querySelector(".audio.still .dur")!.textContent).toBe("0:42");
    expect(a.querySelectorAll(".wave i").length).toBe(28);
    expect(render([voice]).doc.querySelector(".wave")!.innerHTML).toBe(a.querySelector(".wave")!.innerHTML);
  });

  it("shows a document as a card, not a link", () => {
    const d = record({ timestamp: T, media: media("document", { mime: "application/pdf", filename: "spec.pdf" }) }, exported("media/001-spec.pdf", "application/pdf", "spec.pdf"));
    const { doc } = render([d]);
    expect(doc.querySelector("div.doc .doc-name")!.textContent).toBe("spec.pdf");
  });

  it("the header has no Save as PDF button", () => {
    expect(render([record({ timestamp: T })]).pieces.header).not.toContain("Save as PDF");
  });

  it("snapshotCss fixes one theme on the .wa root", () => {
    expect(snapshotCss(false)).toContain("--bg: #efeae2");
    expect(snapshotCss(true)).toContain("--bg: #0b141a");
    expect(snapshotCss(true)).not.toContain("prefers-color-scheme");
    expect(snapshotCss(false)).toContain(".wa .top { position: static; }");
  });
});
