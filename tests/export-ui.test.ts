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

describe("settings menu", () => {
  afterEach(() => vi.useRealTimers());
  function setup(initial = { format: "zip", order: "date" }) {
    const saved: { format: string; order: string }[] = [];
    let current = { ...initial };
    const ui = mountExportUi(document, {
      load: async () => ({ ...current }),
      save: async (s) => void saved.push((current = { ...s })),
    });
    ui.setState({ kind: "idle", count: 2 });
    return { ui, saved };
  }
  const gear = () => shadowOf().querySelector<HTMLButtonElement>("button.settings")!;
  const menu = () => shadowOf().querySelector<HTMLElement>('.menu[role="menu"]');
  const sub = () => shadowOf().querySelector<HTMLElement>('.submenu[role="menu"]');
  const items = () => [...menu()!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
  const active = () => shadowOf().activeElement;
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const key = (k: string) => shadowOf().activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, composed: true }));
  const open = async () => {
    gear().click();
    await flush();
  };

  it("the gear sits right after Export while idle and announces a menu", () => {
    setup();
    expect(gear().getAttribute("aria-label")).toBe("Export settings");
    expect(gear().getAttribute("aria-haspopup")).toBe("menu");
    expect(gear().getAttribute("aria-expanded")).toBe("false");
    expect(gear().previousElementSibling!.classList.contains("export")).toBe(true);
  });

  it("is not shown while exporting or showing a result", () => {
    const { ui } = setup();
    ui.setState({ kind: "working", stage: "reading", done: 0, total: 2 });
    expect(shadowOf().querySelector("button.settings")).toBeNull();
    ui.setState({ kind: "done", messages: 2, problems: [] });
    expect(shadowOf().querySelector("button.settings")).toBeNull();
  });

  it("opens a menu with Format and Order and their current values, focusing the first item", async () => {
    setup({ format: "html", order: "date" });
    await open();
    expect(gear().getAttribute("aria-expanded")).toBe("true");
    expect(items().map((i) => [i.querySelector(".text")!.textContent, i.querySelector(".value")!.textContent])).toEqual([
      ["Format", "HTML"],
      ["Order", "Oldest first"],
    ]);
    expect(items().every((i) => i.getAttribute("aria-haspopup") === "menu")).toBe(true);
    expect(active()).toBe(items()[0]);
  });

  it("an item opens a submenu with every option and the current one checked", async () => {
    setup({ format: "html", order: "date" });
    await open();
    items()[0].click();
    expect(items()[0].getAttribute("aria-expanded")).toBe("true");
    const options = [...sub()!.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
    expect(options.map((o) => o.querySelector(".text")!.textContent)).toEqual(["ZIP", "HTML"]);
    expect(options.map((o) => o.getAttribute("aria-checked"))).toEqual(["false", "true"]);
    expect(options[1].querySelector(".hint")!.textContent).toBeTruthy();
  });

  it("hovering an item opens its submenu, like WhatsApp", async () => {
    setup();
    await open();
    vi.useFakeTimers();
    items()[1].dispatchEvent(new MouseEvent("mouseover", { bubbles: true, composed: true }));
    expect(sub()).toBeNull();
    vi.advanceTimersByTime(200);
    expect(sub()!.getAttribute("aria-label")).toBe("Order");
    expect(active()).toBe(items()[1]);
    items()[0].dispatchEvent(new MouseEvent("mouseover", { bubbles: true, composed: true }));
    vi.advanceTimersByTime(200);
    expect(sub()!.getAttribute("aria-label")).toBe("Format");
    vi.useRealTimers();
  });

  it("clicking an item whose submenu is already open keeps it open", async () => {
    setup();
    await open();
    vi.useFakeTimers();
    items()[0].dispatchEvent(new MouseEvent("mouseover", { bubbles: true, composed: true }));
    vi.advanceTimersByTime(200);
    expect(sub()).not.toBeNull();
    items()[0].click();
    expect(sub()!.getAttribute("aria-label")).toBe("Format");
    expect(active()!.getAttribute("role")).toBe("menuitemradio");
  });

  it("a click before the hover delay opens the submenu once, and the hover timer doesn't close it", async () => {
    setup();
    await open();
    vi.useFakeTimers();
    items()[0].dispatchEvent(new MouseEvent("mouseover", { bubbles: true, composed: true }));
    items()[0].click();
    vi.advanceTimersByTime(200);
    expect(sub()!.getAttribute("aria-label")).toBe("Format");
  });

  it("choosing an option saves it and closes the menu, like WhatsApp", async () => {
    const { saved } = setup();
    await open();
    items()[0].click();
    sub()!.querySelectorAll<HTMLElement>('[role="menuitemradio"]')[1].click();
    await flush();
    expect(saved).toEqual([{ format: "html", order: "date" }]);
    expect(menu()).toBeNull();
    expect(active()).toBe(gear());
  });

  it("the arrow keys move through items and open and close submenus", async () => {
    setup();
    await open();
    key("ArrowDown");
    expect(active()).toBe(items()[1]);
    key("ArrowDown");
    expect(active()).toBe(items()[0]); // wraps
    key("ArrowRight");
    expect(sub()).not.toBeNull();
    expect(active()!.getAttribute("role")).toBe("menuitemradio");
    key("Escape");
    expect(sub()).toBeNull();
    expect(menu()).not.toBeNull();
    expect(active()).toBe(items()[0]);
    key("Escape");
    expect(menu()).toBeNull();
    expect(active()).toBe(gear());
  });

  it("stays open when the selection count changes, and ignores identical updates", async () => {
    const { ui } = setup();
    await open();
    const before = menu();
    ui.setState({ kind: "idle", count: 2 });
    expect(menu()).toBe(before);
    ui.setState({ kind: "idle", count: 3 });
    expect(menu()).not.toBeNull();
  });

  it("closes with the gear, a click outside, or Export", async () => {
    const { ui } = setup();
    const onExport = vi.fn();
    ui.onExport(onExport);
    await open();
    gear().click();
    expect(menu()).toBeNull();

    await open();
    document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, composed: true }));
    expect(menu()).toBeNull();

    await open();
    shadowOf().querySelector<HTMLButtonElement>("button.export")!.click();
    expect(menu()).toBeNull();
    expect(onExport).toHaveBeenCalledOnce();
  });

  it("a click inside the menu keeps it open", async () => {
    setup();
    await open();
    items()[1].dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, composed: true }));
    expect(menu()).not.toBeNull();
  });

  it("without settings access there is no gear", () => {
    const ui = mountExportUi(document);
    ui.setState({ kind: "idle", count: 1 });
    expect(shadowOf().querySelector("button.settings")).toBeNull();
  });

  it("takes its colors from WhatsApp's theme variables", () => {
    setup();
    const css = shadowOf().querySelector("style")!.textContent!;
    for (const v of ["--WDS-surface-default", "--WDS-content-default", "--WDS-accent", "--WDS-surface-highlight-RGB"]) expect(css).toContain(`var(${v}`);
  });
});

