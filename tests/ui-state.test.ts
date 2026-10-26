import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { DEFAULT_SETTINGS, loadSettings, settingsItem } from "../src/settings";
import { buttonLabel, progressFraction } from "../src/ui/state";

describe("buttonLabel", () => {
  it.each([
    [{ kind: "idle", count: 3 }, "Export 3"],
    [{ kind: "idle", count: 0 }, "Export"],
    [{ kind: "working", stage: "reading", done: 0, total: 3 }, "Reading 3 messages…"],
    [{ kind: "working", stage: "reading", done: 0, total: 1 }, "Reading 1 message…"],
    [{ kind: "working", stage: "downloading", done: 1, total: 2 }, "Downloading files 1/2…"],
    [{ kind: "working", stage: "writing", fileType: "ZIP", done: 45, total: 100 }, "Creating ZIP… 45%"],
    [{ kind: "working", stage: "writing", fileType: "HTML", done: 7, total: 100 }, "Creating HTML… 7%"],
    [{ kind: "confirm", bytes: 620 * 1024 * 1024 }, "This export is 620 MB. Continue?"],
    [{ kind: "confirm", bytes: 1.2 * 1024 ** 3 }, "This export is 1.2 GB. Continue?"],
    [{ kind: "done", messages: 12, problems: ["a", "b"] }, "Exported 12 messages · 2 problems"],
    [{ kind: "done", messages: 1, problems: ["a"] }, "Exported 1 message · 1 problem"],
    [{ kind: "done", messages: 12, problems: [] }, "Exported 12 messages"],
    [{ kind: "error", message: "Export cancelled." }, "Export cancelled."],
    [{ kind: "hidden" }, ""],
  ] as const)("%j → %s", (state, label) => {
    expect(buttonLabel(state as any)).toBe(label);
  });
});

describe("progressFraction", () => {
  it("is the share done while working, else null", () => {
    expect(progressFraction({ kind: "working", stage: "downloading", done: 1, total: 4 })).toBe(0.25);
    expect(progressFraction({ kind: "working", stage: "reading", done: 0, total: 0 })).toBe(0);
    expect(progressFraction({ kind: "idle", count: 2 })).toBeNull();
  });
});

describe("settings", () => {
  beforeEach(() => fakeBrowser.reset());

  it("defaults to zip ordered by date", async () => {
    expect(DEFAULT_SETTINGS).toEqual({ format: "zip", order: "date", longImages: "single", quality: "best", customQuality: 75 });
    expect(await loadSettings()).toEqual({ format: "zip", order: "date", longImages: "single", quality: "best", customQuality: 75 });
  });

  it("loadSettings replaces unknown ids with defaults", async () => {
    await settingsItem.setValue({ format: "tar-someday", order: "by-mood", longImages: "sideways" } as any);
    expect(await loadSettings()).toEqual({ format: "zip", order: "date", longImages: "single", quality: "best", customQuality: 75 });
  });

  it("keeps a valid long-images choice, and settings saved before it existed get the default", async () => {
    await settingsItem.setValue({ format: "png", order: "date", longImages: "split", quality: "small", customQuality: 40 });
    expect(await loadSettings()).toEqual({ format: "png", order: "date", longImages: "split", quality: "small", customQuality: 40 });
    await settingsItem.setValue({ format: "png", order: "date" } as any);
    expect((await loadSettings()).longImages).toBe("single");
    expect((await loadSettings()).quality).toBe("best");
    expect((await loadSettings()).customQuality).toBe(75);
  });

  it("keeps a custom quality between 10 and 100 percent, as a whole number", async () => {
    const custom = async (customQuality: unknown) => {
      await settingsItem.setValue({ format: "pdf", order: "date", longImages: "single", quality: "custom", customQuality } as any);
      return (await loadSettings()).customQuality;
    };
    expect(await custom(62.4)).toBe(62);
    expect(await custom(500)).toBe(100);
    expect(await custom(1)).toBe(10);
    expect(await custom("lots")).toBe(75);
  });
});
