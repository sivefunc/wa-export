import { orderings } from "../export/orderings";
import { writers } from "../export/writers";
import type { Settings } from "../settings";
import { findForwardButton, toolbarSlot } from "./placement";
import { buttonLabel, progressFraction, type UiState } from "./state";

export interface ExportUi {
  setState(s: UiState): void;
  /** Re-check where the UI belongs: next to Forward when the toolbar exists, floating otherwise. */
  place(): void;
  onExport(fn: () => void): void;
  onConfirm(fn: (ok: boolean) => void): void;
  onDismiss(fn: () => void): void;
  destroy(): void;
}

/** Where the ⚙ menu reads and writes the same settings as the options page. */
export interface SettingsAccess {
  load(): Promise<Settings>;
  save(s: Settings): Promise<void>;
}

// Colors come from WhatsApp's own theme variables (--WDS-*), which inherit into this shadow root, so the UI
// follows whatever theme WhatsApp shows. The fallbacks are WhatsApp's values, read live on 2026-10-24.
const STYLE = `
:host { all: initial;
  font: 14px/20px "Roboto Variable", Roboto, "Helvetica Neue", Helvetica, sans-serif;
  --surface: var(--WDS-surface-default, #fff); --text: var(--WDS-content-default, #0a0a0a);
  --muted: var(--WDS-content-deemphasized, rgba(0, 0, 0, .6)); --accent: var(--WDS-accent, #1daa61);
  --on-accent: var(--WDS-content-on-accent, #fff); --highlight: var(--WDS-surface-highlight-RGB, 194, 189, 184);
  --line: rgba(0, 0, 0, .1); --critical: #ea0038; }
@media (prefers-color-scheme: dark) {
  :host { --surface: var(--WDS-surface-default, #161717); --text: var(--WDS-content-default, #fafafa);
    --muted: var(--WDS-content-deemphasized, rgba(255, 255, 255, .6)); --accent: var(--WDS-accent, #21c063);
    --on-accent: var(--WDS-content-on-accent, #0a0a0a); --highlight: var(--WDS-surface-highlight-RGB, 255, 255, 255);
    --line: rgba(255, 255, 255, .1); --critical: #f15c6d; }
}
:host([hidden]) { display: none !important; }
:host([data-placement="toolbar"]) { position: relative; display: inline-flex; align-items: center; margin: 0 6px; }
:host([data-placement="floating"]) { position: fixed; right: 24px; bottom: 88px; z-index: 2147483000; }
.wrap { position: relative; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; color: var(--text); }
:host([data-placement="toolbar"]) .panel, :host([data-placement="toolbar"]) .menu { position: absolute; right: 0; bottom: calc(100% + 8px); }
button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; margin: 0; }
button:disabled { cursor: progress; }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.buttons { display: flex; align-items: center; gap: 4px; }
.export { position: relative; overflow: hidden; height: 40px; padding: 0 20px; border-radius: 20px;
  background: var(--accent); color: var(--on-accent); font-weight: 500; white-space: nowrap; }
.export:focus-visible { outline-color: var(--text); outline-offset: 2px; }
.export .label { position: relative; }
.export .bar { position: absolute; inset: 0 auto 0 0; background: rgba(255, 255, 255, .28); transition: width .2s ease; }
.settings { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; color: var(--muted); }
.settings:hover, .settings[aria-expanded="true"] { background: rgba(var(--highlight), .1); color: var(--text); }
svg { display: block; width: 24px; height: 24px; fill: currentColor; }
.panel, .menu, .submenu { background: var(--surface); color: var(--text); border: 1px solid var(--line); border-radius: 16px;
  box-shadow: 0 12px 16px -4px rgba(10, 10, 10, .1); }
.panel { padding: 16px 20px; width: max-content; max-width: min(420px, 80vw); }
.panel p { margin: 0 0 12px; font-size: 15px; font-weight: 500; }
.panel.error p { color: var(--critical); }
.panel ul { margin: 0 0 12px; padding-left: 18px; color: var(--muted); max-height: 40vh; overflow: auto; }
.panel li { margin: 2px 0; }
.row { display: flex; gap: 8px; justify-content: flex-end; }
.panel .row button { height: 36px; padding: 0 18px; border-radius: 18px; font-weight: 500; }
.secondary { color: var(--accent); border: 1px solid var(--line); }
.secondary:hover { background: rgba(var(--highlight), .1); }
.menu, .submenu { padding: 4px; min-width: 150px; max-width: 260px; width: max-content; }
.has-sub { position: relative; }
.submenu { position: absolute; right: calc(100% + 8px); bottom: -5px; min-width: 200px; }
.item { display: flex; align-items: center; width: 100%; min-height: 36px; padding: 0 12px 0 0; border-radius: 12px; text-align: start; }
.item:hover, .item:focus-visible, .item[aria-expanded="true"] { background: rgba(var(--highlight), .1); outline: none; }
.item .icon { display: flex; flex: none; justify-content: center; width: 40px; }
.item .icon svg { width: 18px; height: 18px; }
.item .text { flex: 1; font-weight: 420; white-space: nowrap; }
.item .value { margin-inline-start: 16px; color: var(--muted); white-space: nowrap; }
.item .caret { margin-inline-start: 4px; color: var(--muted); }
.item .caret svg { width: 18px; height: 18px; }
/* Motion: added only on the render where something appears or goes, so redraws don't replay it. */
.settings[aria-expanded="true"] svg { transform: rotate(180deg); }
.settings.turn-open svg { animation: turn-open 420ms cubic-bezier(.2, .8, .2, 1); }
.settings.turn-close svg { animation: turn-close 420ms cubic-bezier(.2, .8, .2, 1); }
.menu, .submenu, .panel { transform-origin: bottom right; }
.enter { animation: pop-in 180ms cubic-bezier(.1, .82, .25, 1); }
.leave { animation: pop-out 140ms ease-in forwards; pointer-events: none; }
@keyframes turn-open { from { transform: rotate(0); } to { transform: rotate(180deg); } }
@keyframes turn-close { from { transform: rotate(180deg); } to { transform: rotate(0); } }
@keyframes pop-in { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: scale(1); } }
@keyframes pop-out { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(.92); } }
@media (prefers-reduced-motion: reduce) { .enter, .leave, .settings svg { animation: none !important; } }
.option { min-height: 48px; padding-block: 6px; }
.option .label { display: flex; flex-direction: column; flex: 1; }
.option .hint { color: var(--muted); font-size: 12.5px; line-height: 17px; white-space: normal; }
`;

