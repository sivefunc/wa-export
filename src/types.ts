export type MediaKind = "image" | "video" | "voice" | "audio" | "document" | "sticker";

export interface WaMediaInfo {
  kind: MediaKind;
  mime: string | null;
  filename: string | null; // original filename, if WhatsApp has one
  size: number | null; // bytes
  durationSec: number | null; // voice/audio/video
}

export interface QuotedMessage {
  id: string | null;
  fromMe: boolean;
  senderName: string | null;
  timestamp: number | null; // unix seconds
  text: string;
  kind: MediaKind | null; // what was quoted, when it was media
}

export interface WaMessage {
  id: string; // the DOM data-id string, verbatim
  fromMe: boolean;
  type: string; // raw WhatsApp type: chat, image, ptt, document, revoked, ...
  timestamp: number | null; // unix seconds
  sender: { jid: string | null; name: string | null };
  text: string; // caption for media messages, body otherwise; "" if none
  quoted: QuotedMessage | null;
  quotedUnavailable: boolean; // reply to a message whose content couldn't be loaded
  media: WaMediaInfo | null;
  isViewOnce: boolean;
  isForwarded: boolean;
}

export type ProblemCode =
  | "message_not_found"
  | "media_not_found"
  | "media_expired"
  | "media_timeout"
  | "view_once_skipped"
  | "media_error"
  | "unsupported_type";

export interface ExportProblem {
  messageId: string | null;
  code: ProblemCode;
  detail: string; // technical detail for messages.json
}

export interface ExportedMedia {
  path: string; // e.g. "media/002-design-spec.pdf"
  mime: string;
  filename: string | null;
  size: number;
  source: "wa-js";
}

export interface ExportRecord extends WaMessage {
  exportedMedia: ExportedMedia | null;
  problems: ExportProblem[]; // this message's problems
}

export interface ChatInfo {
  jid: string | null;
  name: string | null;
}

export interface ExportBundle {
  chat: ChatInfo;
  exportedAt: Date;
  records: ExportRecord[]; // already ordered
  media: Map<string, Blob>; // path → bytes
  problems: ExportProblem[]; // every problem, including message_not_found for ids with no record
}
