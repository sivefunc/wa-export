import { describe, expect, it } from "vitest";
import { idToString, mediaKindOf, normalizeMessage } from "../src/page/normalize";
import * as raw from "./fixtures/raw-messages";

const names: Record<string, string> = { "123@c.us": "Ana Contact", "456@c.us": "Luis Contact" };
const resolveName = (jid: string) => names[jid] ?? null;

describe("normalizeMessage", () => {
  it("uses caption, never body, for image messages", () => {
    const m = normalizeMessage(raw.imageWithCaption, resolveName);
    expect(m.text).toBe("the caption");
    expect(JSON.stringify(m)).not.toContain(raw.BASE64_THUMBNAIL.slice(0, 40));
    expect(m.media).toEqual({ kind: "image", mime: "image/jpeg", filename: null, size: 204800, durationSec: null });
  });

  it("uses empty text, not the body, for a document without caption", () => {
    const m = normalizeMessage(raw.pdfDocument, resolveName);
    expect(m.text).toBe("");
    expect(m.media?.filename).toBe("design-spec.pdf");
    expect(JSON.stringify(m)).not.toContain(raw.BASE64_THUMBNAIL.slice(0, 40));
  });

  it("uses body for chat messages", () => {
    const m = normalizeMessage(raw.chatText, resolveName);
    expect(m.text).toBe("*bold* and _italic_");
    expect(m.media).toBeNull();
    expect(m.timestamp).toBe(1792845296);
  });

  it("reads ids serialized as _serialized and as $1", () => {
    expect(normalizeMessage(raw.chatText, resolveName).id).toBe("false_123@c.us_AAA");
    expect(normalizeMessage(raw.idAsDollarOne, resolveName).id).toBe("true_123@c.us_DOLLAR");
    expect(idToString(raw.wid$1("x@c.us"))).toBe("x@c.us");
    expect(idToString("plain")).toBe("plain");
    expect(idToString({ toString: () => "custom@c.us" })).toBe("custom@c.us");
    expect(idToString(null)).toBeNull();
  });

  it("group message: sender jid is author, not the group", () => {
    const m = normalizeMessage(raw.groupMessage, resolveName);
    expect(m.sender).toEqual({ jid: "456@c.us", name: "Luis Contact" });
  });

  it("falls back to notifyName when the contact has no name", () => {
    const m = normalizeMessage(raw.groupMessage, () => null);
    expect(m.sender.name).toBe("Luis");
  });

  it("fromMe message has sender.name null", () => {
    const m = normalizeMessage(raw.ownMessage, resolveName);
    expect(m.fromMe).toBe(true);
    expect(m.sender.name).toBeNull();
  });

  it("voice note: kind voice, durationSec 42", () => {
    const m = normalizeMessage(raw.voiceNote, resolveName);
    expect(m.media?.kind).toBe("voice");
    expect(m.media?.durationSec).toBe(42);
    expect(m.text).toBe("");
  });

  it("quotedStanzaID without quotedMsg → quotedUnavailable true", () => {
    const m = normalizeMessage(raw.replyWithMissingQuote, resolveName);
    expect(m.quoted).toBeNull();
    expect(m.quotedUnavailable).toBe(true);
  });

  it("quoted message carries id, sender name, time and text", () => {
    const m = normalizeMessage(raw.replyWithQuote, resolveName);
    expect(m.quoted).toEqual({
      id: "OLD",
      senderName: "Luis Contact",
      timestamp: 1792845000,
      text: "Does this reproduce in Firefox?",
    });
    expect(m.quotedUnavailable).toBe(false);
  });

  it("revoked message normalizes with empty text and media null", () => {
    const m = normalizeMessage(raw.revoked, resolveName);
    expect(m.type).toBe("revoked");
    expect(m.text).toBe("");
    expect(m.media).toBeNull();
  });
});

describe("mediaKindOf", () => {
  it("maps WhatsApp types to media kinds", () => {
    expect(mediaKindOf("image")).toBe("image");
    expect(mediaKindOf("ptt")).toBe("voice");
    expect(mediaKindOf("audio")).toBe("audio");
    expect(mediaKindOf("document")).toBe("document");
    expect(mediaKindOf("sticker")).toBe("sticker");
    expect(mediaKindOf("video")).toBe("video");
    expect(mediaKindOf("chat")).toBeNull();
    expect(mediaKindOf("poll_creation")).toBeNull();
  });
});
