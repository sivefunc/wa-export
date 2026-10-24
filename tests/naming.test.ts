import { describe, expect, it } from "vitest";
import { assignMediaPaths, exportFilename, extensionFor, sanitizeFilename } from "../src/export/naming";
import { media, msg } from "./fixtures/messages";

describe("sanitizeFilename", () => {
  it("removes path traversal", () => {
    const out = sanitizeFilename("../../etc/passwd");
    expect(out).not.toMatch(/[/\\]/);
    expect(out.split(/[-.]/).filter(Boolean)).not.toContain("..");
    expect(out.startsWith(".")).toBe(false);
  });

  it("strips control characters", () => {
    expect(sanitizeFilename("a\u0000b\u001fc\u007f")).toBe("a-b-c");
  });

  it("keeps accented letters and drops emoji", () => {
    expect(sanitizeFilename("résumé 📄.pdf")).toBe("résumé.pdf");
  });

  it("keeps a real-world Spanish filename readable", () => {
    expect(sanitizeFilename("Oferta Laboral Período de Prueba María López.pdf")).toBe(
      "Oferta Laboral Período de Prueba María López.pdf",
    );
  });

  it("truncates to 80 characters", () => {
    expect(sanitizeFilename("x".repeat(300)).length).toBeLessThanOrEqual(80);
  });

  it("falls back to file when nothing is left", () => {
    expect(sanitizeFilename("📄📄")).toBe("file");
    expect(sanitizeFilename("...")).toBe("file");
  });
});

describe("extensionFor", () => {
  it("prefers the original filename's extension, then the mime type, then bin", () => {
    expect(extensionFor("application/pdf", "spec.PDF")).toBe("pdf");
    expect(extensionFor("audio/ogg; codecs=opus", null)).toBe("ogg");
    expect(extensionFor("image/jpeg", null)).toBe("jpg");
    expect(extensionFor("audio/mp4", null)).toBe("m4a");
    expect(extensionFor("application/x-weird", null)).toBe("bin");
    expect(extensionFor(null, null)).toBe("bin");
  });
});

describe("assignMediaPaths", () => {
  it("numbers media messages in order and skips text messages", () => {
    const a = msg({ media: media("image", { mime: "image/jpeg" }) });
    const t = msg();
    const b = msg({ media: media("voice", { mime: "audio/ogg; codecs=opus" }) });
    const paths = assignMediaPaths([a, t, b]);
    expect(paths.get(a.id)).toBe("media/001-photo.jpg");
    expect(paths.has(t.id)).toBe(false);
    expect(paths.get(b.id)).toBe("media/002-voice-note.ogg");
  });

  it("keeps two attachments with the same name apart", () => {
    const a = msg({ media: media("image", { mime: "image/png", filename: "image.png" }) });
    const b = msg({ media: media("image", { mime: "image/png", filename: "image.png" }) });
    const paths = assignMediaPaths([a, b]);
    expect(paths.get(a.id)).toBe("media/001-image.png");
    expect(paths.get(b.id)).toBe("media/002-image.png");
  });

  it("uses the sanitized original filename as the stem", () => {
    const d = msg({ media: media("document", { mime: "application/pdf", filename: "../Design Spec v2.pdf" }) });
    expect(assignMediaPaths([d]).get(d.id)).toBe("media/001-Design Spec v2.pdf");
  });
});

describe("exportFilename", () => {
  it("combines the sanitized chat name and local time", () => {
    expect(exportFilename("Frontend / team", new Date(2026, 9, 24, 14, 5))).toBe("Frontend-team-2026-10-24-1405.zip");
  });

  it("falls back to whatsapp-export", () => {
    expect(exportFilename(null, new Date(2026, 9, 24, 9, 0))).toBe("whatsapp-export-2026-10-24-0900.zip");
  });

  it("handles a phone-number chat name", () => {
    expect(exportFilename("+1 555-0100", new Date(2026, 9, 24, 9, 0))).toBe("1 555-0100-2026-10-24-0900.zip");
  });
});
