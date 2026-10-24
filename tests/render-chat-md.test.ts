import { describe, expect, it } from "vitest";
import { problemText } from "../src/export/problems";
import { formatLocal, renderChatMd } from "../src/export/render-chat-md";
import type { ExportBundle, ExportProblem, ExportRecord } from "../src/types";
import { media, record } from "./fixtures/messages";

const T = 1792845296; // 2026-10-24 06:34 at UTC-6

function bundle(records: ExportRecord[], problems: ExportProblem[] = records.flatMap((r) => r.problems)): ExportBundle {
  return {
    chat: { jid: "1@g.us", name: "Frontend team" },
    exportedAt: new Date(1792850000 * 1000),
    records,
    media: new Map(),
    problems,
  };
}

const problem = (messageId: string | null, code: ExportProblem["code"]): ExportProblem => ({ messageId, code, detail: "x" });

describe("formatLocal", () => {
  it("renders local YYYY-MM-DD HH:mm", () => {
    expect(formatLocal(T)).toBe("2026-10-24 06:34");
    expect(formatLocal(null)).toBe("unknown time");
  });
});

describe("problemText", () => {
  it("uses plain language", () => {
    expect(problemText(problem(null, "media_not_found"))).toBe("could not be downloaded from WhatsApp");
    expect(problemText(problem(null, "media_expired"))).toBe("expired on WhatsApp, not re-requested");
    expect(problemText(problem(null, "view_once_skipped"))).toBe("view-once media, skipped on purpose");
    expect(problemText(problem(null, "message_not_found"))).toBe("this message could not be read");
  });
});

describe("renderChatMd", () => {
  it("header shows chat name, time and count", () => {
    const md = renderChatMd(bundle([record(), record()]));
    expect(md.startsWith("# WhatsApp export: Frontend team\n\nExported: 2026-10-24 07:53 · 2 messages\n")).toBe(true);
  });

  it("says 1 message in the singular and falls back to Unknown chat", () => {
    const b = bundle([record()]);
    b.chat.name = null;
    expect(renderChatMd(b)).toContain("# WhatsApp export: Unknown chat\n\nExported: 2026-10-24 07:53 · 1 message\n");
  });

  it("no problems section when there are none", () => {
    expect(renderChatMd(bundle([record()]))).not.toContain("Export problems");
  });

  it("problems section lists each problem with sender and time", () => {
    const r = record(
      { timestamp: T, sender: { jid: "1", name: "Ana" }, media: media("image") },
      { problems: [problem("X", "media_not_found")] },
    );
    r.problems[0].messageId = r.id;
    expect(renderChatMd(bundle([r]))).toContain(
      "## Export problems\n\n- Ana at 2026-10-24 06:34: Image could not be downloaded from WhatsApp\n",
    );
  });

  it("message_not_found for an id with no record appears in problems section", () => {
    const md = renderChatMd(bundle([record()], [problem("GONE1", "message_not_found")]));
    expect(md).toContain("- Message GONE1: this message could not be read");
  });

  it("message heading shows sender and local time; fromMe renders as You", () => {
    const md = renderChatMd(bundle([record({ timestamp: T, sender: { jid: "1", name: "Ana" } }), record({ fromMe: true, timestamp: T, sender: { jid: null, name: null } })]));
    expect(md).toContain("## Ana — 2026-10-24 06:34\n");
    expect(md).toContain("## You — 2026-10-24 06:34\n");
  });

  it("falls back to the jid, then Unknown, for the sender", () => {
    const md = renderChatMd(bundle([record({ sender: { jid: "555@c.us", name: null } }), record({ sender: { jid: null, name: null } })]));
    expect(md).toContain("## 555@c.us — ");
    expect(md).toContain("## Unknown — ");
  });

  it("converts WhatsApp formatting in text", () => {
    expect(renderChatMd(bundle([record({ text: "this is *important*" })]))).toContain("this is **important**");
  });

  it("image renders inline, caption text above it", () => {
    const r = record(
      { text: "the bug", media: media("image", { mime: "image/jpeg" }) },
      { exportedMedia: { path: "media/001-photo.jpg", mime: "image/jpeg", filename: null, size: 100, source: "wa-js" } },
    );
    expect(renderChatMd(bundle([r]))).toContain("the bug\n\n![](media/001-photo.jpg)\n");
  });

  it("pdf renders as a 📎 link with size, without repeating the filename caption", () => {
    const r = record(
      { text: "design-spec.pdf", media: media("document", { mime: "application/pdf", filename: "design-spec.pdf", size: 1258291 }) },
      { exportedMedia: { path: "media/002-design-spec.pdf", mime: "application/pdf", filename: "design-spec.pdf", size: 1258291, source: "wa-js" } },
    );
    const md = renderChatMd(bundle([r]));
    expect(md).toContain("📎 [design-spec.pdf](media/002-design-spec.pdf) (PDF, 1.2 MB)");
    expect(md.match(/design-spec\.pdf/g)).toHaveLength(2); // link text + path only
  });

  it("voice note renders 🎤 with 0:42", () => {
    const r = record(
      { text: "", media: media("voice", { mime: "audio/ogg", durationSec: 42 }) },
      { exportedMedia: { path: "media/003-voice-note.ogg", mime: "audio/ogg", filename: null, size: 9000, source: "wa-js" } },
    );
    expect(renderChatMd(bundle([r]))).toContain("🎤 [voice note, 0:42](media/003-voice-note.ogg)");
  });

  it("missing image renders a warning where it happened", () => {
    const r = record({ text: "", media: media("image") }, { problems: [problem(null, "media_not_found")] });
    expect(renderChatMd(bundle([r]))).toContain("⚠️ Image missing: could not be downloaded from WhatsApp");
  });

  it("quoted reply renders blockquote with name and text", () => {
    const r = record({ quoted: { id: "Q", senderName: "Bob", timestamp: 1792845000, text: "Does it\nreproduce?" } });
    expect(renderChatMd(bundle([r]))).toContain(
      "> Replying to **Bob** — 2026-10-24 06:30\n>\n> Does it\n> reproduce?\n",
    );
  });

  it("quotedUnavailable renders the unavailable line", () => {
    expect(renderChatMd(bundle([record({ quotedUnavailable: true })]))).toContain("> Replying to a message that isn't available\n");
  });

  it("forwarded messages are labeled", () => {
    expect(renderChatMd(bundle([record({ isForwarded: true, text: "fwd" })]))).toContain("_↪ Forwarded_\n\nfwd");
  });

  it("revoked renders _(deleted message)_", () => {
    expect(renderChatMd(bundle([record({ type: "revoked", text: "" })]))).toContain("_(deleted message)_");
  });

  it("poll with no text renders unsupported line", () => {
    expect(renderChatMd(bundle([record({ type: "poll_creation", text: "" })]))).toContain("_(unsupported message type: poll_creation)_");
  });

  it("separates the header from messages with a rule", () => {
    expect(renderChatMd(bundle([record()]))).toMatch(/\n---\n\n## /);
  });
});