// Material Symbols (Apache-2.0).
const ICONS = {
  settings:
    "m9.25 22-.4-3.2a7.6 7.6 0 0 1-1.18-.68l-2.97 1.25-2.75-4.75 2.58-1.95a7.6 7.6 0 0 1 0-1.34L1.95 9.38l2.75-4.76 2.97 1.25c.37-.27.77-.5 1.18-.67l.4-3.2h5.5l.4 3.2c.42.17.81.4 1.18.67l2.97-1.25 2.75 4.76-2.58 1.95a7.6 7.6 0 0 1 0 1.34l2.58 1.95-2.75 4.75-2.97-1.25c-.37.27-.76.5-1.18.68l-.4 3.2h-5.5Zm2.8-6.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  format: "M8 18h8v-2H8v2Zm0-4h8v-2H8v2Zm-2 8a2 2 0 0 1-2-2V4c0-1.1.9-2 2-2h8l6 6v12a2 2 0 0 1-2 2H6Zm7-13V4H6v16h12V9h-5Z",
  order: "M3 18v-2h6v2H3Zm0-5v-2h12v2H3Zm0-5V6h18v2H3Z",
  caret: "M10 17V7l5 5-5 5Z",
  check: "M9.55 18 3.85 12.3l1.43-1.42 4.27 4.27 9.18-9.18 1.42 1.43L9.55 18Z",
};
const icon = (name: keyof typeof ICONS) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

type SettingName = keyof Settings;

interface Choice {
  id: string;
  text: string;
  hint: string;
}

const MENU: { name: SettingName; text: string; icon: keyof typeof ICONS; choices: () => Choice[] }[] = [
  { name: "format", text: "Format", icon: "format", choices: () => Object.values(writers).map((w) => ({ id: w.id, text: w.fileType, hint: w.description })) },
  { name: "order", text: "Order", icon: "order", choices: () => Object.values(orderings).map((o) => ({ id: o.id, text: o.shortLabel, hint: o.label })) },
];

interface MenuState {
  settings: Settings;
  sub: SettingName | null; // the open submenu
  leaving: boolean; // fading out; removed when the animation ends
}

/** One-shot animation classes for a single render. */
interface Fx {
  gear?: "turn-open" | "turn-close";
  menu?: "enter" | "leave";
  sub?: "enter";
  panel?: "enter";
}

const LEAVE_MS = 150;

