import type { Settings } from "../settings";
import { findForwardButton, toolbarSlot } from "./placement";
import { readSettingsFields, settingsFieldsHtml } from "./settings-form";
import { buttonLabel, progressFraction, type UiState } from "./state";

/** Where the ⚙ panel reads and writes the same settings as the options page. */
export interface SettingsAccess {
  load(): Promise<Settings>;
  save(s: Settings): Promise<void>;
}

export interface ExportUi {
  setState(s: UiState): void;
  /** Re-check where the UI belongs: next to Forward when the toolbar exists, floating otherwise. */
  place(): void;
  onExport(fn: () => void): void;
  onConfirm(fn: (ok: boolean) => void): void;
  onDismiss(fn: () => void): void;
  destroy(): void;
}

const STYLE = `
:host { all: initial; font: 14px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
  --accent: #008069; --accent-text: #fff; --panel: #fff; --text: #111b21; --muted: #54656f; --warn: #b3261e; --border: #d1d7db; }
@media (prefers-color-scheme: dark) {
  :host { --accent: #21c063; --accent-text: #0b141a; --panel: #233138; --text: #e9edef; --muted: #aebac1; --warn: #f28b82; --border: #3b4a54; }
}
:host([hidden]) { display: none !important; }
:host([data-placement="toolbar"]) { position: relative; display: inline-flex; align-items: center; margin: 0 6px; }
:host([data-placement="floating"]) { position: fixed; right: 24px; bottom: 88px; z-index: 2147483000; }
.wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
:host([hidden]) { display: none !important; }
:host([data-placement="toolbar"]) .panel { position: absolute; right: 0; bottom: calc(100% + 8px); }
button { font: inherit; cursor: pointer; border: 0; border-radius: 18px; padding: 7px 14px; }
button:disabled { cursor: progress; }
.export .label { position: relative; }
.export .bar { position: absolute; inset: 0 auto 0 0; background: rgba(255,255,255,.28); transition: width .2s ease; }
.export { position: relative; overflow: hidden; background: var(--accent); color: var(--accent-text); font-weight: 600; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,.25); }
.panel { background: var(--panel); color: var(--text); border: 1px solid var(--border); border-radius: 12px;
  padding: 12px 14px; width: max-content; max-width: min(420px, 80vw); box-shadow: 0 4px 16px rgba(0,0,0,.25); }
.panel p { margin: 0 0 8px; font-weight: 600; }
.panel.error p { color: var(--warn); }
.panel ul { margin: 0 0 8px; padding-left: 18px; color: var(--muted); max-height: 40vh; overflow: auto; }
.panel li { margin: 2px 0; }
.row { display: flex; gap: 8px; justify-content: flex-end; }
.secondary { background: transparent; color: var(--text); border: 1px solid var(--border); }
.buttons { display: flex; align-items: center; gap: 6px; }
.settings { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; background: transparent; color: var(--muted); }
.settings:hover, .settings[aria-expanded="true"] { background: rgba(134, 150, 160, .18); color: var(--text); }
.settings svg { width: 20px; height: 20px; fill: currentColor; }
.settings-panel label { display: flex; flex-direction: column; gap: 4px; margin: 0 0 10px; font-weight: 600; }
.settings-panel select { font: inherit; font-weight: 400; padding: 6px; min-width: 260px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--panel); color: var(--text); }
.settings-panel [role="status"] { margin: 0; min-height: 1.35em; color: var(--muted); font-weight: 400; }
`;

const GEAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13a7.8 7.8 0 0 0 0-2l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.3 7.3 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.4h-4a.5.5 0 0 0-.5.4l-.4 2.6a7.3 7.3 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.6 11a7.8 7.8 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.6l2 3.5c.1.2.4.3.6.2l2.5-1c.5.4 1.1.7 1.7 1l.4 2.6c0 .2.2.4.5.4h4c.3 0 .5-.2.5-.4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6L19.4 13ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"/></svg>`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

interface Extras {
  gear: boolean;
  settings: Settings | null; // the open ⚙ panel's values; null when closed
}

function settingsPanel(values: Settings): string {
  return `<div class="panel settings-panel" role="dialog" aria-label="Export settings"><p>Export settings</p>
    ${settingsFieldsHtml(values)}<p role="status" aria-live="polite"></p></div>`;
}

