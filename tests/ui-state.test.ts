import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { DEFAULT_SETTINGS, loadSettings, settingsItem } from "../src/settings";
import { buttonLabel } from "../src/ui/state";

describe("buttonLabel", () => {
  it.each([
    [{ kind: "idle", count: 3 }, "Export 3"],
    [{ kind: "idle", count: 0 }, "Export"],
    [{ kind: "working", done: 7, total: 12 }, "Exporting 7/12…"],
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

describe("settings", () => {
  beforeEach(() => fakeBrowser.reset());

  it("defaults to zip ordered by date", async () => {
    expect(DEFAULT_SETTINGS).toEqual({ format: "zip", order: "date" });
    expect(await loadSettings()).toEqual({ format: "zip", order: "date" });
  });

  it("loadSettings replaces unknown ids with defaults", async () => {
    await settingsItem.setValue({ format: "tar-someday", order: "by-mood" });
    expect(await loadSettings()).toEqual({ format: "zip", order: "date" });
  });
});
