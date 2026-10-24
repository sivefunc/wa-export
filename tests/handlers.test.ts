import { afterEach, describe, expect, it, vi } from "vitest";
import { createHandlers, isExpiredMediaStage, type WppLike } from "../src/page/handlers";
import * as raw from "./fixtures/raw-messages";

/** MsgStore models as WhatsApp keeps them: bare id + chat (remote) + serialized key. */
function storeModel(bare: string, remote: string) {
  return { id: { id: bare, remote: { _serialized: remote }, $1: `true_${remote}_${bare}_out` } };
}

/** WhatsApp's RequestMediaReuploadManager: asks the sender's phone to upload expired media again. */
function fakeReuploadManager() {
  const sent: string[] = [];
  return { sent, requestMediaReupload: async (msg: any) => void sent.push(msg.id.id) };
}

function fakeWpp(
  messages: Record<string, any>,
  overrides: Partial<WppLike["chat"]> = {},
  store: any[] = [],
): WppLike & { downloads: string[] } {
  const downloads: string[] = [];
  return {
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
      getActiveChat: () => ({ id: { _serialized: "self@lid" }, formattedTitle: "+1 555-0100" }),
      ...overrides,
    },
    whatsapp: { MsgStore: { getModelsArray: () => store } },
    contact: { get: async (jid: string) => ({ pushname: `Push ${jid}` }) },
    conn: { getMyUserLid: () => ({ _serialized: "self@lid" }), getMyUserId: () => ({ _serialized: "999@c.us" }) },
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

  it("HEALTH is ready when the functions work even if WPP.isReady is false", async () => {
    // Live 2026-10-24: after a cached reload WA-JS never flips isReady, yet every function works.
    const wpp = { ...fakeWpp({}), isReady: false };
    expect((await createHandlers(() => wpp).HEALTH({})).ready).toBe(true);
  });

  it("HEALTH is not ready while WhatsApp's modules still throw", async () => {
    const wpp = fakeWpp({}, {
      getActiveChat: () => {
        throw new Error("module not loaded");
      },
    });
    const res = await createHandlers(() => wpp).HEALTH({});
    expect(res.ready).toBe(false);
    expect(res.missing).toEqual([]);
  });

  it("HEALTH is ready when WPP is ready and complete", async () => {
    const res = await createHandlers(() => fakeWpp({})).HEALTH({});
    expect(res.ready).toBe(true);
    expect(res.missing).toEqual([]);
  });

  it("GET_MESSAGES returns failures for ids that reject", async () => {
    const h = createHandlers(() => fakeWpp({ false_1_A: raw.chatText }));
    const res = await h.GET_MESSAGES({ ids: ["false_1_A", "false_1_MISSING"] });
    expect(res.messages).toHaveLength(1);
    expect(res.failures).toEqual([{ id: "false_1_MISSING", code: "message_not_found", detail: "msg_not_found" }]);
  });

  it("GET_MESSAGES keeps the requested DOM id and resolves sender names via contacts", async () => {
    const h = createHandlers(() => fakeWpp({ "false_g_1": raw.groupMessage }));
    const res = await h.GET_MESSAGES({ ids: ["false_g_1"] });
    expect(res.messages[0].id).toBe("false_g_1");
    expect(res.messages[0].sender).toEqual({ jid: "456@c.us", name: "Push 456@c.us" });
  });

  it("GET_MESSAGES marks quotes of my own messages using my ids", async () => {
    const reply = { ...raw.replyWithQuote, quotedParticipant: raw.wid("self@lid") };
    const res = await createHandlers(() => fakeWpp({ true_1_R: reply })).GET_MESSAGES({ ids: ["true_1_R"] });
    expect(res.messages[0].quoted?.fromMe).toBe(true);
  });

  it("GET_CHAT returns the active chat", async () => {
    const res = await createHandlers(() => fakeWpp({})).GET_CHAT({});
    expect(res).toEqual({ jid: "self@lid", name: "+1 555-0100" });
  });

  it("GET_MESSAGES resolves bare DOM ids within the active chat and keeps the DOM id", async () => {
    const serialized = "true_self@lid_AC9F_out";
    const wpp = fakeWpp({ [serialized]: raw.voiceNote }, {}, [storeModel("AC9F", "other@lid"), storeModel("AC9F", "self@lid")]);
    const res = await createHandlers(() => wpp).GET_MESSAGES({ ids: ["AC9F"] });
    expect(res.failures).toEqual([]);
    expect(res.messages[0].id).toBe("AC9F");
    expect(res.messages[0].type).toBe("ptt");
  });

  describe("albums", () => {
    // Live 2026-10-24: an album is a type "album" message; its photos carry
    // associationType "MEDIA_ALBUM" and parentMsgKey → the album. The DOM row shows one photo's id.
    const photo = (bare: string) => ({
      ...raw.imageWithCaption,
      caption: `photo ${bare}`,
      id: { id: bare, fromMe: false, remote: { _serialized: "self@lid" }, $1: `true_self@lid_${bare}_out` },
      associationType: "MEDIA_ALBUM",
      parentMsgKey: { id: "ALB" },
    });
    const album = { type: "album", t: 1, id: { id: "ALB", remote: { _serialized: "self@lid" }, $1: "true_self@lid_ALB_out" } };
    const setup = () => {
      const [p1, p2] = [photo("P1"), photo("P2")];
      const byKey = { [p1.id.$1]: p1, [p2.id.$1]: p2, [album.id.$1]: album };
      return createHandlers(() => fakeWpp(byKey, {}, [album, p1, p2]));
    };

    it("a selected album photo expands to every photo of its album", async () => {
      const res = await setup().GET_MESSAGES({ ids: ["P1"] });
      expect(res.messages.map((m) => [m.id, m.text])).toEqual([["P1", "photo P1"], ["P2", "photo P2"]]);
      expect(res.failures).toEqual([]);
    });

    it("a selected album container expands to its photos", async () => {
      const res = await setup().GET_MESSAGES({ ids: ["ALB"] });
      expect(res.messages.map((m) => m.id)).toEqual(["P1", "P2"]);
    });

    it("an album whose photos aren't loaded stays in the export instead of vanishing", async () => {
      const h = createHandlers(() => fakeWpp({ [album.id.$1]: album }, {}, [album]));
      const res = await h.GET_MESSAGES({ ids: ["ALB"] });
      expect(res.messages.map((m) => [m.id, m.type])).toEqual([["ALB", "album"]]);
    });

    it("photos reached twice are exported once", async () => {
      const res = await setup().GET_MESSAGES({ ids: ["P2", "ALB", "P1"] });
      expect(res.messages.map((m) => m.id)).toEqual(["P1", "P2"]);
    });
  });

  it("finds an older message whose remote is the chat's pre-LID @c.us id", async () => {
    // A chat moved to @lid can still hold older messages keyed by @c.us.
    const old = { ...raw.chatText, id: { id: "OLDMSG", remote: { _serialized: "555@c.us" }, $1: "false_555@c.us_OLDMSG" } };
    const wpp = fakeWpp({ [old.id.$1]: old }, {}, [old]);
    const res = await createHandlers(() => wpp).GET_MESSAGES({ ids: ["OLDMSG"] });
    expect(res.failures).toEqual([]);
    expect(res.messages[0].id).toBe("OLDMSG");
  });

  it("prefers the open chat when the same bare id exists in two chats", async () => {
    const here = { ...raw.chatText, body: "here", id: { id: "DUP", remote: { _serialized: "self@lid" }, $1: "true_self@lid_DUP" } };
    const there = { ...raw.chatText, body: "there", id: { id: "DUP", remote: { _serialized: "other@lid" }, $1: "true_other@lid_DUP" } };
    const wpp = fakeWpp({ [here.id.$1]: here, [there.id.$1]: there }, {}, [there, here]);
    const res = await createHandlers(() => wpp).GET_MESSAGES({ ids: ["DUP"] });
    expect(res.messages[0].text).toBe("here");
  });

  it("GET_MESSAGES reports a bare id that isn't in the store as message_not_found", async () => {
    const wpp = fakeWpp({}, {}, [storeModel("OTHER", "self@lid")]);
    const res = await createHandlers(() => wpp).GET_MESSAGES({ ids: ["AC9F"] });
    expect(res.failures).toEqual([{ id: "AC9F", code: "message_not_found", detail: "not in the open chat" }]);
  });

  it("GET_MEDIA resolves bare ids before downloading", async () => {
    const serialized = "true_self@lid_IMG_out";
    const wpp = fakeWpp({ [serialized]: raw.imageWithCaption }, {}, [storeModel("IMG", "self@lid")]);
    await createHandlers(() => wpp).GET_MEDIA({ id: "IMG" });
    expect(wpp.downloads).toEqual([serialized]);
  });

  it("GET_MEDIA returns bytes and mime", async () => {
    const wpp = fakeWpp({ true_1_IMG: raw.imageWithCaption });
    const res = await createHandlers(() => wpp).GET_MEDIA({ id: "true_1_IMG" });
    expect(res.mime).toBe("image/jpeg");
    expect([...new Uint8Array(res.buffer)]).toEqual([7, 7]);
  });

  it("GET_MEDIA view-once never calls downloadMedia", async () => {
    const wpp = fakeWpp({ true_1_V: { ...raw.imageWithCaption, isViewOnce: true } });
    const err = await createHandlers(() => wpp).GET_MEDIA({ id: "true_1_V" }).catch((e) => e);
    expect(err.code).toBe("view_once");
    expect(wpp.downloads).toEqual([]);
  });

  it("GET_MEDIA expired stage never calls downloadMedia and throws media_expired", async () => {
    const wpp = fakeWpp({ true_1_E: { ...raw.imageWithCaption, mediaData: { mediaStage: "ERROR_MISSING" } } });
    const err = await createHandlers(() => wpp).GET_MEDIA({ id: "true_1_E" }).catch((e) => e);
    expect(err.code).toBe("media_expired");
    expect(wpp.downloads).toEqual([]);
  });

  it("GET_MEDIA maps media_not_found", async () => {
    const wpp = fakeWpp(
      { true_1_N: raw.imageWithCaption },
      {
        downloadMedia: async () => {
          throw Object.assign(new Error("Media not found"), { code: "media_not_found" });
        },
      },
    );
    const err = await createHandlers(() => wpp).GET_MEDIA({ id: "true_1_N" }).catch((e) => e);
    expect(err.code).toBe("media_not_found");
  });

  it("ops throw not_ready when WPP never becomes ready", async () => {
    vi.useFakeTimers();
    const pending = createHandlers(() => undefined)
      .GET_MESSAGES({ ids: ["true_1_A"] })
      .catch((e) => e);
    await vi.advanceTimersByTimeAsync(30_100);
    expect((await pending).code).toBe("not_ready");
  });
});

