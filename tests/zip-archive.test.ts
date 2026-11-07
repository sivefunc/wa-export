import { unzipSync, type UnzipFileInfo } from "fflate";
import { describe, expect, it } from "vitest";
import { buildZip } from "../src/export/writers/zip-archive";

const STORE = 0;
const DEFLATE = 8;

/** Unpack a ZIP blob, also recording each entry's compression method. */
async function unpack(blob: Blob) {
  const methods: Record<string, number> = {};
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()), {
    filter: (f: UnzipFileInfo) => ((methods[f.name] = f.compression), true),
  });
  return { files, methods };
}

describe("buildZip", () => {
  it("stores compressed media as is and deflates text", async () => {
    const photo = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    const blob = await buildZip([
      { path: "chat.md", data: "hello ".repeat(50), compress: true },
      { path: "media/001-photo.jpg", data: photo, compress: false },
    ]);
    const { files, methods } = await unpack(blob);
    expect(Object.keys(files)).toEqual(["chat.md", "media/001-photo.jpg"]);
    expect(new TextDecoder().decode(files["chat.md"])).toBe("hello ".repeat(50));
    expect([...files["media/001-photo.jpg"]]).toEqual([...photo]);
    expect(methods).toEqual({ "chat.md": DEFLATE, "media/001-photo.jpg": STORE });
  });

  it("is a ZIP blob, with UTF-8 names and text intact", async () => {
    const blob = await buildZip([{ path: "media/002-niño 📄.txt", data: "año ✓", compress: true }]);
    expect(blob.type).toBe("application/zip");
    const { files } = await unpack(blob);
    expect(new TextDecoder().decode(files["media/002-niño 📄.txt"])).toBe("año ✓");
  });

  it("reports progress rising to 100%", async () => {
    const seen: number[] = [];
    await buildZip(
      [
        { path: "a.txt", data: "a".repeat(1000), compress: true },
        { path: "b.bin", data: new Uint8Array(3000), compress: false },
      ],
      (pct) => seen.push(pct),
    );
    expect(seen.at(-1)).toBe(100);
    expect(seen).toEqual([...new Set(seen)].sort((a, b) => a - b));
  });

  it("an empty archive is still a valid ZIP", async () => {
    const { files } = await unpack(await buildZip([]));
    expect(files).toEqual({});
  });
});
