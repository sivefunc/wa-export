// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { renderOptions } from "../src/options";
import { settingsItem } from "../src/settings";

beforeEach(() => {
  fakeBrowser.reset();
  document.body.innerHTML = '<main id="app"></main>';
});

const root = () => document.getElementById("app")!;
const select = (name: string) => root().querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;

describe("options page", () => {
  it("renders a select per setting populated from the registries", async () => {
    await renderOptions(root());
    expect([...select("format").options].map((o) => o.value)).toEqual(["zip", "html", "pdf", "png", "jpeg"]);
    expect([...select("order").options].map((o) => o.value)).toEqual(["date"]);
    expect(root().textContent).toContain("Export format");
    expect(root().textContent).toContain("Message order");
  });

  it("defaults are selected on first run", async () => {
    await renderOptions(root());
    expect(select("format").value).toBe("zip");
    expect(select("order").value).toBe("date");
  });

  it("changing a select saves to settingsItem", async () => {
    await renderOptions(root());
    select("order").value = "date";
    select("order").dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => expect(root().querySelector("[role=status]")!.textContent).toBe("Saved"));
    // Written to storage, not just the fallback value.
    expect(await fakeBrowser.storage.sync.get("settings")).toEqual({ settings: { format: "zip", order: "date", longImages: "single", quality: "best", customQuality: 75 } });
    expect(await settingsItem.getValue()).toEqual({ format: "zip", order: "date", longImages: "single", quality: "best", customQuality: 75 });
    expect(root().querySelector("[role=status]")!.textContent).toBe("Saved");
  });
});