describe("re-upload guard", () => {
  const key = "true_1_OLD";
  const oldImage = () => ({ ...raw.imageWithCaption, id: { id: "OLD", fromMe: true }, mediaData: { mediaStage: "INIT" } });

  it("blocks WhatsApp's re-upload request during an export download and reports media_expired", async () => {
    const mgr = fakeReuploadManager();
    const msg = oldImage();
    const wpp = fakeWpp({ [key]: msg }, {
      // Simulates WhatsApp's downloader finding the file gone and asking the sender to re-upload.
      downloadMedia: async () => {
        await mgrHolder.current.requestMediaReupload(msg);
        throw new Error("unreachable");
      },
    });
    const mgrHolder = { current: mgr };
    const err = await createHandlers(() => wpp, () => mgrHolder.current).GET_MEDIA({ id: key }).catch((e) => e);
    expect(err.code).toBe("media_expired");
    expect(mgr.sent).toEqual([]);
  });

  it("fails closed: during an export download, a re-upload call with an unreadable id is blocked", async () => {
    const mgr = fakeReuploadManager();
    const msg = oldImage();
    const wpp = fakeWpp({ [key]: msg }, {
      downloadMedia: async () => {
        await mgr.requestMediaReupload({ msg }); // an argument shape WhatsApp might switch to
        throw new Error("unreachable");
      },
    });
    const err = await createHandlers(() => wpp, () => mgr).GET_MEDIA({ id: key }).catch((e) => e);
    expect(err.code).toBe("media_expired");
    expect(mgr.sent).toEqual([]);
  });

  it("lets re-upload requests outside export downloads through", async () => {
    const mgr = fakeReuploadManager();
    createHandlers(() => fakeWpp({}), () => mgr);
    await mgr.requestMediaReupload({ id: { id: "USER_CLICK" } });
    expect(mgr.sent).toEqual(["USER_CLICK"]);
  });

  it("without the guard, only already-downloaded media is fetched", async () => {
    const wpp = fakeWpp({ [key]: oldImage(), true_1_IMG: raw.imageWithCaption });
    const h = createHandlers(() => wpp, () => null);
    const err = await h.GET_MEDIA({ id: key }).catch((e) => e);
    expect(err.code).toBe("media_not_found");
    expect(wpp.downloads).toEqual([]);
    await h.GET_MEDIA({ id: "true_1_IMG" }); // RESOLVED stage
    expect(wpp.downloads).toEqual(["true_1_IMG"]);
  });

  it("a failed download that leaves an expired stage reports media_expired", async () => {
    const msg = oldImage();
    const wpp = fakeWpp({ [key]: msg }, {
      downloadMedia: async () => {
        msg.mediaData.mediaStage = "NEED_POKE";
        throw { code: "download_failed" }; // WA-JS throws plain objects too
      },
    });
    const err = await createHandlers(() => wpp, () => fakeReuploadManager()).GET_MEDIA({ id: key }).catch((e) => e);
    expect(err.code).toBe("media_expired");
  });
});

describe("isExpiredMediaStage", () => {
  it("flags error and re-upload stages, not healthy ones", () => {
    expect(isExpiredMediaStage("ERROR_MISSING")).toBe(true);
    expect(isExpiredMediaStage("REUPLOADING")).toBe(true);
    expect(isExpiredMediaStage("NEED_POKE")).toBe(true);
    expect(isExpiredMediaStage("REMOTE_NEED_UPLOAD")).toBe(true);
    expect(isExpiredMediaStage("INIT")).toBe(false);
    expect(isExpiredMediaStage("RESOLVED")).toBe(false);
    expect(isExpiredMediaStage("FETCHING")).toBe(false);
    expect(isExpiredMediaStage(undefined)).toBe(false);
  });
});
