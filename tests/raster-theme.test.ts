// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { pageIsDark } from "../src/export/raster/dom";

afterEach(() => document.documentElement.style.removeProperty("--WDS-surface-default"));

describe("pageIsDark", () => {
  it("reads WhatsApp's own surface color", () => {
    document.documentElement.style.setProperty("--WDS-surface-default", "#161717");
    expect(pageIsDark(document)).toBe(true);
    document.documentElement.style.setProperty("--WDS-surface-default", "#FFFFFF");
    expect(pageIsDark(document)).toBe(false);
  });

  it("falls back to the system setting when WhatsApp's variable is missing", () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes("dark") })) as any;
    expect(pageIsDark(document)).toBe(true);
    window.matchMedia = original;
  });
});
