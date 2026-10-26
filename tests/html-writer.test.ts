import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { getWriter, writers } from "../src/export/writers";
import type { ExportBundle } from "../src/types";
import { media, record } from "./fixtures/messages";

function bundle(bytes: Uint8Array<ArrayBuffer>, mime = "image/jpeg"): ExportBundle {
  const path = "media/001-photo.jpg";
  const img = record(
    { text: "look", media: media("image", { mime }) },
    { exportedMedia: { path, mime, filename: null, size: bytes.length, source: "wa-js" } },
  );
  return {
    chat: { jid: "1@g.us", name: "Frontend / team" },
    exportedAt: new Date(2026, 9, 24, 14, 5),
    records: [record({ text: "hello" }), img],
    media: new Map([[path, new Blob([bytes], { type: mime })]]),
    problems: [],
  };
}

const decode = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

describe("html writer", () => {
  it("is registered with its file type and lower size limits", () => {
    const w = writers.html;
    expect(w.fileType).toBe("HTML");
    expect(w.wantsAvatars).toBe(true);
    expect(w.label).toBe("HTML (WhatsApp look, opens in any browser)");
    expect(w.limits).toEqual({ warnBytes: 200 * 1024 * 1024, maxBytes: 500 * 1024 * 1024, hint: "Select fewer large files, or export as ZIP." });
  });

  it("writes one UTF-8 HTML file named after the chat", async () => {
    const { blob, filename } = await getWriter("html").write(bundle(new Uint8Array([1, 2, 3])));
    expect(filename).toBe("Frontend-team-2026-10-24-1405.html");
    expect(blob.type).toBe("text/html;charset=utf-8");
    expect(await blob.text()).toMatch(/^<!doctype html>/);
  });

  it("embeds media bytes as base64 blocks, split so no block is huge", async () => {
    const bytes = new Uint8Array(7 * 1024 * 1024).map((_, i) => i % 251);
    const html = await (await getWriter("html").write(bundle(bytes))).blob.text();
    const doc = new JSDOM(html).window.document;
    const id = doc.querySelector("img.photo")!.getAttribute("data-media")!;
    const blocks = [...doc.querySelectorAll(`script[type="application/octet-stream"][data-for="${id}"]`)];
    expect(blocks.length).toBe(2);
    // Buffers, not spread arrays: 7 MB as JS arrays took CI runners past the default timeout.
    const joined = Buffer.concat(blocks.map((s) => Buffer.from(s.textContent!, "base64")));
    expect(joined.length).toBe(bytes.length);
    expect(joined.equals(Buffer.from(bytes))).toBe(true);
  }, 20_000);

  it("reports rising progress up to 100", async () => {
    const seen: number[] = [];
    await getWriter("html").write(bundle(new Uint8Array(10)), (pct) => seen.push(pct));
    expect(seen.at(-1)).toBe(100);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });

  it("fills profile pictures from bundle.avatars and decodes each once", async () => {
    const b = bundle(new Uint8Array([1, 2, 3]));
    b.records = [record({ text: "a", sender: { jid: "123@lid", name: "Ana" } }), record({ text: "b", sender: { jid: "456@lid", name: "Luis" } }), record({ text: "c", sender: { jid: "123@lid", name: "Ana" } })];
    b.avatars = new Map([["123@lid", new Blob([new Uint8Array([5, 6])], { type: "image/jpeg" })]]);
    const html = await (await getWriter("html").write(b)).blob.text();
    const made: Blob[] = [];
    const dom = new JSDOM(html, {
      runScripts: "dangerously",
      beforeParse(window) {
        window.URL.createObjectURL = (blob: Blob) => (made.push(blob), `blob:test/${made.length}`);
      },
    });
    const pics = [...dom.window.document.querySelectorAll("img.pp")];
    expect(pics.map((i) => i.getAttribute("src"))).toEqual(["blob:test/1", "blob:test/1"]);
    expect(made).toHaveLength(1);
    expect([...new Uint8Array(await made[0].arrayBuffer())]).toEqual([5, 6]);
  });

  it("the page's script turns the blocks into a Blob URL on the photo", async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 8, 7]);
    const html = await (await getWriter("html").write(bundle(bytes))).blob.text();
    const made: Blob[] = [];
    const dom = new JSDOM(html, {
      runScripts: "dangerously",
      beforeParse(window) {
        window.URL.createObjectURL = (b: Blob) => (made.push(b), `blob:test/${made.length}`);
      },
    });
    const img = dom.window.document.querySelector<HTMLImageElement>("img.photo")!;
    expect(img.getAttribute("src")).toBe("blob:test/1");
    expect(made[0].type).toBe("image/jpeg");
    expect([...new Uint8Array(await made[0].arrayBuffer())]).toEqual([...bytes]);
  });
});
