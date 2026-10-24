import type { ExportBundle } from "../types";

/** A normalized snapshot; records are already plain data, never raw WhatsApp objects. */
export function renderMessagesJson(b: ExportBundle): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      exportedAt: b.exportedAt.toISOString(),
      chat: b.chat,
      problems: b.problems,
      messages: b.records,
    },
    null,
    2,
  );
}
