import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { demoChat } from "../scripts/demo/demo-chat";
import { htmlWriter } from "../src/export/writers/html";

const ASSETS = join(__dirname, "../docs/demo/assets");

/** Markers of metadata that could carry a camera, place, author or date. */
function metadataMarkers(name: string, bytes: Buffer): string[] {
  const found: string[] = [];
  if (name.endsWith(".jpg")) {
    // JPEG APP1 (Exif/XMP) and COM segments.
    for (let i = 2; i + 3 < bytes.length && bytes[i] === 0xff; ) {
      const marker = bytes[i + 1];
      if (marker === 0xda) break; // start of scan: no more headers
      if (marker === 0xe1) found.push("APP1");
      if (marker === 0xfe) found.push("COM");
      i += 2 + bytes.readUInt16BE(i + 2);
    }
  }
  if (name.endsWith(".webp")) for (const chunk of ["EXIF", "XMP "]) if (bytes.includes(chunk)) found.push(chunk);
  for (const word of ["GPS", "Author", "/Creator", "/Producer", "CreationDate", "creation_time"]) if (bytes.includes(word)) found.push(word);
  return found;
}

describe("demo assets", () => {
  it("the metadata check catches an Exif segment and a creation date", () => {
    const jpg = readFileSync(join(ASSETS, "avatar-bao.jpg"));
    const exif = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, 0x08]), Buffer.from("Exif\0\0"), ]);
    const tagged = Buffer.concat([jpg.subarray(0, 2), exif, jpg.subarray(2)]);
    expect(metadataMarkers("x.jpg", tagged)).toContain("APP1");
    expect(metadataMarkers("x.mp4", Buffer.from("....creation_time...."))).toEqual(["creation_time"]);
  });

  it("carry no metadata that could identify a person, device or place", () => {
    const files = readdirSync(ASSETS);
    expect(files.sort()).toEqual(
      ["avatar-bao.jpg", "avatar-group.jpg", "avatar-mei.jpg", "demo-clip.mp4", "photo-mockup.jpg", "release-notes.pdf", "sticker-bao.webp", "voice-note.ogg"].sort(),
    );
    for (const f of files) expect([f, metadataMarkers(f, readFileSync(join(ASSETS, f)))]).toEqual([f, []]);
  });

  it("the fictional chat exports to HTML with every file and picture embedded and decodable", async () => {
    const bundle = demoChat(ASSETS);
    const html = await (await htmlWriter.write(bundle)).blob.text();
    const made: Blob[] = [];
    const dom = new JSDOM(html, {
      runScripts: "dangerously",
      beforeParse(window) {
        window.URL.createObjectURL = (b: Blob) => (made.push(b), `blob:demo/${made.length}`);
      },
    });
    const doc = dom.window.document;
    expect(doc.title).toBe("Bamboo team");
    expect(doc.querySelectorAll(".msg")).toHaveLength(10);
    // 6 media files + 3 profile pictures, each decoded once.
    expect(made).toHaveLength(bundle.media.size + bundle.avatars!.size);
    expect([...doc.querySelectorAll("[data-media]")].every((el) => el.getAttribute("src") || el.getAttribute("href"))).toBe(true);
    const photo = made.find((b) => b.type === "image/jpeg" && b.size === readFileSync(join(ASSETS, "photo-mockup.jpg")).length);
    expect(photo).toBeTruthy();
  });
});
