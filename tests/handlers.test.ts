import { afterEach, describe, expect, it, vi } from "vitest";
import { createHandlers, isExpiredMediaStage, type WppLike } from "../src/page/handlers";
import * as raw from "./fixtures/raw-messages";

function fakeWpp(messages: Record<string, any>, overrides: Partial<WppLike["chat"]> = {}): WppLike & { downloads: string[] } {
  const downloads: string[] = [];
  return {
    isReady: true,
    version: "4.7.2",
    downloads,
    chat: {
      getMessageById: async (id: string) => {
        if (!messages[id]) throw new Error("msg_not_found");
        return messages[id];
      },
      downloadMedia: async (id: string) => {
        downloads.push(id);
        return new Blob([new Uint8Array([7, 7])], { type: "image/jpeg" });
      },
      get: (jid: string) => ({ formattedTitle: `Chat ${jid}` }),
      ...overrides,
    },
    contact: { get: async (jid: string) => ({ pushname: `Push ${jid}` }) },
  };
}

afterEach(() => vi.useRealTimers());

describe("handlers", () => {
  it("HEALTH reports missing functions", async () => {
    const wpp: any = fakeWpp({});
    delete wpp.chat.downloadMedia;
    const res = await createHandlers(() => wpp).HEALTH({});
    expect(res).toEqual({ ready: false, missing: ["chat.downloadMedia"], waJsVersion: "4.7.2" });
  });

  it("HEALTH is ready when WPP is ready and complete", async () => {
    const res = await createHandlers(() => fakeWpp({})).HEALTH({});
    expect(res.ready).toBe(true);
    expect(res.missing).toEqual([]);
  });

  it("GET_MESSAGES returns failures for ids that reject", async () => {
    const h = createHandlers(() => fakeWpp({ A: raw.chatText }));
    const res = await h.GET_MESSAGES({ ids: ["A", "MISSING"] });
    expect(res.messages).toHaveLength(1);
    expect(res.failures).toEqual([{ id: "MISSING", code: "message_not_found", detail: "msg_not_found" }]);
  });

  it("GET_MESSAGES keeps the requested DOM id and resolves sender names via contacts", async () => {
    const h = createHandlers(() => fakeWpp({ "dom-id-1": raw.groupMessage }));
    const res = await h.GET_MESSAGES({ ids: ["dom-id-1"] });
    expect(res.messages[0].id).toBe("dom-id-1");
    expect(res.messages[0].sender).toEqual({ jid: "456@c.us", name: "Push 456@c.us" });
  });

  it("GET_CHAT returns the chat title", async () => {
    const res = await createHandlers(() => fakeWpp({})).GET_CHAT({ jid: "1@g.us" });
    expect(res).toEqual({ jid: "1@g.us", name: "Chat 1@g.us" });
  });

  it("GET_MEDIA returns bytes and mime", async () => {
    const wpp = fakeWpp({ IMG: raw.imageWithCaption });
    const res = await createHandlers(() => wpp).GET_MEDIA({ id: "IMG" });
    expect(res.mime).toBe("image/jpeg");
    expect([...new Uint8Array(res.buffer)]).toEqual([7, 7]);
  });

  it("GET_MEDIA view-once never calls downloadMedia", async () => {
    const wpp = fakeWpp({ V: { ...raw.imageWithCaption, isViewOnce: true } });
    const err = await createHandlers(() => wpp).GET_MEDIA({ id: "V" }).catch((e) => e);
    expect(err.code).toBe("view_once");
    expect(wpp.downloads).toEqual([]);
  });

  it("GET_MEDIA expired stage never calls downloadMedia and throws media_expired", async () => {
    const wpp = fakeWpp({ E: { ...raw.imageWithCaption, mediaData: { mediaStage: "ERROR_MISSING" } } });
    const err = await createHandlers(() => wpp).GET_MEDIA({ id: "E" }).catch((e) => e);
    expect(err.code).toBe("media_expired");
    expect(wpp.downloads).toEqual([]);
  });

  it("GET_MEDIA maps media_not_found", async () => {
    const wpp = fakeWpp(
      { N: raw.imageWithCaption },
      {
        downloadMedia: async () => {
          throw Object.assign(new Error("Media not found"), { code: "media_not_found" });
        },
      },
    );
    const err = await createHandlers(() => wpp).GET_MEDIA({ id: "N" }).catch((e) => e);
    expect(err.code).toBe("media_not_found");
  });

  it("ops throw not_ready when WPP never becomes ready", async () => {
    vi.useFakeTimers();
    const pending = createHandlers(() => undefined)
      .GET_MESSAGES({ ids: ["A"] })
      .catch((e) => e);
    await vi.advanceTimersByTimeAsync(30_100);
    expect((await pending).code).toBe("not_ready");
  });
});

describe("isExpiredMediaStage", () => {
  it("flags error and re-upload stages, not healthy ones", () => {
    expect(isExpiredMediaStage("ERROR_MISSING")).toBe(true);
    expect(isExpiredMediaStage("REUPLOADING")).toBe(true);
    expect(isExpiredMediaStage("NEED_POKE")).toBe(true);
    expect(isExpiredMediaStage("RESOLVED")).toBe(false);
    expect(isExpiredMediaStage("FETCHING")).toBe(false);
    expect(isExpiredMediaStage(undefined)).toBe(false);
  });
});
