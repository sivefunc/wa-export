import { RpcError } from "../bridge/protocol";
import type { PageRpc } from "../bridge/rpc";
import type { ChatInfo, ExportBundle, ExportProblem, ExportRecord, ProblemCode, WaMessage } from "../types";
import { assignMediaPaths } from "./naming";
import { applyOrdering } from "./orderings";

export const WARN_BYTES = 500 * 1024 * 1024;
export const MAX_BYTES = 1.5 * 1024 ** 3;

const MESSAGE_TIMEOUT_MS = 30_000;
const MEDIA_TIMEOUT_MS = 60_000;
const SLOWEST_EXPECTED_BYTES_PER_MS = 512; // ~512 KB/s

/** 60 s plus time for the file at a slow connection, so big videos can finish. */
function mediaTimeoutMs(size: number | null): number {
  return MEDIA_TIMEOUT_MS + Math.ceil((size ?? 0) / SLOWEST_EXPECTED_BYTES_PER_MS);
}
const BATCH_SIZE = 50;

export type FatalCode = "nothing_selected" | "not_ready" | "nothing_readable" | "too_large" | "cancelled";

export interface FatalError {
  code: FatalCode;
  message: string;
}

export interface CollectProgress {
  stage: "reading" | "downloading";
  done: number;
  total: number;
}

export interface CollectOptions {
  ids: string[];
  rpc: PageRpc;
  orderingId: string;
  confirmLargeExport(totalBytes: number): Promise<boolean>;
  onProgress(p: CollectProgress): void;
  concurrency?: number; // default 3
  now?: () => Date;
}

export type CollectResult = { ok: true; bundle: ExportBundle } | { ok: false; error: FatalError };

const fatal = (code: FatalCode, message: string): CollectResult => ({ ok: false, error: { code, message } });

const MEDIA_PROBLEMS: Record<string, ProblemCode> = {
  view_once: "view_once_skipped",
  media_expired: "media_expired",
  media_not_found: "media_not_found",
  timeout: "media_timeout",
};

function mediaProblem(messageId: string, err: unknown): ExportProblem {
  const code = err instanceof RpcError ? (MEDIA_PROBLEMS[err.code] ?? "media_error") : "media_error";
  return { messageId, code, detail: err instanceof Error ? err.message : String(err) };
}

/** Run fn over items with at most `limit` in flight. */
async function eachLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export async function collect(o: CollectOptions): Promise<CollectResult> {
  if (!o.ids.length) return fatal("nothing_selected", "Select at least one message first.");

  o.onProgress({ stage: "reading", done: 0, total: o.ids.length });
  const health = await o.rpc.call("HEALTH", {}, MESSAGE_TIMEOUT_MS).catch(() => null);
  if (!health?.ready) return fatal("not_ready", "Can't read WhatsApp's messages. The extension needs an update.");

  const chat: ChatInfo = await o.rpc.call("GET_CHAT", {}, MESSAGE_TIMEOUT_MS).catch(() => ({ jid: null, name: null }));

  const found: WaMessage[] = [];
  const problems: ExportProblem[] = [];
  for (let i = 0; i < o.ids.length; i += BATCH_SIZE) {
    const batch = o.ids.slice(i, i + BATCH_SIZE);
    try {
      const res = await o.rpc.call("GET_MESSAGES", { ids: batch }, MESSAGE_TIMEOUT_MS);
      found.push(...res.messages);
      for (const f of res.failures) problems.push({ messageId: f.id, code: f.code, detail: f.detail });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      for (const id of batch) problems.push({ messageId: id, code: "message_not_found", detail });
    }
  }
  if (!found.length) {
    return fatal("nothing_readable", "None of the selected messages could be read. The extension may need an update.");
  }

  const records: ExportRecord[] = applyOrdering(found, o.orderingId).map((m) => ({ ...m, exportedMedia: null, problems: [] }));
  for (const r of records) {
    // Polls, locations, contact cards… have no text or file we can export; say so.
    if (!r.text && !r.media && r.type !== "revoked") {
      r.problems.push({ messageId: r.id, code: "unsupported_type", detail: r.type });
    }
  }

  const totalBytes = records.reduce((sum, r) => sum + (r.media?.size ?? 0), 0);
  if (totalBytes > MAX_BYTES) {
    const gb = (totalBytes / 1024 ** 3).toFixed(1);
    return fatal("too_large", `This export is ${gb} GB, over the 1.5 GB limit. Select fewer large files.`);
  }
  if (totalBytes > WARN_BYTES && !(await o.confirmLargeExport(totalBytes))) {
    return fatal("cancelled", "Export cancelled.");
  }

  const paths = assignMediaPaths(records);
  const withMedia = records.filter((r) => paths.has(r.id));
  let done = 0;
  if (withMedia.length) o.onProgress({ stage: "downloading", done, total: withMedia.length });

  const media = new Map<string, Blob>();
  await eachLimited(withMedia, o.concurrency ?? 3, async (r) => {
    try {
      const res = await o.rpc.call("GET_MEDIA", { id: r.id }, mediaTimeoutMs(r.media?.size ?? null));
      const blob = new Blob([res.buffer], { type: res.mime });
      const path = paths.get(r.id)!;
      media.set(path, blob);
      r.exportedMedia = { path, mime: res.mime, filename: r.media?.filename ?? null, size: blob.size, source: "wa-js" };
    } catch (err) {
      r.problems.push(mediaProblem(r.id, err));
    }
    o.onProgress({ stage: "downloading", done: ++done, total: withMedia.length });
  });

  // Keep the media map in message order regardless of download completion order.
  const orderedMedia = new Map([...paths.values()].filter((p) => media.has(p)).map((p) => [p, media.get(p)!]));
  problems.push(...records.flatMap((r) => r.problems));

  return {
    ok: true,
    bundle: { chat, exportedAt: (o.now ?? (() => new Date()))(), records, media: orderedMedia, problems },
  };
}