function menuHtml(m: MenuState, fx: Fx): string {
  const entries = MENU.map((entry) => {
    const choices = entry.choices();
    const current = choices.find((c) => c.id === m.settings[entry.name]) ?? choices[0];
    const open = m.sub === entry.name;
    const sub = open
      ? `<div class="submenu${fx.sub ? ` ${fx.sub}` : ""}" role="menu" aria-label="${esc(entry.text)}">${choices
          .map((c) => {
            const checked = c.id === current?.id;
            return `<button class="item option" role="menuitemradio" aria-checked="${checked}" data-setting="${entry.name}" data-value="${esc(c.id)}">
              <span class="icon">${checked ? icon("check") : ""}</span>
              <span class="label"><span class="text">${esc(c.text)}</span><span class="hint">${esc(c.hint)}</span></span></button>`;
          })
          .join("")}</div>`
      : "";
    return `<div class="has-sub"><button class="item" role="menuitem" aria-haspopup="menu" aria-expanded="${open}" data-sub="${entry.name}">
      <span class="icon">${icon(entry.icon)}</span><span class="text">${esc(entry.text)}</span>
      <span class="value">${esc(current?.text ?? "")}</span><span class="caret">${icon("caret")}</span></button>${sub}</div>`;
  }).join("");
  return `<div class="menu${fx.menu ? ` ${fx.menu}` : ""}" role="menu" aria-label="Export settings">${entries}</div>`;
}

