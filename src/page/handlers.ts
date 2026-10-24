// Read-only RPC handlers running in the WhatsApp page next to WA-JS.
import { RpcError } from "../bridge/protocol";
import type { Handlers } from "../bridge/rpc";
import { idToString, normalizeMessage, senderJidOf } from "./normalize";

/** The subset of window.WPP this extension uses. */
export interface WppLike {
  isReady?: boolean;
  version?: string;
  chat: {
    getMessageById(id: string): Promise<any>;
    downloadMedia(id: string): Promise<Blob>;
    get(jid: string): any;
  };
  contact: { get(jid: string): Promise<any> | any };
}

export const REQUIRED_FUNCTIONS = ["chat.getMessageById", "chat.downloadMedia", "chat.get", "contact.get"];

const READY_TIMEOUT_MS = 30_000;
const READY_POLL_MS = 100;

/** Media stages meaning WhatsApp no longer has the file; downloading could ask the sender to re-upload. */
export function isExpiredMediaStage(stage: unknown): boolean {
  return typeof stage === "string" && /ERROR|MISSING|EXPIRED|REUPLOAD|NEED_POKE/i.test(stage);
}

function missingFunctions(wpp: WppLike | undefined): string[] {
  return REQUIRED_FUNCTIONS.filter((path) => {
    const fn = path.split(".").reduce<any>((obj, key) => obj?.[key], wpp);
    return typeof fn !== "function";
  });
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function createHandlers(getWpp: () => WppLike | undefined): Handlers {
  const isReady = (wpp: WppLike | undefined): wpp is WppLike => !!wpp?.isReady && missingFunctions(wpp).length === 0;

  async function ready(): Promise<WppLike> {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    for (;;) {
      const wpp = getWpp();
      if (isReady(wpp)) return wpp;
      if (Date.now() >= deadline) throw new RpcError("not_ready", "WA-JS did not become ready");
      await new Promise((r) => setTimeout(r, READY_POLL_MS));
    }
  }

  async function contactName(wpp: WppLike, jid: string): Promise<string | null> {
    try {
      const c = await wpp.contact.get(jid);
      return c?.name || c?.pushname || c?.shortName || null;
    } catch {
      return null;
    }
  }

  return {
    async HEALTH() {
      const wpp = getWpp();
      return { ready: isReady(wpp), missing: missingFunctions(wpp), waJsVersion: wpp?.version ?? null };
    },

    async GET_CHAT({ jid }) {
      const wpp = await ready();
      const chat = await wpp.chat.get(jid);
      return { jid, name: chat?.formattedTitle ?? chat?.name ?? chat?.contact?.name ?? null };
    },

    async GET_MESSAGES({ ids }) {
      const wpp = await ready();
      const settled = await Promise.allSettled(ids.map((id) => wpp.chat.getMessageById(id)));

      const found: { id: string; raw: any }[] = [];
      const failures: { id: string; code: "message_not_found"; detail: string }[] = [];
      settled.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value) found.push({ id: ids[i], raw: r.value });
        else failures.push({ id: ids[i], code: "message_not_found", detail: r.status === "rejected" ? errorText(r.reason) : "empty result" });
      });

      const jids = new Set<string>();
      for (const { raw } of found) {
        const sender = senderJidOf(raw);
        const quoted = idToString(raw?.quotedParticipant);
        if (sender) jids.add(sender);
        if (quoted) jids.add(quoted);
      }
      const names = new Map<string, string | null>();
      await Promise.all([...jids].map(async (jid) => names.set(jid, await contactName(wpp, jid))));

      // The DOM data-id is the join key for selection and media, so it wins over the model's own id.
      const messages = found.map(({ id, raw }) => ({ ...normalizeMessage(raw, (jid) => names.get(jid) ?? null), id }));
      return { messages, failures };
    },

    async GET_MEDIA({ id }) {
      const wpp = await ready();
      const raw = await wpp.chat.getMessageById(id);
      if (raw?.isViewOnce) throw new RpcError("view_once", "View-once media is not exported");
      if (isExpiredMediaStage(raw?.mediaData?.mediaStage)) {
        throw new RpcError("media_expired", `Media stage ${raw.mediaData.mediaStage}`);
      }
      let blob: Blob;
      try {
        blob = await wpp.chat.downloadMedia(id);
      } catch (err) {
        const code = (err as { code?: unknown })?.code;
        if (code === "media_not_found" || /media.?not.?found/i.test(errorText(err))) {
          throw new RpcError("media_not_found", errorText(err));
        }
        throw err;
      }
      return { mime: blob.type || raw?.mimetype || "application/octet-stream", buffer: await blob.arrayBuffer() };
    },
  };
}
