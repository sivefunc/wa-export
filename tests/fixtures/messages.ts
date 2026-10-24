import type { ExportProblem, ExportRecord, WaMediaInfo, WaMessage } from "../../src/types";

let seq = 0;

export function msg(overrides: Partial<WaMessage> = {}): WaMessage {
  seq += 1;
  return {
    id: `ID${seq}`,
    fromMe: false,
    type: "chat",
    timestamp: 1792845000 + seq,
    sender: { jid: "123@c.us", name: "Ana" },
    text: `message ${seq}`,
    quoted: null,
    quotedUnavailable: false,
    media: null,
    isViewOnce: false,
    isForwarded: false,
    ...overrides,
  };
}

export function media(kind: WaMediaInfo["kind"], overrides: Partial<WaMediaInfo> = {}): WaMediaInfo {
  return { kind, mime: null, filename: null, size: null, durationSec: null, ...overrides };
}

export function record(
  overrides: Partial<WaMessage> = {},
  extra: { exportedMedia?: ExportRecord["exportedMedia"]; problems?: ExportProblem[] } = {},
): ExportRecord {
  return { ...msg(overrides), exportedMedia: extra.exportedMedia ?? null, problems: extra.problems ?? [] };
}
