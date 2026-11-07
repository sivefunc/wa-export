import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Firefox Add-ons flags eval and the Function constructor in every file it ships.
describe.each(["chrome-mv3", "firefox-mv3"])("%s bundle", (target) => {
  it("nothing of ours uses eval or the Function constructor (WA-JS is vendored as published)", () => {
    const root = `.output/${target}`;
    const offenders = readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((f) => f.endsWith(".js") && !f.startsWith("vendor/"))
      .filter((f) => /\beval\(|\bnew Function\(|[^.\w]Function\(["'`]/.test(readFileSync(join(root, f), "utf8")));
    expect(offenders).toEqual([]);
  });
});
