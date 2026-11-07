import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** `.innerHTML =`, `["outerHTML"] =`, `.innerHTML +=` and the like; not `==` or `===` comparisons. */
const HTML_ASSIGNMENT = /(?:\.|\[\s*["'`])(?:inner|outer)HTML(?:["'`]\s*\])?\s*[-+*/%&|^?]{0,3}=(?!=)/;

/** Every JavaScript file in a build, as [relative path with / separators, source]. */
function scripts(target: string): [string, string][] {
  const root = `.output/${target}`;
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .map((f) => f.replaceAll("\\", "/")) // Windows lists content-scripts\wa-export.js
    .filter((f) => f.endsWith(".js"))
    .map((f) => [f, readFileSync(join(root, f), "utf8")]);
}

describe.each(["chrome-mv3", "firefox-mv3"])("%s bundle", (target) => {
  // Firefox Add-ons lints every file in the package, loaded or not.
  it("nothing assigns innerHTML: the UI builds DOM and the PNG/PDF layout parses with DOMParser", () => {
    const withInnerHtml = scripts(target)
      .filter(([, src]) => HTML_ASSIGNMENT.test(src))
      .map(([f]) => f);
    expect(withInnerHtml).toEqual([]);
  });
});
