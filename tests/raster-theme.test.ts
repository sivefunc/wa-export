// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { pageIsDark, useDarkTheme } from "../src/export/raster/dom";

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

describe("useDarkTheme", () => {
  it("a chosen theme wins; auto follows WhatsApp", () => {
    document.documentElement.style.setProperty("--WDS-surface-default", "#161717");
    expect(useDarkTheme(document, "light")).toBe(false);
    expect(useDarkTheme(document, "auto")).toBe(true);
    document.documentElement.style.setProperty("--WDS-surface-default", "#FFFFFF");
    expect(useDarkTheme(document, "dark")).toBe(true);
    expect(useDarkTheme(document, undefined)).toBe(false);
  });
});
