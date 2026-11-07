import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const EVAL = /\beval\(|\bnew Function\(|(?<![\w$])Function\(/;

// Firefox Add-ons flags eval and the Function constructor in every file it ships.
describe.each(["chrome-mv3", "firefox-mv3"])("%s bundle", (target) => {
  const root = `.output/${target}`;

  it("no shipped file uses eval or the Function constructor, WA-JS included", () => {
    const offenders = readdirSync(root, { recursive: true, encoding: "utf8" })
      .map((f) => f.replaceAll("\\", "/")) // Windows lists vendor\wppconnect-wa.js
      .filter((f) => f.endsWith(".js") && EVAL.test(readFileSync(join(root, f), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("WA-JS says it was modified, as its Apache-2.0 license requires", () => {
    const head = readFileSync(join(root, "vendor/wppconnect-wa.js"), "utf8").slice(0, 400);
    expect(head).toContain("Modified by wa-export");
    expect(head).toContain("scripts/build/vendor-wa-js.ts");
  });
});
