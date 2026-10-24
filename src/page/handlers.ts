// Read-only RPC handlers running in the WhatsApp page next to WA-JS.
import { RpcError } from "../bridge/protocol";
import type { Handlers } from "../bridge/rpc";
import { idToString, normalizeMessage, senderJidOf } from "./normalize";

/** The subset of window.WPP this extension uses. */
export interface WppLike {
  version?: string;
  chat: {
    getMessageById(id: string): Promise<any>;
    downloadMedia(id: string): Promise<Blob>;
    get(jid: string): any;
    getActiveChat(): any;
  };
  contact: { get(jid: string): Promise<any> | any };
  conn?: { getMyUserLid?(): unknown; getMyUserId?(): unknown };
  whatsapp: { MsgStore: { getModelsArray(): any[] } };
}

export const REQUIRED_FUNCTIONS = [
  "chat.getMessageById",
  "chat.downloadMedia",
  "chat.getActiveChat",
  "contact.get",
  "whatsapp.MsgStore.getModelsArray",
];

const READY_TIMEOUT_MS = 30_000;
const READY_POLL_MS = 100;

/**
 * Media stages meaning WhatsApp's servers no longer have the file. Observed live 2026-10-24:
 * NEED_POKE (gone, nothing requested yet) and REMOTE_NEED_UPLOAD (re-upload already requested).
 */
export function isExpiredMediaStage(stage: unknown): boolean {
  return typeof stage === "string" && /ERROR|MISSING|EXPIRED|REUPLOAD|NEED_POKE|NEED_UPLOAD/i.test(stage);
}

/** WhatsApp's RequestMediaReuploadManager: sends a server-error receipt asking the sender to re-upload. */
export interface ReuploadManagerLike {
  requestMediaReupload(msg: any): Promise<unknown>;
}

interface ReuploadGuard {
  blocked: Set<string>; // bare message ids currently being downloaded for an export
  hit: Set<string>; // ids whose re-upload request the guard stopped
}

const GUARD = Symbol.for("wa-export.reuploadGuard");

/** Wrap requestMediaReupload once so export downloads can never ask anyone to re-upload. */
function guardFor(mgr: ReuploadManagerLike | null | undefined): ReuploadGuard | null {
  if (!mgr || typeof mgr.requestMediaReupload !== "function") return null;
  const tagged = mgr as ReuploadManagerLike & { [GUARD]?: ReuploadGuard };
  if (tagged[GUARD]) return tagged[GUARD];
  const guard: ReuploadGuard = { blocked: new Set(), hit: new Set() };
  const original = mgr.requestMediaReupload.bind(mgr);
  mgr.requestMediaReupload = async (msg: any) => {
    const id = msg?.id?.id;
    // Fail closed: during an export download, an id we can't read is treated as ours.
    if (guard.blocked.size && (typeof id !== "string" || guard.blocked.has(id))) {
      for (const blockedId of typeof id === "string" ? [id] : guard.blocked) guard.hit.add(blockedId);
      throw new Error("wa-export: re-upload request blocked");
    }
    return original(msg);
  };
  tagged[GUARD] = guard;
  return guard;
}

function missingFunctions(wpp: WppLike | undefined): string[] {
  return REQUIRED_FUNCTIONS.filter((path) => {
    const fn = path.split(".").reduce<any>((obj, key) => obj?.[key], wpp);
    return typeof fn !== "function";
  });
}

class NotInOpenChat extends Error {
  constructor() {
    super("not in the open chat");
  }
}

/**
 * The DOM only carries the bare message id (since 2026). Find the full serialized key in the
 * open chat's messages. Already-serialized ids ("true_…"/"false_…") pass through.
 */
function serializedIdFor(wpp: WppLike, domId: string): string {
  if (/^(true|false)_/.test(domId)) return domId;
  const chatId = idToString(wpp.chat.getActiveChat()?.id);
  const candidates = wpp.whatsapp.MsgStore.getModelsArray().filter((m) => m?.id?.id === domId);
  // Prefer the open chat; a lone match is still ours (older messages of a chat moved to @lid keep an @c.us remote).
  const model = candidates.find((m) => idToString(m.id.remote) === chatId) ?? (candidates.length === 1 ? candidates[0] : undefined);
  const serialized = model ? idToString(model.id) : null;
  if (!serialized) throw new NotInOpenChat();
  return serialized;
}

/** The album a message belongs to: the album itself, or a photo of one. Observed live 2026-10-24. */
function albumIdOf(raw: any): string | null {
  if (raw?.type === "album") return raw.id?.id ?? null;
  if (raw?.associationType === "MEDIA_ALBUM") return raw.parentMsgKey?.id ?? null;
  return null;
}

function albumPhotos(wpp: WppLike, albumId: string): any[] {
  const chatId = idToString(wpp.chat.getActiveChat()?.id);
  return wpp.whatsapp.MsgStore.getModelsArray().filter(
    (m) => m?.associationType === "MEDIA_ALBUM" && m.parentMsgKey?.id === albumId && idToString(m.id?.remote) === chatId,
  );
}

