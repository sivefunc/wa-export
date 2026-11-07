import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NODE_ONLY_EVAL, vendorWaJs } from "../scripts/build/vendor-wa-js";

const LICENSE_LINE = "/*! For license information please see wppconnect-wa.js.LICENSE.txt */";

describe("vendorWaJs", () => {
  it("replaces the one Node-only eval with a throw, which is what the browser did anyway", () => {
    const src = `${LICENSE_LINE}\n(()=>{const stream=${NODE_ONLY_EVAL};readableStream.on("error",reject)})()`;
    const out = vendorWaJs(src);
    expect(out).not.toMatch(/\beval\(/);
    expect(out).toContain('const stream=(()=>{throw new ReferenceError("require is not defined")})();readableStream.on');
  });

  it("keeps the license line first and adds a modification notice under it (Apache-2.0 section 4b)", () => {
    const [first, second] = vendorWaJs(`${LICENSE_LINE}\nx=${NODE_ONLY_EVAL}`).split("\n");
    expect(first).toBe(LICENSE_LINE);
    expect(second).toMatch(/^\/\*! Modified by wa-export: .*scripts\/build\/vendor-wa-js\.ts.*\*\/$/);
  });

  it("fails the build when an upgrade moves or duplicates the eval, instead of shipping it", () => {
    expect(() => vendorWaJs(`${LICENSE_LINE}\nno eval here`)).toThrow(/expected exactly 1/);
    expect(() => vendorWaJs(`${LICENSE_LINE}\n${NODE_ONLY_EVAL};${NODE_ONLY_EVAL}`)).toThrow(/expected exactly 1/);
  });

  it("finds exactly that eval in the real WA-JS 4.7.2 and leaves no other", () => {
    const real = readFileSync("node_modules/@wppconnect/wa-js/dist/wppconnect-wa.js", "utf8");
    const out = vendorWaJs(real);
    expect(out).not.toMatch(/\beval\(|\bnew Function\(|(?<![\w$])Function\(/);
    expect(out.length - real.length).toBeLessThan(400);
  });
});
