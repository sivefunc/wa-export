import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { DEFAULT_WRITER, getWriter, writers } from "../src/export/writers";
import type { ExportBundle } from "../src/types";
import { media, record } from "./fixtures/messages";

const STORE = "\x00\x00";
const DEFLATE = "\x08\x00";

function bundle(): ExportBundle {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const img = record(
    { text: "look", media: media("image", { mime: "image/jpeg" }) },
    { exportedMedia: { path: "media/001-photo.jpg", mime: "image/jpeg", filename: null, size: bytes.length, source: "wa-js" } },
  );
  return {
    chat: { jid: "1@g.us", name: "Frontend / team" },
    exportedAt: new Date(2026, 9, 24, 14, 5),
    records: [record({ text: "hello" }), img],
    media: new Map([["media/001-photo.jpg", new Blob([bytes], { type: "image/jpeg" })]]),
    problems: [],
  };
}

async function open(b: ExportBundle) {
  const { blob, filename } = await getWriter("zip").write(b);
  return { zip: await JSZip.loadAsync(await blob.arrayBuffer()), filename, blob };
}

const compressionOf = (zip: JSZip, path: string) => (zip.file(path) as any)._data.compression.magic;

describe("zip writer", () => {
  it("is the default and is registered", () => {
    expect(DEFAULT_WRITER).toBe("zip");
    expect(writers.zip.label).toBeTruthy();
  });

  it("zip contains chat.md, messages.json and every media path", async () => {
    const { zip } = await open(bundle());
    expect(Object.keys(zip.files).filter((p) => !zip.files[p].dir).sort()).toEqual(
      ["chat.md", "media/001-photo.jpg", "messages.json"].sort(),
    );
    expect(await zip.file("chat.md")!.async("string")).toContain("![](media/001-photo.jpg)");
    expect(JSON.parse(await zip.file("messages.json")!.async("string")).schemaVersion).toBe(1);
  });

  it("media entries are STORE, chat.md and messages.json are DEFLATE", async () => {
    const { zip } = await open(bundle());
    expect(compressionOf(zip, "media/001-photo.jpg")).toBe(STORE);
    expect(compressionOf(zip, "chat.md")).toBe(DEFLATE);
    expect(compressionOf(zip, "messages.json")).toBe(DEFLATE);
  });

  it("media bytes round-trip unchanged", async () => {
    const { zip } = await open(bundle());
    expect([...(await zip.file("media/001-photo.jpg")!.async("uint8array"))]).toEqual([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  });

  it("filename comes from exportFilename and the blob is a zip", async () => {
    const { filename, blob } = await open(bundle());
    expect(filename).toBe("Frontend-team-2026-10-24-1405.zip");
    expect(blob.type).toBe("application/zip");
  });

  it("reports ZIP progress up to 100%", async () => {
    const seen: number[] = [];
    await getWriter("zip").write(bundle(), (pct) => seen.push(pct));
    expect(seen.at(-1)).toBe(100);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it("unknown writer id falls back to zip", () => {
    expect(getWriter("pdf-someday")).toBe(writers.zip);
  });
});
