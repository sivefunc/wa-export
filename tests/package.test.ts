// Run after `pnpm zip`: checks what would be uploaded to the stores.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));

describe("store packages", () => {
  it("has the Firefox sources zip AMO requires for bundled code", () => {
    expect(readdirSync(".output").some((f) => f.endsWith("-sources.zip"))).toBe(true);
  });

  it("never uploads the live WhatsApp profile, secrets or exports in the sources zip", () => {
    const zip = readdirSync(".output").find((f) => f.endsWith("-sources.zip"))!;
    const listing = execFileSync("unzip", ["-Z1", join(".output", zip)], { encoding: "utf8" });
    expect(listing).not.toMatch(/(^|\/)(\.live|\.superpowers|web-ext-artifacts|\.output|node_modules)\//m);
    expect(listing).not.toMatch(/(^|\/)\.env/m);
    expect(listing).not.toMatch(/\.zip$/m);
  });

  it("credits WA-JS (Apache-2.0) and JSZip in THIRD_PARTY_NOTICES.md", () => {
    const notices = readFileSync("THIRD_PARTY_NOTICES.md", "utf8");
    expect(notices).toContain("@wppconnect/wa-js");
    expect(notices).toContain("Apache License");
    expect(notices).toContain("jszip");
  });

  it("ships a privacy policy saying nothing is collected", () => {
    expect(readFileSync("PRIVACY.md", "utf8")).toContain("collects nothing");
  });

  it.each(["chrome-mv3", "firefox-mv3"])("%s loads no remote code outside the vendored WA-JS", (target) => {
    for (const file of files(join(".output", target))) {
      if (file.includes("vendor/") || !/\.(js|html)$/.test(file)) continue;
      expect(readFileSync(file, "utf8"), file).not.toMatch(/https:\/\/(cdn|unpkg\.com|cdnjs)/);
    }
  });

  it("ships the notices inside the extension", () => {
    expect(existsSync(".output/firefox-mv3/THIRD_PARTY_NOTICES.md")).toBe(true);
    expect(existsSync(".output/chrome-mv3/THIRD_PARTY_NOTICES.md")).toBe(true);
  });
});