function render(s: UiState, x: Extras): string {
  const label = esc(buttonLabel(s));
  switch (s.kind) {
    case "hidden":
      return "";
    case "idle": {
      const gear = x.gear
        ? `<button class="settings" aria-label="Export settings" title="Export settings" aria-expanded="${x.settings ? "true" : "false"}">${GEAR}</button>`
        : "";
      return `${x.settings ? settingsPanel(x.settings) : ""}<div class="buttons"><button class="export">${label}</button>${gear}</div>`;
    }
    case "working": {
      const pct = Math.round((progressFraction(s) ?? 0) * 100);
      return `<button class="export" disabled><span class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"
        aria-valuenow="${pct}" style="width: ${pct}%"></span><span class="label">${label}</span></button>`;
    }
    case "confirm":
      return `<div class="panel"><p>${label}</p><div class="row">
        <button class="secondary cancel">Cancel</button><button class="export continue">Continue</button></div></div>`;
    case "done": {
      const list = s.problems.length ? `<ul>${s.problems.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : "";
      return `<div class="panel"><p>${label}</p>${list}<div class="row"><button class="secondary dismiss">OK</button></div></div>`;
    }
    case "error":
      return `<div class="panel error"><p>${label}</p><div class="row"><button class="secondary dismiss">OK</button></div></div>`;
  }
}

export function mountExportUi(doc: Document, settingsAccess?: SettingsAccess): ExportUi {
  const host = doc.createElement("wa-export-ui");
  const shadow = host.attachShadow({ mode: "open" });
  const handlers = { export: () => {}, confirm: (_ok: boolean) => {}, dismiss: () => {} };
  let state: UiState = { kind: "hidden" };
  let settings: Settings | null = null; // non-null while the ⚙ panel is open
  let opening = 0; // ignores a load that finishes after the panel was closed again

  const draw = () => {
    shadow.innerHTML = `<style>${STYLE}</style><div class="wrap">${render(state, { gear: !!settingsAccess, settings })}</div>`;
    host.hidden = state.kind === "hidden";
    place();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeSettings();
  };
  const onPointer = (e: Event) => {
    if (!e.composedPath().includes(host)) closeSettings();
  };
  function closeSettings() {
    opening++;
    doc.removeEventListener("keydown", onKey, true);
    doc.removeEventListener("pointerdown", onPointer, true);
    if (!settings) return;
    settings = null;
    draw();
  }
  async function openSettings() {
    if (!settingsAccess) return;
    const ticket = ++opening;
    const loaded = await settingsAccess.load();
    if (ticket !== opening || state.kind !== "idle") return;
    settings = loaded;
    doc.addEventListener("keydown", onKey, true);
    doc.addEventListener("pointerdown", onPointer, true);
    draw();
  }

  shadow.addEventListener("click", (event) => {
    const btn = (event.target as Element).closest("button");
    if (!btn || btn.disabled) return;
    if (btn.classList.contains("settings")) return void (settings ? closeSettings() : openSettings());
    if (btn.classList.contains("continue")) handlers.confirm(true);
    else if (btn.classList.contains("cancel")) handlers.confirm(false);
    else if (btn.classList.contains("dismiss")) handlers.dismiss();
    else if (btn.classList.contains("export")) {
      closeSettings();
      handlers.export();
    }
  });

  shadow.addEventListener("change", async (event) => {
    const panel = (event.target as Element).closest(".settings-panel");
    if (!panel || !settingsAccess) return;
    const next = readSettingsFields(panel);
    settings = next;
    const status = panel.querySelector<HTMLElement>("[role=status]")!;
    try {
      await settingsAccess.save(next);
      status.textContent = "Saved";
    } catch {
      status.textContent = "Couldn't save";
    }
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
      state = s;
      if (s.kind !== "idle" && settings) closeSettings();
      draw();
    },
    place,
    onExport: (fn) => void (handlers.export = fn),
    onConfirm: (fn) => void (handlers.confirm = fn),
    onDismiss: (fn) => void (handlers.dismiss = fn),
    destroy: () => {
      closeSettings();
      host.remove();
    },
  };
}
