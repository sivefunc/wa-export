// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { installKeyGuard, KEY_EVENT } from "../src/ui/key-guard";

let uninstall = () => {};
afterEach(() => {
  uninstall();
  document.body.innerHTML = "";
});

/** Our UI host with a focusable button inside an open shadow root, plus a "WhatsApp" window listener. */
function setup(keys: "own" | null) {
  uninstall = installKeyGuard(window); // registered first, like the document_start content script
  const whatsapp = vi.fn();
  window.addEventListener("keydown", whatsapp, true); // WhatsApp's capture listener, registered later
  const host = document.createElement("wa-export-ui");
  if (keys) host.dataset.keys = keys;
  const button = host.attachShadow({ mode: "open" }).appendChild(document.createElement("button"));
  document.body.append(host);
  const handed: KeyboardEvent[] = [];
  host.addEventListener(KEY_EVENT, (e) => handed.push((e as CustomEvent<KeyboardEvent>).detail));
  const press = (key: string, target: Element = button) => {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, composed: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };
  const cleanup = () => window.removeEventListener("keydown", whatsapp, true);
  const prev = uninstall;
  uninstall = () => (prev(), cleanup());
  return { host, whatsapp, handed, press };
}

describe("key guard", () => {
  it("while the menu is open, keys pressed in our UI reach only our UI, not WhatsApp", () => {
    const { whatsapp, handed, press } = setup("own");
    const event = press("Escape");
    expect(whatsapp).not.toHaveBeenCalled();
    expect(handed).toEqual([event]);
  });

  it("with the menu closed, keys pass through to WhatsApp untouched (Escape still cancels a selection)", () => {
    const { whatsapp, handed, press } = setup(null);
    press("Escape");
    expect(whatsapp).toHaveBeenCalledOnce();
    expect(handed).toEqual([]);
  });

  it("keys pressed outside our UI always reach WhatsApp", () => {
    const { whatsapp, handed, press } = setup("own");
    press("Escape", document.body);
    expect(whatsapp).toHaveBeenCalledOnce();
    expect(handed).toEqual([]);
  });

  it("uninstalling removes the guard", () => {
    const { whatsapp, press } = setup("own");
    uninstall();
    window.addEventListener("keydown", whatsapp, true);
    press("Escape");
    expect(whatsapp).toHaveBeenCalledOnce();
    window.removeEventListener("keydown", whatsapp, true);
  });
});
