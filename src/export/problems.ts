import type { ExportProblem, MediaKind, ProblemCode } from "../types";

const TEXT: Record<ProblemCode, string> = {
  media_not_found: "could not be downloaded from WhatsApp",
  media_expired: "expired on WhatsApp, not re-requested",
  media_timeout: "download timed out",
  view_once_skipped: "view-once media, skipped on purpose",
  message_not_found: "this message could not be read",
  media_error: "could not be exported",
  unsupported_type: "can't be exported yet",
};

const KIND_LABELS: Record<MediaKind, string> = {
  image: "Image",
  video: "Video",
  voice: "Voice note",
  audio: "Audio",
  document: "File",
  sticker: "Sticker",
};

/** Plain language for people; the code and detail go to messages.json. */
export function problemText(p: ExportProblem): string {
  return TEXT[p.code];
}

export function mediaKindLabel(kind: MediaKind | null | undefined): string {
  return kind ? KIND_LABELS[kind] : "File";
}
