import { unzipSync, type UnzipFileInfo } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_WRITER, getWriter, writers } from "../src/export/writers";
import type { ExportBundle } from "../src/types";
import { media, record } from "./fixtures/messages";

const STORE = 0;
const DEFLATE = 8;

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

/** Run the ZIP writer and unpack its output, recording each entry's compression method. */
async function open(b: ExportBundle) {
  const { blob, filename } = await getWriter("zip").write(b);
  const methods: Record<string, number> = {};
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()), {
    filter: (f: UnzipFileInfo) => ((methods[f.name] = f.compression), true),
  });
  return { files, methods, filename, blob };
}

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("zip writer", () => {
  it("is the default and is registered", () => {
    expect(DEFAULT_WRITER).toBe("zip");
    expect(writers.zip.label).toBeTruthy();
    expect(writers.zip.fileType).toBe("ZIP");
    expect(writers.zip.limits).toEqual({ warnBytes: 500 * 1024 * 1024, maxBytes: 1.5 * 1024 ** 3, hint: "Select fewer large files." });
  });

  it("zip contains chat.md, messages.json and every media path", async () => {
    const { files } = await open(bundle());
    expect(Object.keys(files).sort()).toEqual(["chat.md", "media/001-photo.jpg", "messages.json"].sort());
    expect(text(files["chat.md"])).toContain("![](media/001-photo.jpg)");
    expect(JSON.parse(text(files["messages.json"])).schemaVersion).toBe(1);
  });

  it("media entries are STORE, chat.md and messages.json are DEFLATE", async () => {
    const { methods } = await open(bundle());
    expect(methods).toEqual({ "chat.md": DEFLATE, "messages.json": DEFLATE, "media/001-photo.jpg": STORE });
  });

  it("media bytes round-trip unchanged", async () => {
    const { files } = await open(bundle());
    expect([...files["media/001-photo.jpg"]]).toEqual([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
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

  it("copies media bytes into the content script's realm before zipping (Firefox)", async () => {
    // Firefox content scripts: buffers from the page (postMessage, Blob reads) deny `.constructor`
    // to libraries. A structuredClone made in the content script is our own.
    const clone = vi.spyOn(globalThis, "structuredClone");
    await getWriter("zip").write(bundle());
    expect(clone).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    clone.mockRestore();
  });

  it("unknown writer id falls back to zip", () => {
    expect(getWriter("pdf-someday")).toBe(writers.zip);
  });
});
