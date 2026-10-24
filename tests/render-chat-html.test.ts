// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderChatHtml, type HtmlPart } from "../src/export/render-chat-html";
import type { ExportBundle, ExportProblem, ExportRecord } from "../src/types";
import { media, record } from "./fixtures/messages";

const T = 1792845296; // 2026-10-24 06:34 at UTC-6
const DAY = 24 * 3600;

function bundle(records: ExportRecord[], extra: Partial<ExportBundle> = {}): ExportBundle {
  return {
    chat: { jid: "120363@g.us", name: "Frontend team" },
    exportedAt: new Date(1792850000 * 1000),
    records,
    media: new Map(),
    problems: records.flatMap((r) => r.problems),
    ...extra,
  };
}

/** Joins the parts, writing each media placeholder as the writer would (one base64 block). */
function html(parts: HtmlPart[]): string {
  return parts
    .map((p) => (typeof p === "string" ? p : `<script type="application/octet-stream" data-for="${p.id}">QUJD</script>`))
    .join("");
}

function render(b: ExportBundle) {
  const parts = renderChatHtml(b, { locale: "en-US" });
  return { parts, doc: new DOMParser().parseFromString(html(parts), "text/html") };
}

const exported = (path: string, mime: string, filename: string | null = null, size = 2048) => ({
  exportedMedia: { path, mime, filename, size, source: "wa-js" as const },
});
const problem = (messageId: string, code: ExportProblem["code"]): ExportProblem => ({ messageId, code, detail: "x" });

