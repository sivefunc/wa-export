import { CHANNEL, RpcError, type OpName, type Ops } from "./protocol";

export interface Transport {
  post(msg: unknown, transfer?: Transferable[]): void;
  listen(fn: (msg: unknown) => void): () => void;
}

export type Handlers = { [K in OpName]: (req: Ops[K]["req"]) => Promise<Ops[K]["res"]> };

export interface PageRpc {
  call<K extends OpName>(op: K, req: Ops[K]["req"], timeoutMs: number): Promise<Ops[K]["res"]>;
}

interface Request {
  channel: typeof CHANNEL;
  dir: "request";
  requestId: string;
  op: string;
  req: unknown;
}

type ResponseBody = { ok: true; value: unknown } | { ok: false; code: string; message: string };
type Response = { channel: typeof CHANNEL; dir: "response"; requestId: string } & ResponseBody;

function isOurs(msg: any, dir: "request" | "response"): boolean {
  return msg?.channel === CHANNEL && msg.dir === dir && typeof msg.requestId === "string";
}

export function createRpcServer(t: Transport, handlers: Handlers): () => void {
  return t.listen(async (raw) => {
    if (!isOurs(raw, "request")) return;
    const msg = raw as Request;
    const reply = (body: ResponseBody, transfer?: Transferable[]) =>
      t.post({ channel: CHANNEL, dir: "response", requestId: msg.requestId, ...body }, transfer);

    const handler = (handlers as Record<string, ((req: unknown) => Promise<unknown>) | undefined>)[msg.op];
    if (!Object.hasOwn(handlers, msg.op) || !handler) {
      reply({ ok: false, code: "unknown_op", message: `Unknown operation: ${msg.op}` });
      return;
    }
    try {
      const value = await handler(msg.req);
      const buffer = (value as { buffer?: unknown } | null)?.buffer;
      reply({ ok: true, value }, buffer instanceof ArrayBuffer ? [buffer] : undefined);
    } catch (err) {
      if (err instanceof RpcError) reply({ ok: false, code: err.code, message: err.message });
      else reply({ ok: false, code: "internal", message: err instanceof Error ? err.message : String(err) });
    }
  });
}

export function createRpcClient(t: Transport): PageRpc {
  return {
    call(op, req, timeoutMs) {
      const requestId = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          stop();
          reject(new RpcError("timeout", `No answer to ${op} within ${timeoutMs} ms`));
        }, timeoutMs);
        const stop = t.listen((raw) => {
          if (!isOurs(raw, "response")) return;
          const res = raw as Response;
          if (res.requestId !== requestId) return;
          clearTimeout(timer);
          stop();
          if (res.ok) resolve(res.value as any);
          else reject(new RpcError(res.code, res.message));
        });
        t.post({ channel: CHANNEL, dir: "request", requestId, op, req } satisfies Request);
      });
    },
  };
}

/**
 * postMessage transport between the MAIN-world page script and the ISOLATED content script.
 * Each side only listens to the opposite direction, so it never hears its own messages.
 */
export function windowTransport(role: "page" | "content"): Transport {
  const inbound = role === "page" ? "request" : "response";
  return {
    post: (msg, transfer) => window.postMessage(msg, location.origin, transfer ?? []),
    listen(fn) {
      const onMessage = (event: MessageEvent) => {
        if (event.source !== window || event.origin !== location.origin) return;
        if (!isOurs(event.data, inbound)) return;
        fn(event.data);
      };
      window.addEventListener("message", onMessage);
      return () => window.removeEventListener("message", onMessage);
    },
  };
}
