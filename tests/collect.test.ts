import { describe, expect, it } from "vitest";
import { RpcError, type OpName, type Ops } from "../src/bridge/protocol";
import type { PageRpc } from "../src/bridge/rpc";
import { collect, type CollectOptions } from "../src/export/collect";
import type { WaMessage } from "../src/types";
import { media, msg } from "./fixtures/messages";

type Fake = { [K in OpName]?: (req: Ops[K]["req"]) => Promise<Ops[K]["res"]> };

function fakeRpc(messages: WaMessage[], overrides: Fake = {}) {
  const calls: { op: OpName; req: unknown; timeoutMs: number }[] = [];
  let inFlightMedia = 0;
  const stats = { maxInFlightMedia: 0 };
  const byId = new Map(messages.map((m) => [m.id, m]));
  const handlers: Fake = {
    HEALTH: async () => ({ ready: true, missing: [], waJsVersion: "4.7.2" }),
    GET_CHAT: async () => ({ jid: "1@g.us", name: "Team" }),
    GET_MESSAGES: async ({ ids }) => ({
      messages: ids.filter((id) => byId.has(id)).map((id) => byId.get(id)!),
      failures: ids.filter((id) => !byId.has(id)).map((id) => ({ id, code: "message_not_found" as const, detail: "msg_not_found" })),
    }),
    GET_MEDIA: async ({ id }) => {
      inFlightMedia++;
      stats.maxInFlightMedia = Math.max(stats.maxInFlightMedia, inFlightMedia);
      await new Promise((r) => setTimeout(r, 5));
      inFlightMedia--;
      return { mime: "image/jpeg", buffer: new TextEncoder().encode(`bytes of ${id}`).buffer as ArrayBuffer };
    },
    ...overrides,
  };
  const rpc: PageRpc = {
    async call(op, req, timeoutMs) {
      calls.push({ op, req, timeoutMs });
      return (handlers[op] as any)(req);
    },
  };
  return { rpc, calls, stats };
}

function options(rpc: PageRpc, ids: string[], extra: Partial<CollectOptions> = {}): CollectOptions {
  return {
    ids,
    rpc,
    orderingId: "date",
    confirmLargeExport: async () => true,
    onProgress: () => {},
    now: () => new Date("2026-10-24T12:00:00Z"),
    ...extra,
  };
}

const image = (overrides: Partial<WaMessage> = {}) => msg({ media: media("image", { mime: "image/jpeg", size: 1000 }), ...overrides });