/** The DOM shows an album as one row; selecting it means every photo in it, each once. */
function expandAlbums(wpp: WppLike, found: { id: string; raw: any }[]): { id: string; raw: any }[] {
  const out: { id: string; raw: any }[] = [];
  const seen = new Set<string>();
  const add = (id: string, raw: any) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, raw });
  };
  for (const item of found) {
    const albumId = albumIdOf(item.raw);
    const photos = albumId ? albumPhotos(wpp, albumId) : [];
    if (photos.length) photos.forEach((p) => add(p.id.id, p));
    else add(item.id, item.raw);
  }
  return out;
}

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const { message, code } = err as { message?: unknown; code?: unknown };
    if (typeof message === "string" && message) return message;
    if (typeof code === "string") return code;
    return JSON.stringify(err);
  }
  return String(err);
}

export function createHandlers(
  getWpp: () => WppLike | undefined,
  getReuploadManager: () => ReuploadManagerLike | null | undefined = () => null,
): Handlers {
  // WPP.isReady is unreliable: after a cached reload it can stay false while every function works.
  // Ready means the functions exist and WhatsApp's modules answer a harmless call.
  const isReady = (wpp: WppLike | undefined): wpp is WppLike => {
    if (!wpp || missingFunctions(wpp).length) return false;
    try {
      wpp.chat.getActiveChat();
      return Array.isArray(wpp.whatsapp.MsgStore.getModelsArray());
    } catch {
      return false;
    }
  };

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

    async GET_CHAT() {
      const wpp = await ready();
      const chat = wpp.chat.getActiveChat();
      return {
        jid: idToString(chat?.id),
        name: chat?.formattedTitle ?? chat?.name ?? chat?.contact?.name ?? null,
      };
    },

    async GET_MESSAGES({ ids }) {
      const wpp = await ready();
      const settled = await Promise.allSettled(ids.map(async (id) => wpp.chat.getMessageById(serializedIdFor(wpp, id))));

      const found: { id: string; raw: any }[] = [];
      const failures: { id: string; code: "message_not_found"; detail: string }[] = [];
      settled.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value) found.push({ id: ids[i], raw: r.value });
        else failures.push({ id: ids[i], code: "message_not_found", detail: r.status === "rejected" ? errorText(r.reason) : "empty result" });
      });

      const messagesFound = expandAlbums(wpp, found);
      const jids = new Set<string>();
      for (const { raw } of messagesFound) {
        const sender = senderJidOf(raw);
        const quoted = idToString(raw?.quotedParticipant);
        if (sender) jids.add(sender);
        if (quoted) jids.add(quoted);
      }
      const names = new Map<string, string | null>();
      await Promise.all([...jids].map(async (jid) => names.set(jid, await contactName(wpp, jid))));

      const myJids = new Set(
        [wpp.conn?.getMyUserLid, wpp.conn?.getMyUserId]
          .map((get) => {
            try {
              return idToString(get?.call(wpp.conn));
            } catch {
              return null;
            }
          })
          .filter((j): j is string => !!j),
      );
      // The DOM data-id is the join key for selection and media, so it wins over the model's own id.
      const messages = messagesFound.map(({ id, raw }) => ({
        ...normalizeMessage(raw, (jid) => names.get(jid) ?? null, myJids),
        id,
      }));
      return { messages, failures };
    },

    async GET_MEDIA({ id }) {
      const wpp = await ready();
      const key = serializedIdFor(wpp, id);
      const raw = await wpp.chat.getMessageById(key);
      if (raw?.isViewOnce) throw new RpcError("view_once", "View-once media is not exported");
      if (isExpiredMediaStage(raw?.mediaData?.mediaStage)) {
        throw new RpcError("media_expired", `Media stage ${raw.mediaData.mediaStage}`);
      }
      const guard = guardFor(getReuploadManager());
      if (!guard && raw?.mediaData?.mediaStage !== "RESOLVED") {
        // Without the guard a download of uncached media might ask the sender to re-upload it.
        throw new RpcError("media_not_found", "Not downloaded yet and the re-upload guard is unavailable");
      }
      const bareId: string = raw?.id?.id ?? key;
      guard?.blocked.add(bareId);
      let blob: Blob;
      try {
        blob = await wpp.chat.downloadMedia(key);
      } catch (err) {
        if (guard?.hit.has(bareId) || isExpiredMediaStage(raw?.mediaData?.mediaStage)) {
          throw new RpcError("media_expired", `Expired on WhatsApp (${raw?.mediaData?.mediaStage ?? "unknown stage"})`);
        }
        const code = (err as { code?: unknown })?.code;
        if (code === "media_not_found" || /media.?not.?found/i.test(errorText(err))) {
          throw new RpcError("media_not_found", errorText(err));
        }
        throw new Error(errorText(err));
      } finally {
        guard?.blocked.delete(bareId);
        guard?.hit.delete(bareId);
      }
      return { mime: blob.type || raw?.mimetype || "application/octet-stream", buffer: await blob.arrayBuffer() };
    },
  };
}
