/**
 * What each export format is called, without its code. Settings and the settings page read this,
 * so they don't bundle the writers (and their ZIP, PDF and image code); each writer spreads its
 * own entry.
 */
export interface WriterInfo {
  id: string;
  label: string;
  fileType: string; // short name for progress and the settings menu, e.g. "ZIP"
  description: string; // one line under fileType in the settings menu
}

export const writerCatalog = {
  zip: { id: "zip", label: "ZIP (chat.md + messages.json + media/)", fileType: "ZIP", description: "Markdown + files, for Claude Code" },
  html: { id: "html", label: "HTML (WhatsApp look, opens in any browser)", fileType: "HTML", description: "Looks like WhatsApp, in any browser" },
  pdf: { id: "pdf", label: "PDF (WhatsApp look, searchable)", fileType: "PDF", description: "A4 pages; text can be searched and copied" },
  png: { id: "png", label: "PNG image (WhatsApp look)", fileType: "PNG", description: "One sharp image of the chat" },
  jpeg: { id: "jpeg", label: "JPEG image (WhatsApp look)", fileType: "JPEG", description: "One smaller image of the chat" },
} as const satisfies Record<string, WriterInfo>;

export type WriterId = keyof typeof writerCatalog;

export const DEFAULT_WRITER: WriterId = "zip";

/** True for an id in the catalog (a stored setting may name a format that no longer exists). */
export const isWriterId = (id: unknown): id is WriterId => typeof id === "string" && Object.hasOwn(writerCatalog, id);