describe("settings menu motion", () => {
  afterEach(() => vi.useRealTimers());

  function setup() {
    const ui = mountExportUi(
      document,
      { load: async () => ({ format: "zip", order: "date" }), save: async () => {} },
      { motion: true },
    );
    ui.setState({ kind: "idle", count: 2 });
    return ui;
  }
  const gear = () => shadowOf().querySelector<HTMLButtonElement>("button.settings")!;
  const menu = () => shadowOf().querySelector<HTMLElement>(".menu");
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("the gear turns and the menu grows in when opening, once", async () => {
    const ui = setup();
    gear().click();
    await flush();
    expect(gear().classList.contains("turn-open")).toBe(true);
    expect(menu()!.classList.contains("enter")).toBe(true);
    ui.setState({ kind: "idle", count: 3 }); // a redraw doesn't replay the animation
    expect(gear().classList.contains("turn-open")).toBe(false);
    expect(menu()!.classList.contains("enter")).toBe(false);
  });

  it("the submenu grows in when it opens", async () => {
    setup();
    gear().click();
    await flush();
    shadowOf().querySelector<HTMLButtonElement>("[data-sub=format]")!.click();
    expect(shadowOf().querySelector(".submenu")!.classList.contains("enter")).toBe(true);
    expect(menu()!.classList.contains("enter")).toBe(false);
  });

  it("closing turns the gear back and fades the menu out before removing it", async () => {
    setup();
    gear().click();
    await flush();
    vi.useFakeTimers();
    gear().click();
    expect(gear().classList.contains("turn-close")).toBe(true);
    expect(menu()!.classList.contains("leave")).toBe(true);
    vi.advanceTimersByTime(200);
    expect(menu()).toBeNull();
  });

  it("reopening while the menu fades out keeps it", async () => {
    setup();
    gear().click();
    await flush();
    vi.useFakeTimers();
    gear().click();
    vi.useRealTimers();
    gear().click();
    await flush();
    await new Promise((r) => setTimeout(r, 250));
    expect(menu()).not.toBeNull();
    expect(menu()!.classList.contains("leave")).toBe(false);
  });

  it("result panels animate in when they appear", () => {
    const ui = setup();
    ui.setState({ kind: "done", messages: 1, problems: [] });
    expect(shadowOf().querySelector(".panel")!.classList.contains("enter")).toBe(true);
  });

  it("without motion nothing animates", async () => {
    const ui = mountExportUi(document, { load: async () => ({ format: "zip", order: "date" }), save: async () => {} });
    ui.setState({ kind: "idle", count: 1 });
    gear().click();
    await flush();
    expect(shadowOf().querySelector(".enter, .turn-open")).toBeNull();
  });
});
