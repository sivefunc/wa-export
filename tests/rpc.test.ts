import { afterEach, describe, expect, it, vi } from "vitest";
import { RpcError } from "../src/bridge/protocol";
import { createRpcClient, createRpcServer, type Handlers, type Transport } from "../src/bridge/rpc";

/** Two in-memory transports wired to each other, delivering asynchronously like postMessage. */
function makePair(): { page: Transport; content: Transport } {
  const listeners = { page: new Set<(m: unknown) => void>(), content: new Set<(m: unknown) => void>() };
  const side = (self: "page" | "content", other: "page" | "content"): Transport => ({
    post: (msg) => queueMicrotask(() => listeners[other].forEach((fn) => fn(structuredClone(msg)))),
    listen: (fn) => {
      listeners[self].add(fn);
      return () => listeners[self].delete(fn);
    },
  });
  return { page: side("page", "content"), content: side("content", "page") };
}

function handlers(overrides: Partial<Handlers> = {}): Handlers {
  const notUsed = async () => {
    throw new Error("not used in this test");
  };
  return {
    HEALTH: notUsed,
    GET_CHAT: notUsed,
    GET_MESSAGES: notUsed,
    GET_MEDIA: notUsed,
    ...overrides,
  } as Handlers;
}

afterEach(() => vi.useRealTimers());

describe("rpc", () => {
  it("call resolves with the handler result", async () => {
    const { page, content } = makePair();
    createRpcServer(page, handlers({ GET_CHAT: async () => ({ jid: "1@g.us", name: "Team" }) }));
    const rpc = createRpcClient(content);
    await expect(rpc.call("GET_CHAT", {}, 1000)).resolves.toEqual({ jid: "1@g.us", name: "Team" });
  });

  it("handler throwing RpcError keeps its code on the client", async () => {
    const { page, content } = makePair();
    createRpcServer(
      page,
      handlers({
        GET_MEDIA: async () => {
          throw new RpcError("media_expired", "x");
        },
      }),
    );
    const err = await createRpcClient(content).call("GET_MEDIA", { id: "a" }, 1000).catch((e) => e);
    expect(err).toBeInstanceOf(RpcError);
    expect(err.code).toBe("media_expired");
    expect(err.message).toBe("x");
  });

  it("a non-RpcError throw arrives as code internal", async () => {
    const { page, content } = makePair();
    createRpcServer(
      page,
      handlers({
        HEALTH: async () => {
          throw new TypeError("boom");
        },
      }),
    );
    const err = await createRpcClient(content).call("HEALTH", {}, 1000).catch((e) => e);
    expect(err.code).toBe("internal");
    expect(err.message).toContain("boom");
  });

  it("unknown op rejects with unknown_op", async () => {
    const { page, content } = makePair();
    createRpcServer(page, handlers());
    const err = await createRpcClient(content)
      .call("NOPE" as any, {}, 1000)
      .catch((e) => e);
    expect(err.code).toBe("unknown_op");
  });

  it("no response within timeoutMs rejects with timeout", async () => {
    vi.useFakeTimers();
    const { content } = makePair(); // no server listening
    const pending = createRpcClient(content).call("HEALTH", {}, 5000).catch((e) => e);
    await vi.advanceTimersByTimeAsync(5001);
    expect((await pending).code).toBe("timeout");
  });

  it("concurrent calls resolve to their own results", async () => {
    const { page, content } = makePair();
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((r) => (releaseFirst = r));
    createRpcServer(
      page,
      handlers({
        GET_MESSAGES: async ({ ids }) => {
          if (ids[0] === "first") await firstGate;
          return { messages: [], failures: [{ id: ids[0], code: "message_not_found" as const, detail: ids[0].toUpperCase() }] };
        },
      }),
    );
    const rpc = createRpcClient(content);
    const first = rpc.call("GET_MESSAGES", { ids: ["first"] }, 1000);
    const second = await rpc.call("GET_MESSAGES", { ids: ["second"] }, 1000);
    releaseFirst();
    expect(second.failures[0].detail).toBe("SECOND");
    expect((await first).failures[0].detail).toBe("FIRST");
  });

  it("responses from another channel are ignored", async () => {
    vi.useFakeTimers();
    const { page, content } = makePair();
    // A rogue responder on the page side answering every request on a different channel.
    page.listen((msg: any) => page.post({ ...msg, channel: "other:v1", dir: "response", ok: true, value: "spoofed" }));
    const pending = createRpcClient(content).call("HEALTH", {}, 1000).catch((e) => e);
    await vi.advanceTimersByTimeAsync(1001);
    expect((await pending).code).toBe("timeout");
  });

  it("transfers ArrayBuffer results intact", async () => {
    const { page, content } = makePair();
    createRpcServer(
      page,
      handlers({ GET_MEDIA: async () => ({ mime: "image/png", buffer: new Uint8Array([1, 2, 3]).buffer }) }),
    );
    const res = await createRpcClient(content).call("GET_MEDIA", { id: "a" }, 1000);
    expect([...new Uint8Array(res.buffer)]).toEqual([1, 2, 3]);
  });
});
