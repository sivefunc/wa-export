import { describe, expect, it } from "vitest";
import { normalizeMessage } from "../src/page/normalize";
import { renderMessagesJson } from "../src/export/render-json";
import type { ExportBundle } from "../src/types";
import { BASE64_THUMBNAIL, imageWithCaption } from "./fixtures/raw-messages";
import { record } from "./fixtures/messages";

function bundle(): ExportBundle {
  const fromRaw = { ...normalizeMessage(imageWithCaption, () => "Ana"), exportedMedia: null, problems: [] };
  return {
    chat: { jid: "1@g.us", name: "Team" },
    exportedAt: new Date("2026-10-24T12:34:56.000Z"),
    records: [record(), fromRaw],
    media: new Map(),
    problems: [{ messageId: "GONE", code: "message_not_found", detail: "msg_not_found" }],
  };
}

describe("renderMessagesJson", () => {
  it("schemaVersion is 1 with export time, chat and problems", () => {
    const json = JSON.parse(renderMessagesJson(bundle()));
    expect(json.schemaVersion).toBe(1);
    expect(json.exportedAt).toBe("2026-10-24T12:34:56.000Z");
    expect(json.chat).toEqual({ jid: "1@g.us", name: "Team" });
    expect(json.problems).toEqual([{ messageId: "GONE", code: "message_not_found", detail: "msg_not_found" }]);
  });

  it("contains every record id", () => {
    const b = bundle();
    expect(JSON.parse(renderMessagesJson(b)).messages.map((m: any) => m.id)).toEqual(b.records.map((r) => r.id));
  });

  it("does not contain base64 body", () => {
    expect(renderMessagesJson(bundle())).not.toContain(BASE64_THUMBNAIL.slice(0, 40));
  });
});
