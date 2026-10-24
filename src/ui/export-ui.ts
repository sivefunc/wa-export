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
`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function render(s: UiState): string {
  const label = esc(buttonLabel(s));
  switch (s.kind) {
    case "hidden":
      return "";
    case "idle":
      return `<button class="export">${label}</button>`;
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

export function mountExportUi(doc: Document): ExportUi {
  const host = doc.createElement("wa-export-ui");
  const shadow = host.attachShadow({ mode: "open" });
  const handlers = { export: () => {}, confirm: (_ok: boolean) => {}, dismiss: () => {} };

  shadow.addEventListener("click", (event) => {
    const btn = (event.target as Element).closest("button");
    if (!btn || btn.disabled) return;
    if (btn.classList.contains("continue")) handlers.confirm(true);
    else if (btn.classList.contains("cancel")) handlers.confirm(false);
    else if (btn.classList.contains("dismiss")) handlers.dismiss();
    else if (btn.classList.contains("export")) handlers.export();
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
      shadow.innerHTML = `<style>${STYLE}</style><div class="wrap">${render(s)}</div>`;
      host.hidden = s.kind === "hidden";
      place();
    },
    place,
    onExport: (fn) => void (handlers.export = fn),
    onConfirm: (fn) => void (handlers.confirm = fn),
    onDismiss: (fn) => void (handlers.dismiss = fn),
    destroy: () => host.remove(),
  };
}
