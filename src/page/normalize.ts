// The only module that touches WhatsApp's raw model shapes. Everything else sees WaMessage.
import type { MediaKind, QuotedMessage, WaMediaInfo, WaMessage } from "../types";

const MEDIA_KINDS: Record<string, MediaKind> = {
  image: "image",
  video: "video",
  ptt: "voice",
  audio: "audio",
  document: "document",
  sticker: "sticker",
};

export function mediaKindOf(type: string): MediaKind | null {
  return MEDIA_KINDS[type] ?? null;
}

/** WhatsApp ids and wids: a string, a Wid with toString(), or `_serialized` / `$1` (renamed July 2026). */
export function idToString(id: unknown): string | null {
  if (id == null) return null;
  if (typeof id === "string") return id;
  if (typeof id !== "object") return null;
  const obj = id as { _serialized?: unknown; $1?: unknown; toString?: () => string };
  if (typeof obj._serialized === "string") return obj._serialized;
  if (typeof obj.$1 === "string") return obj.$1;
  try {
    const s = obj.toString?.();
    if (typeof s === "string" && s !== "[object Object]") return s;
  } catch {
    // fall through
  }
  return null;
}

function toNumber(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** For media messages `body` holds non-text data (e.g. a base64 thumbnail), so only `caption` is text. */
function textOf(raw: any): string {
  const kind = mediaKindOf(raw?.type ?? "");
  const value = kind ? raw?.caption : raw?.body;
  return typeof value === "string" ? value : "";
}

export function senderJidOf(raw: any): string | null {
  return idToString(raw?.author) ?? idToString(raw?.from);
}

function mediaOf(raw: any): WaMediaInfo | null {
  const kind = mediaKindOf(raw?.type ?? "");
  if (!kind) return null;
  return {
    kind,
    mime: raw.mimetype ?? raw.mediaData?.mimetype ?? null,
    filename: typeof raw.filename === "string" && raw.filename ? raw.filename : null,
    size: toNumber(raw.size),
    durationSec: toNumber(raw.duration),
  };
}

function quotedOf(raw: any, resolveName: (jid: string) => string | null, myJids: Set<string>): QuotedMessage | null {
  const q = raw?.quotedMsg;
  if (!q) return null;
  const participant = idToString(raw.quotedParticipant);
  return {
    id: typeof raw.quotedStanzaID === "string" ? raw.quotedStanzaID : null,
    // A quoted text keeps only {type, kind, body}, so "mine" may only show through the participant.
    fromMe: q.id?.fromMe === true || (!!participant && myJids.has(participant)),
    senderName: participant ? resolveName(participant) : null,
    timestamp: toNumber(q.t),
    text: textOf(q),
    kind: mediaKindOf(q.type ?? ""),
  };
}

export function normalizeMessage(
  raw: any,
  resolveName: (jid: string) => string | null,
  myJids: Set<string> = new Set(),
): WaMessage {
  const fromMe = Boolean(raw?.id?.fromMe);
  const jid = senderJidOf(raw);
  const quoted = quotedOf(raw, resolveName, myJids);
  return {
    id: idToString(raw?.id) ?? "",
    fromMe,
    type: typeof raw?.type === "string" ? raw.type : "unknown",
    timestamp: toNumber(raw?.t),
    sender: {
      jid,
      name: fromMe ? null : ((jid && resolveName(jid)) || raw?.notifyName || null),
    },
    text: textOf(raw),
    quoted,
    quotedUnavailable: !quoted && typeof raw?.quotedStanzaID === "string",
    media: mediaOf(raw),
    isViewOnce: Boolean(raw?.isViewOnce),
    isForwarded: Boolean(raw?.isForwarded),
  };
}
