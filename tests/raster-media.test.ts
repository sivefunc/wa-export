// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { prepareMedia } from "../src/export/raster/dom";
import type { ExportBundle } from "../src/types";
import { media, record } from "./fixtures/messages";

describe("prepareMedia", () => {
  it("reports a photo or sticker it can't draw instead of dropping it silently", async () => {
    // jsdom has no image decoder, like a browser faced with a corrupt file.
    const photo = record({ media: media("image", { mime: "image/jpeg", filename: "plan.jpg" }) }, { exportedMedia: { path: "media/001-plan.jpg", mime: "image/jpeg", filename: "plan.jpg", size: 3, source: "wa-js" } });
    const b: ExportBundle = { chat: { jid: null, name: "T" }, exportedAt: new Date(), records: [photo], media: new Map([["media/001-plan.jpg", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" })]]), problems: [] };
    const { srcs } = await prepareMedia(document, b, () => {});
    expect(srcs.size).toBe(0);
    expect(photo.problems).toEqual([{ messageId: photo.id, code: "media_error", detail: "couldn't be drawn in the image" }]);
    expect(b.problems).toEqual(photo.problems);
  });
});