describe("renderChatHtml", () => {
  it("is a complete page titled after the chat, with a CSP that blocks the network", () => {
    const { parts, doc } = render(bundle([record({ timestamp: T })]));
    expect((parts[0] as string).startsWith("<!doctype html>")).toBe(true);
    expect(doc.title).toBe("Frontend team");
    const csp = doc.querySelector('meta[http-equiv="Content-Security-Policy"]')!.getAttribute("content")!;
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toMatch(/https?:/);
    expect(doc.querySelectorAll("link, script[src], img[src], iframe")).toHaveLength(0);
  });

  it("header shows the chat name, message count and a Save as PDF button", () => {
    const { doc } = render(bundle([record({ timestamp: T }), record({ timestamp: T })]));
    expect(doc.querySelector(".chat-name")!.textContent).toBe("Frontend team");
    expect(doc.querySelector(".sub")!.textContent).toMatch(/^2 messages · exported October 24, 2026/);
    expect(doc.querySelector("#print")!.textContent).toBe("Save as PDF");
  });

  it("puts my messages on the right and others on the left", () => {
    const { doc } = render(bundle([record({ timestamp: T, text: "hi" }), record({ timestamp: T, fromMe: true, text: "yo" })]));
    const msgs = [...doc.querySelectorAll(".msg")];
    expect(msgs.map((m) => m.classList.contains("out"))).toEqual([false, true]);
  });

  it("shows a day chip once per day and the local time in each bubble", () => {
    const { doc } = render(bundle([record({ timestamp: T }), record({ timestamp: T + 60 }), record({ timestamp: T + DAY })]));
    expect([...doc.querySelectorAll(".day")].map((d) => d.textContent)).toEqual(["October 24, 2026", "October 25, 2026"]);
    expect(doc.querySelector(".msg .meta")!.textContent).toBe("06:34 AM");
  });

  it("in groups, names the sender on the first bubble of each run only", () => {
    const ana = { jid: "123@c.us", name: "Ana" };
    const luis = { jid: "456@c.us", name: "Luis" };
    const { doc } = render(
      bundle([record({ timestamp: T, sender: ana }), record({ timestamp: T, sender: ana }), record({ timestamp: T, sender: luis })]),
    );
    expect([...doc.querySelectorAll(".msg")].map((m) => m.querySelector(".name")?.textContent ?? null)).toEqual(["Ana", null, "Luis"]);
    expect([...doc.querySelectorAll(".msg")].map((m) => m.classList.contains("first"))).toEqual([true, false, true]);
  });

  it("does not name the other person in a 1:1 chat", () => {
    const { doc } = render(bundle([record({ timestamp: T })], { chat: { jid: "123@c.us", name: "Ana" } }));
    expect(doc.querySelector(".name")).toBeNull();
  });

  it("escapes text and renders WhatsApp formatting", () => {
    const { doc } = render(bundle([record({ timestamp: T, text: "<b>x</b> *bold*" })]));
    const text = doc.querySelector(".text")!;
    expect(text.querySelector("b")).toBeNull();
    expect(text.querySelector("strong")!.textContent).toBe("bold");
    expect(text.textContent).toContain("<b>x</b>");
  });

  it("escapes the chat and sender names", () => {
    const { doc } = render(bundle([record({ timestamp: T, sender: { jid: "1@c.us", name: '<img src=x onerror="1">' } }), record({ timestamp: T, sender: { jid: "2@c.us", name: "B" } })], { chat: { jid: "1@g.us", name: "<script>x</script>" } }));
    expect(doc.title).toBe("<script>x</script>");
    expect(doc.querySelectorAll("img")).toHaveLength(1); // only the lightbox's
  });

  it("shows Forwarded and a reply box with the quoted sender and text", () => {
    const { doc } = render(
      bundle([
        record({
          timestamp: T,
          isForwarded: true,
          quoted: { id: "Q", fromMe: false, senderName: "Luis", timestamp: T - 60, text: "Does it _work_?", kind: null },
        }),
      ]),
    );
    expect(doc.querySelector(".forwarded")!.textContent).toBe("↪ Forwarded");
    expect(doc.querySelector(".quote-name")!.textContent).toBe("Luis");
    expect(doc.querySelector(".quote-text em")!.textContent).toBe("work");
  });

  it("a reply to my own media says You and names the media kind", () => {
    const { doc } = render(
      bundle([record({ timestamp: T, quoted: { id: "Q", fromMe: true, senderName: null, timestamp: null, text: "", kind: "video" } })]),
    );
    expect(doc.querySelector(".quote-name")!.textContent).toBe("You");
    expect(doc.querySelector(".quote-text")!.textContent).toBe("🎥 Video");
  });

  it("a reply to an unavailable message says so", () => {
    const { doc } = render(bundle([record({ timestamp: T, quotedUnavailable: true })]));
    expect(doc.querySelector(".quote-text")!.textContent).toBe("Message not available");
  });

  it("embeds a photo with its caption and leaves a placeholder for its bytes", () => {
    const r = record({ timestamp: T, text: "look", media: media("image", { mime: "image/jpeg" }) }, exported("media/001-photo.jpg", "image/jpeg"));
    const { parts, doc } = render(bundle([r]));
    const img = doc.querySelector("img.photo")!;
    const placeholder = parts.find((p) => typeof p !== "string") as Exclude<HtmlPart, string>;
    expect(placeholder).toEqual({ media: "media/001-photo.jpg", id: img.getAttribute("data-media"), mime: "image/jpeg" });
    expect(doc.querySelector(`script[data-for="${placeholder.id}"]`)).not.toBeNull();
    expect(img.getAttribute("data-mime")).toBe("image/jpeg");
    expect(doc.querySelector(".msg .text")!.textContent).toBe("look06:34 AM");
  });

  it("plays videos and voice notes inline, with the voice note's duration", () => {
    const v = record({ timestamp: T, text: "", media: media("video", { mime: "video/mp4" }) }, exported("media/001-video.mp4", "video/mp4"));
    const a = record({ timestamp: T, text: "", media: media("voice", { mime: "audio/ogg", durationSec: 42 }) }, exported("media/002-voice-note.ogg", "audio/ogg"));
    const { doc } = render(bundle([v, a]));
    expect(doc.querySelector("video[data-media][controls]")).not.toBeNull();
    expect(doc.querySelector("audio[data-media][controls]")).not.toBeNull();
    expect(doc.querySelector(".dur")!.textContent).toBe("0:42");
  });

  it("shows documents as a download card with name, type and size, without repeating the name as caption", () => {
    const r = record(
      { timestamp: T, text: "design-spec.pdf", media: media("document", { mime: "application/pdf", filename: "design-spec.pdf" }) },
      exported("media/001-design-spec.pdf", "application/pdf", "design-spec.pdf", 1258291),
    );
    const { doc } = render(bundle([r]));
    const a = doc.querySelector("a.doc")!;
    expect(a.getAttribute("download")).toBe("design-spec.pdf");
    expect(a.querySelector(".doc-name")!.textContent).toBe("design-spec.pdf");
    expect(a.querySelector(".doc-meta")!.textContent).toBe("PDF · 1.2 MB");
    expect(doc.querySelector(".msg .text")).toBeNull();
  });

  it("stickers have no bubble", () => {
    const r = record({ timestamp: T, text: "", media: media("sticker", { mime: "image/webp" }) }, exported("media/001-sticker.webp", "image/webp"));
    const { doc } = render(bundle([r]));
    expect(doc.querySelector(".msg")!.classList.contains("bare")).toBe(true);
    expect(doc.querySelector("img.sticker")).not.toBeNull();
  });

  it("marks missing media in the bubble and lists every problem at the top", () => {
    const r = record({ timestamp: T, sender: { jid: "123@c.us", name: "Ana" }, media: media("image", { filename: "plan.jpg" }) });
    r.problems.push(problem(r.id, "media_expired"));
    const { doc } = render(bundle([r], { problems: [...r.problems, problem("GONE", "message_not_found")] }));
    expect(doc.querySelector(".missing")!.textContent).toBe("⚠️ Image missing (plan.jpg): expired on WhatsApp, not re-requested");
    expect([...doc.querySelectorAll(".problems li")].map((li) => li.textContent)).toEqual([
      "Ana at 2026-10-24 06:34: Image plan.jpg expired on WhatsApp, not re-requested",
      "Message GONE: this message could not be read",
    ]);
  });

  it("no problems box when there are none", () => {
    expect(render(bundle([record({ timestamp: T })])).doc.querySelector(".problems")).toBeNull();
  });

  it("shows deleted and unsupported messages", () => {
    const del = record({ timestamp: T, type: "revoked", text: "" });
    const poll = record({ timestamp: T, type: "poll_creation", text: "" }, { problems: [] });
    poll.problems.push(problem(poll.id, "unsupported_type"));
    const { doc } = render(bundle([del, poll]));
    const texts = [...doc.querySelectorAll(".text.deleted")].map((t) => t.firstChild!.textContent);
    expect(texts).toEqual(["🚫 This message was deleted", "Unsupported message (poll_creation): can't be exported yet"]);
  });
});
