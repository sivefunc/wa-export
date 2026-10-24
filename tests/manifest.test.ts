import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readManifest(target: string) {
  return JSON.parse(readFileSync(`.output/${target}/manifest.json`, "utf8"));
}

describe.each(["chrome-mv3", "firefox-mv3"])("%s manifest", (target) => {
  it("declares only the storage permission and no extra host access", () => {
    const m = readManifest(target);
    expect(m.manifest_version).toBe(3);
    expect(m.permissions).toEqual(["storage"]);
    expect(m.host_permissions ?? []).toEqual([]);
  });

  it("loads bundled WA-JS first in the MAIN world at document_start", () => {
    const m = readManifest(target);
    const main = m.content_scripts.find((c: any) => c.world === "MAIN");
    expect(main.run_at).toBe("document_start");
    expect(main.js[0]).toBe("vendor/wppconnect-wa.js");
    expect(main.matches).toEqual(["https://web.whatsapp.com/*"]);
    expect(existsSync(`.output/${target}/vendor/wppconnect-wa.js`)).toBe(true);
  });

  it("runs the isolated script only on WhatsApp Web", () => {
    const m = readManifest(target);
    const isolated = m.content_scripts.filter((c: any) => c.world !== "MAIN");
    expect(isolated).toHaveLength(1);
    expect(isolated[0].matches).toEqual(["https://web.whatsapp.com/*"]);
    expect(isolated[0].run_at).toBe("document_idle");
  });

  it("does not start its name with WhatsApp", () => {
    expect(readManifest(target).name.startsWith("WhatsApp")).toBe(false);
  });
});

describe("browser-specific keys", () => {
  it("chrome requires Chrome 111", () => {
    expect(readManifest("chrome-mv3").minimum_chrome_version).toBe("111");
  });

  it("firefox has a fixed id and requires Firefox 128", () => {
    const gecko = readManifest("firefox-mv3").browser_specific_settings.gecko;
    expect(gecko.id).toBe("sivefunc@tuta.io");
    expect(gecko.strict_min_version).toBe("128.0");
  });

  it("firefox declares that no data is collected", () => {
    const gecko = readManifest("firefox-mv3").browser_specific_settings.gecko;
    expect(gecko.data_collection_permissions).toEqual({ required: ["none"] });
  });
});