describe("collect", () => {
  it("empty ids → nothing_selected, no rpc calls", async () => {
    const { rpc, calls } = fakeRpc([]);
    const res = await collect(options(rpc, []));
    expect(res).toEqual({ ok: false, error: { code: "nothing_selected", message: "Select at least one message first." } });
    expect(calls).toEqual([]);
  });

  it("HEALTH not ready → not_ready, no GET_MESSAGES", async () => {
    const { rpc, calls } = fakeRpc([msg()], { HEALTH: async () => ({ ready: false, missing: ["chat.downloadMedia"], waJsVersion: "4.7.2" }) });
    const res = await collect(options(rpc, ["x"]));
    expect(res).toEqual({ ok: false, error: { code: "not_ready", message: "Can't read WhatsApp's messages. The extension needs an update." } });
    expect(calls.map((c) => c.op)).toEqual(["HEALTH"]);
  });

  it("a HEALTH call that fails also means not_ready", async () => {
    const { rpc } = fakeRpc([], {
      HEALTH: async () => {
        throw new RpcError("timeout", "no answer");
      },
    });
    const res = await collect(options(rpc, ["x"]));
    expect(res.ok === false && res.error.code).toBe("not_ready");
  });

  it("all ids fail → nothing_readable", async () => {
    const { rpc } = fakeRpc([]);
    const res = await collect(options(rpc, ["a", "b"]));
    expect(res).toEqual({
      ok: false,
      error: { code: "nothing_readable", message: "None of the selected messages could be read. The extension may need an update." },
    });
  });

  it("one of three media fails → ok, problem on the record and in the bundle, other two downloaded", async () => {
    const [a, b, c] = [image(), image(), image()];
    const { rpc } = fakeRpc([a, b, c], {
      GET_MEDIA: async ({ id }) => {
        if (id === b.id) throw new RpcError("media_not_found", "Media not found");
        return { mime: "image/jpeg", buffer: new Uint8Array([1, 2, 3]).buffer };
      },
    });
    const res = await collect(options(rpc, [a.id, b.id, c.id]));
    if (!res.ok) throw new Error("expected ok");
    const { records, media: files, problems } = res.bundle;
    expect([...files.keys()]).toEqual(["media/001-photo.jpg", "media/003-photo.jpg"]);
    expect(records[1].exportedMedia).toBeNull();
    expect(records[1].problems).toEqual([{ messageId: b.id, code: "media_not_found", detail: "Media not found" }]);
    expect(problems).toEqual(records[1].problems);
    expect(records[0].exportedMedia).toEqual({ path: "media/001-photo.jpg", mime: "image/jpeg", filename: null, size: 3, source: "wa-js" });
  });

  it.each([
    ["view_once", "view_once_skipped"],
    ["media_expired", "media_expired"],
    ["timeout", "media_timeout"],
    ["internal", "media_error"],
  ])("maps a %s media error to %s", async (rpcCode, problemCode) => {
    const a = image();
    const { rpc } = fakeRpc([a], {
      GET_MEDIA: async () => {
        throw new RpcError(rpcCode, "detail text");
      },
    });
    const res = await collect(options(rpc, [a.id]));
    if (!res.ok) throw new Error("expected ok");
    expect(res.bundle.problems).toEqual([{ messageId: a.id, code: problemCode, detail: "detail text" }]);
  });

  it("message_not_found failures go only in bundle.problems", async () => {
    const a = msg();
    const { rpc } = fakeRpc([a]);
    const res = await collect(options(rpc, [a.id, "GONE"]));
    if (!res.ok) throw new Error("expected ok");
    expect(res.bundle.records.map((r) => r.id)).toEqual([a.id]);
    expect(res.bundle.problems).toEqual([{ messageId: "GONE", code: "message_not_found", detail: "msg_not_found" }]);
  });

  it("a failing GET_MESSAGES batch becomes message_not_found problems for its ids", async () => {
    const many = Array.from({ length: 60 }, () => msg());
    let call = 0;
    const base = fakeRpc(many);
    const { rpc } = fakeRpc(many, {
      GET_MESSAGES: async (req) => {
        if (call++ === 1) throw new RpcError("timeout", "No answer");
        return (await base.rpc.call("GET_MESSAGES", req, 1)) as any;
      },
    });
    const res = await collect(options(rpc, many.map((m) => m.id)));
    if (!res.ok) throw new Error("expected ok");
    expect(res.bundle.records).toHaveLength(50);
    expect(res.bundle.problems).toHaveLength(10);
    expect(res.bundle.problems[0]).toEqual({ messageId: many[50].id, code: "message_not_found", detail: "No answer" });
  });

  it("records are ordered by timestamp regardless of selection order", async () => {
    const late = msg({ timestamp: 300 });
    const early = image({ timestamp: 100 });
    const { rpc } = fakeRpc([late, early]);
    const res = await collect(options(rpc, [late.id, early.id]));
    if (!res.ok) throw new Error("expected ok");
    expect(res.bundle.records.map((r) => r.id)).toEqual([early.id, late.id]);
  });

  it("never more than 3 GET_MEDIA in flight", async () => {
    const images = Array.from({ length: 10 }, () => image());
    const { rpc, stats } = fakeRpc(images);
    const res = await collect(options(rpc, images.map((m) => m.id)));
    expect(res.ok).toBe(true);
    expect(stats.maxInFlightMedia).toBe(3);
  });

  it("total size 600 MB asks to confirm; declined → cancelled, no GET_MEDIA", async () => {
    const big = image({ media: media("video", { mime: "video/mp4", size: 600 * 1024 * 1024 }) });
    const asked: number[] = [];
    const { rpc, calls } = fakeRpc([big]);
    const res = await collect(options(rpc, [big.id], { confirmLargeExport: async (bytes) => (asked.push(bytes), false) }));
    expect(asked).toEqual([600 * 1024 * 1024]);
    expect(res).toEqual({ ok: false, error: { code: "cancelled", message: "Export cancelled." } });
    expect(calls.some((c) => c.op === "GET_MEDIA")).toBe(false);
  });

  it("total size 600 MB confirmed → downloads", async () => {
    const big = image({ media: media("video", { mime: "video/mp4", size: 600 * 1024 * 1024 }) });
    const { rpc } = fakeRpc([big]);
    const res = await collect(options(rpc, [big.id], { confirmLargeExport: async () => true }));
    expect(res.ok && res.bundle.media.size).toBe(1);
  });

  it("total size 1.6 GB → too_large", async () => {
    const big = image({ media: media("video", { mime: "video/mp4", size: 1.6 * 1024 ** 3 }) });
    const { rpc } = fakeRpc([big]);
    const res = await collect(options(rpc, [big.id]));
    expect(res).toEqual({
      ok: false,
      error: { code: "too_large", message: "This export is 1.6 GB, over the 1.5 GB limit. Select fewer large files." },
    });
  });

  it("uses the open chat from GET_CHAT; a failure leaves the name null", async () => {
    const a = msg();
    const ok = await collect(options(fakeRpc([a]).rpc, [a.id]));
    expect(ok.ok && ok.bundle.chat).toEqual({ jid: "1@g.us", name: "Team" });
    const failing = fakeRpc([a], {
      GET_CHAT: async () => {
        throw new RpcError("internal", "x");
      },
    });
    const res = await collect(options(failing.rpc, [a.id]));
    expect(res.ok && res.bundle.chat).toEqual({ jid: null, name: null });
  });

  it("fetches messages in batches of 50", async () => {
    const many = Array.from({ length: 120 }, () => msg());
    const { rpc, calls } = fakeRpc(many);
    await collect(options(rpc, many.map((m) => m.id)));
    expect(calls.filter((c) => c.op === "GET_MESSAGES").map((c) => (c.req as any).ids.length)).toEqual([50, 50, 20]);
  });

  it("uses 30 s timeouts for message ops and 60 s for media", async () => {
    const a = image();
    const { rpc, calls } = fakeRpc([a]);
    await collect(options(rpc, [a.id]));
    expect(calls.find((c) => c.op === "GET_MESSAGES")!.timeoutMs).toBe(30_000);
    expect(calls.find((c) => c.op === "GET_MEDIA")!.timeoutMs).toBe(60_000);
  });

  it("onProgress reaches total (messages + media)", async () => {
    const [a, b] = [msg(), image()];
    const seen: [number, number][] = [];
    const { rpc } = fakeRpc([a, b]);
    await collect(options(rpc, [a.id, b.id], { onProgress: (done, total) => seen.push([done, total]) }));
    expect(seen.at(-1)).toEqual([3, 3]);
  });

  it("stamps the bundle with the export time", async () => {
    const a = msg();
    const res = await collect(options(fakeRpc([a]).rpc, [a.id]));
    expect(res.ok && res.bundle.exportedAt.toISOString()).toBe("2026-10-24T12:00:00.000Z");
  });
});
