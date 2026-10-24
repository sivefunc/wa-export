// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountExportUi } from "../src/ui/export-ui";
import { findForwardButton } from "../src/ui/placement";

afterEach(() => {
  document.body.innerHTML = "";
});

/** WhatsApp's selection toolbar as observed live on 2026-10-24. */
function toolbar() {
  document.body.innerHTML = `
    <div id="main"><footer><div class="bar">
      <button aria-label="Cancel selection"><svg><title>ic-close</title></svg></button>
      <button aria-label="Forward messages"><svg><title>ic-fast-forward</title></svg></button>
      <button aria-label="Download"><svg><title>ic-download</title></svg></button>
    </div></footer></div>`;
  return document.querySelector<HTMLElement>('[aria-label="Forward messages"]')!;
}

const shadowOf = () => document.querySelector("wa-export-ui")!.shadowRoot!;

describe("findForwardButton", () => {
  it("finds it by aria-label", () => {
    expect(findForwardButton(document)).toBeNull();
    expect(findForwardButton(document)).toBe(null);
    const fwd = toolbar();
    expect(findForwardButton(document)).toBe(fwd);
  });

  it("finds it by icon title when the label is localized", () => {
    document.body.innerHTML = `<button aria-label="Reenviar mensajes"><svg><title>ic-fast-forward</title></svg></button>`;
    expect(findForwardButton(document)).toBe(document.querySelector("button"));
  });
});

describe("mountExportUi", () => {
  it("floats when no Forward button exists", () => {
    const ui = mountExportUi(document);
    ui.setState({ kind: "idle", count: 2 });
    const host = document.querySelector<HTMLElement>("wa-export-ui")!;
    expect(host.parentElement).toBe(document.body);
    expect(host.dataset.placement).toBe("floating");
  });

  it("inserts after Forward when present, and place() follows it", () => {
    const ui = mountExportUi(document);
    ui.setState({ kind: "idle", count: 2 });
    const fwd = toolbar();
    ui.place();
    const host = document.querySelector<HTMLElement>("wa-export-ui")!;
    expect(host.previousElementSibling).toBe(fwd);
    expect(host.dataset.placement).toBe("toolbar");
  });

  it("goes after Forward's wrapper, as a sibling in the toolbar row (live markup)", () => {
    // Observed 2026-10-24: row(flex) > div > span > div > button[Forward messages]
    document.body.innerHTML = `
      <div id="main"><div class="row">
        <div class="slot"><span><div><button aria-label="Star"></button></div></span></div>
        <div class="slot fwd"><span><div><button aria-label="Forward messages"></button></div></span></div>
        <div class="slot"><span><div><button aria-label="Download"></button></div></span></div>
      </div></div>`;
    const ui = mountExportUi(document);
    ui.setState({ kind: "idle", count: 3 });
    const host = document.querySelector<HTMLElement>("wa-export-ui")!;
    expect(host.parentElement!.className).toBe("row");
    expect(host.previousElementSibling!.className).toBe("slot fwd");
  });

  it("re-attaches floating when WhatsApp removes the toolbar", () => {
    toolbar();
    const ui = mountExportUi(document);
    ui.setState({ kind: "done", messages: 1, problems: [] });
    document.querySelector("#main")!.remove();
    ui.place();
    expect(document.querySelector<HTMLElement>("wa-export-ui")!.dataset.placement).toBe("floating");
  });

  it("is hidden in the hidden state", () => {
    const ui = mountExportUi(document);
    ui.setState({ kind: "hidden" });
    const host = document.querySelector<HTMLElement>("wa-export-ui")!;
    expect(host.hidden).toBe(true);
    // :host { all: initial } would otherwise override the hidden attribute.
    expect(host.shadowRoot!.querySelector("style")!.textContent).toContain(":host([hidden]) { display: none !important; }");
  });

  it("export click fires onExport", () => {
    const ui = mountExportUi(document);
    const onExport = vi.fn();
    ui.onExport(onExport);
    ui.setState({ kind: "idle", count: 1 });
    shadowOf().querySelector<HTMLButtonElement>("button.export")!.click();
    expect(onExport).toHaveBeenCalledOnce();
  });

  it("working state disables the button and shows a progress bar", () => {
    const ui = mountExportUi(document);
    ui.setState({ kind: "working", stage: "downloading", done: 1, total: 4 });
    const btn = shadowOf().querySelector<HTMLButtonElement>("button.export")!;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe("Downloading files 1/4…");
    const bar = shadowOf().querySelector<HTMLElement>("[role=progressbar]")!;
    expect(bar.getAttribute("aria-valuenow")).toBe("25");
    expect(bar.style.width).toBe("25%");
  });

  it("confirm buttons fire onConfirm", () => {
    const ui = mountExportUi(document);
    const answers: boolean[] = [];
    ui.onConfirm((ok) => answers.push(ok));
    ui.setState({ kind: "confirm", bytes: 600 * 1024 * 1024 });
    expect(shadowOf().textContent).toContain("This export is 600 MB. Continue?");
    shadowOf().querySelector<HTMLButtonElement>("button.continue")!.click();
    ui.setState({ kind: "confirm", bytes: 600 * 1024 * 1024 });
    shadowOf().querySelector<HTMLButtonElement>("button.cancel")!.click();
    expect(answers).toEqual([true, false]);
  });

  it("done state with problems lists them and can be dismissed", () => {
    const ui = mountExportUi(document);
    const onDismiss = vi.fn();
    ui.onDismiss(onDismiss);
    ui.setState({ kind: "done", messages: 12, problems: ["Ana at 2026-10-24 06:34: Image expired on WhatsApp, not re-requested"] });
    const text = shadowOf().textContent!;
    expect(text).toContain("Exported 12 messages · 1 problem");
    expect(text).toContain("Ana at 2026-10-24 06:34: Image expired on WhatsApp, not re-requested");
    shadowOf().querySelector<HTMLButtonElement>("button.dismiss")!.click();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("error state shows the message", () => {
    const ui = mountExportUi(document);
    ui.setState({ kind: "error", message: "Can't read WhatsApp's messages. The extension needs an update." });
    expect(shadowOf().textContent).toContain("Can't read WhatsApp's messages. The extension needs an update.");
    expect(shadowOf().querySelector("button.dismiss")).not.toBeNull();
  });
});