function render(s: UiState, gear: boolean, menu: MenuState | null, fx: Fx): string {
  const label = esc(buttonLabel(s));
  const panel = `panel${fx.panel ? ` ${fx.panel}` : ""}`;
  switch (s.kind) {
    case "hidden":
      return "";
    case "idle": {
      const expanded = !!menu && !menu.leaving;
      const settings = gear
        ? `<button class="settings${fx.gear ? ` ${fx.gear}` : ""}" aria-label="Export settings" title="Export settings" aria-haspopup="menu" aria-expanded="${expanded}">${icon("settings")}</button>`
        : "";
      return `${menu ? menuHtml(menu, fx) : ""}<div class="buttons"><button class="export">${label}</button>${settings}</div>`;
    }
    case "working": {
      const pct = Math.round((progressFraction(s) ?? 0) * 100);
      return `<button class="export" disabled><span class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"
        aria-valuenow="${pct}" style="width: ${pct}%"></span><span class="label">${label}</span></button>`;
    }
    case "confirm":
      return `<div class="${panel}"><p>${label}</p><div class="row">
        <button class="secondary cancel">Cancel</button><button class="export continue">Continue</button></div></div>`;
    case "done": {
      const list = s.problems.length ? `<ul>${s.problems.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : "";
      return `<div class="${panel}"><p>${label}</p>${list}<div class="row"><button class="secondary dismiss">OK</button></div></div>`;
    }
    case "error":
      return `<div class="${panel} error"><p>${label}</p><div class="row"><button class="secondary dismiss">OK</button></div></div>`;
  }
}

/** Animations run unless the user asked the system for reduced motion (or there is no matchMedia, as in tests). */
function motionAllowed(doc: Document): boolean {
  const mq = doc.defaultView?.matchMedia;
  return typeof mq === "function" && !mq.call(doc.defaultView, "(prefers-reduced-motion: reduce)").matches;
}

export function mountExportUi(doc: Document, settingsAccess?: SettingsAccess, opts: { motion?: boolean } = {}): ExportUi {
  const motion = opts.motion ?? motionAllowed(doc);
  const host = doc.createElement("wa-export-ui");
  const shadow = host.attachShadow({ mode: "open" });
  const handlers = { export: () => {}, confirm: (_ok: boolean) => {}, dismiss: () => {} };
  let state: UiState = { kind: "hidden" };
  let drawn = "";
  let menu: MenuState | null = null;
  let opening = 0; // ignores a settings load that finishes after the menu was closed again
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;

  const focus = (selector: string) => shadow.querySelector<HTMLElement>(selector)?.focus();

  const draw = (fx: Fx = {}) => {
    const html = `<style>${STYLE}</style><div class="wrap">${render(state, !!settingsAccess, menu, motion ? fx : {})}</div>`;
    if (html !== drawn) shadow.innerHTML = drawn = html;
    host.hidden = state.kind === "hidden";
    place();
  };

  const onPointer = (e: Event) => {
    if (!e.composedPath().includes(host)) closeMenu(false);
  };
  const isOpen = () => !!menu && !menu.leaving;
  function closeMenu(returnFocus = true) {
    opening++;
    clearTimeout(hoverTimer);
    doc.removeEventListener("pointerdown", onPointer, true);
    if (!isOpen()) return;
    if (motion && state.kind === "idle") {
      menu = { ...menu!, sub: null, leaving: true };
      draw({ gear: "turn-close", menu: "leave" });
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => {
        menu = null;
        draw();
      }, LEAVE_MS);
    } else {
      menu = null;
      draw();
    }
    if (returnFocus) focus("button.settings");
  }
  async function openMenu() {
    if (!settingsAccess) return;
    const ticket = ++opening;
    const settings = await settingsAccess.load();
    if (ticket !== opening || state.kind !== "idle") return;
    clearTimeout(leaveTimer);
    menu = { settings, sub: null, leaving: false };
    doc.addEventListener("pointerdown", onPointer, true);
    draw({ gear: "turn-open", menu: "enter" });
    focus(".menu [role=menuitem]");
  }
  /** From the keyboard or a click, focus moves into the submenu; on hover it stays on the item. */
  function openSub(name: SettingName, focusInside = true) {
    clearTimeout(hoverTimer);
    if (!isOpen()) return;
    if (menu!.sub === name) return void (focusInside && focus(`.submenu [aria-checked="true"]`));
    menu = { ...menu!, sub: name };
    draw({ sub: "enter" });
    focus(focusInside ? `.submenu [aria-checked="true"]` : `[data-sub="${name}"]`);
  }
  function closeSub() {
    if (!isOpen() || !menu?.sub) return;
    const name = menu.sub;
    menu = { ...menu, sub: null };
    draw();
    focus(`[data-sub="${name}"]`);
  }
  async function choose(name: SettingName, value: string) {
    if (!isOpen() || !settingsAccess) return;
    const next = { ...menu!.settings, [name]: value };
    closeMenu();
    await settingsAccess.save(next);
  }

  shadow.addEventListener("click", (event) => {
    const btn = (event.target as Element).closest("button");
    if (!btn || btn.disabled) return;
    if (btn.classList.contains("settings")) return void (isOpen() ? closeMenu() : openMenu());
    // Like WhatsApp: a click opens the submenu (or moves into it); it never toggles one the pointer just opened.
    if (btn.dataset.sub) return openSub(btn.dataset.sub as SettingName);
    if (btn.dataset.setting) return void choose(btn.dataset.setting as SettingName, btn.dataset.value!);
    if (btn.classList.contains("continue")) handlers.confirm(true);
    else if (btn.classList.contains("cancel")) handlers.confirm(false);
    else if (btn.classList.contains("dismiss")) handlers.dismiss();
    else if (btn.classList.contains("export")) {
      closeMenu(false);
      handlers.export();
    }
  });

  shadow.addEventListener("mouseover", (event) => {
    const item = (event.target as Element).closest<HTMLElement>("[data-sub]");
    clearTimeout(hoverTimer);
    if (!item || !isOpen() || menu!.sub === item.dataset.sub) return;
    hoverTimer = setTimeout(() => openSub(item.dataset.sub as SettingName, false), 150);
  });

  // Keyboard like WhatsApp's menus: arrows move, Right/Enter open a submenu, Left/Escape go back.
  shadow.addEventListener("keydown", (event) => {
    if (!isOpen()) return;
    const e = event as KeyboardEvent;
    const current = shadow.activeElement as HTMLElement | null;
    const list = current?.closest(".submenu, .menu");
    const siblings = list ? [...list.querySelectorAll<HTMLElement>(".item")].filter((el) => el.closest(".submenu, .menu") === list) : [];
    const i = current ? siblings.indexOf(current) : -1;
    const inSub = !!current?.closest(".submenu");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const next = siblings[(i + (e.key === "ArrowDown" ? 1 : siblings.length - 1)) % siblings.length];
      next?.focus();
    } else if (e.key === "ArrowRight" && current?.dataset.sub) openSub(current.dataset.sub as SettingName);
    else if (e.key === "ArrowLeft" && inSub) closeSub();
    else if (e.key === "Escape") inSub ? closeSub() : closeMenu();
    else return;
    e.preventDefault();
    e.stopPropagation();
  });

  const place = () => {
    const forward = findForwardButton(doc);
    const slot = forward && toolbarSlot(forward);
    if (slot?.parentElement) {
      if (host.previousElementSibling !== slot) slot.insertAdjacentElement("afterend", host);
      host.dataset.placement = "toolbar";
    } else {
      if (host.parentElement !== doc.body) doc.body.append(host);
      host.dataset.placement = "floating";
    }
  };

  return {
    setState(s) {
      const appeared = s.kind !== state.kind && (s.kind === "confirm" || s.kind === "done" || s.kind === "error");
      state = s;
      if (s.kind !== "idle" && menu) {
        clearTimeout(leaveTimer);
        closeMenu(false);
        menu = null;
      }
      draw(appeared ? { panel: "enter" } : {});
    },
    place,
    onExport: (fn) => void (handlers.export = fn),
    onConfirm: (fn) => void (handlers.confirm = fn),
    onDismiss: (fn) => void (handlers.dismiss = fn),
    destroy: () => {
      closeMenu(false);
      clearTimeout(leaveTimer);
      host.remove();
    },
  };
}
