import { SEL } from "./selectors";

export interface SelectionSnapshot {
  active: boolean;
  ids: string[]; // in first-checked order
}

const GEOMETRY_SLACK_PX = 24;

export function checkedState(el: Element): boolean | null {
  const aria = el.getAttribute("aria-checked");
  if (aria === "true") return true;
  if (aria === "false") return false;
  if (el instanceof HTMLInputElement && el.type === "checkbox") return el.checked;
  return null;
}

function isVisible(el: Element): boolean {
  if (!el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return false;
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  return style?.display !== "none" && style?.visibility !== "hidden";
}

/** Select mode exists only inside an open chat; checkboxes elsewhere (e.g. the login page) don't count. */
export function isSelectionModeActive(doc: Document): boolean {
  const root = doc.querySelector(SEL.chatRoot);
  return !!root && [...root.querySelectorAll(SEL.checkbox)].some(isVisible);
}

/** The row's checkbox: nested inside it, else the nearest visible one beside it on screen. */
function findControlForRow(row: Element, root: Element): Element | null {
  const nested = [...row.querySelectorAll(SEL.checkbox)].find(isVisible);
  if (nested) return nested;

  const rr = row.getBoundingClientRect();
  const center = (rr.top + rr.bottom) / 2;
  let best: { el: Element; distance: number } | null = null;
  for (const el of root.querySelectorAll(SEL.checkbox)) {
    const owner = el.closest(SEL.messageRow);
    if ((owner && owner !== row) || !isVisible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom < rr.top - GEOMETRY_SLACK_PX || r.top > rr.bottom + GEOMETRY_SLACK_PX) continue;
    const distance = Math.abs((r.top + r.bottom) / 2 - center);
    if (!best || distance < best.distance) best = { el, distance };
  }
  return best?.el ?? null;
}

export class SelectionTracker {
  private ids = new Set<string>();
  private active = false;
  private root: Element | null = null;
  private last = "";
  private frame = 0;
  private observer: MutationObserver | null = null;
  private readonly onClick = () => this.schedule();

  constructor(
    private doc: Document,
    private onChange: (s: SelectionSnapshot) => void,
    /** Called after every pass, so the UI can follow WhatsApp re-rendering its toolbar. */
    private onTick: () => void = () => {},
  ) {
    this.last = JSON.stringify(this.snapshot());
  }

  start(): void {
    // Observe the whole body: WhatsApp replaces #main when switching chats.
    this.doc.addEventListener("click", this.onClick, true);
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(this.doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-checked", "aria-selected", "data-icon", "class"],
    });
    this.schedule();
  }

  stop(): void {
    this.doc.removeEventListener("click", this.onClick, true);
    this.observer?.disconnect();
    this.observer = null;
    cancelAnimationFrame(this.frame);
  }

  snapshot(): SelectionSnapshot {
    return { active: this.active, ids: [...this.ids] };
  }

  /** Read the visible rows' checkbox state into the persistent selection. */
  reconcile(): void {
    this.active = isSelectionModeActive(this.doc);
    const root = this.doc.querySelector(SEL.chatRoot);
    // WhatsApp replaces #main on chat switch, so a new element means a new chat.
    if (!this.active || root !== this.root) this.ids.clear();
    this.root = root;
    if (this.active && root) {
      const rows = [...root.querySelectorAll<HTMLElement>(SEL.messageRow)];
      for (const row of rows) {
        const id = row.dataset.id;
        const control = id ? findControlForRow(row, root) : null;
        const state = control ? checkedState(control) : null;
        if (state === true) this.ids.add(id!);
        else if (state === false) this.ids.delete(id!);
      }
    }
    this.emitIfChanged();
    this.onTick();
  }

  private schedule(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.reconcile());
  }

  private emitIfChanged(): void {
    const snap = this.snapshot();
    const key = JSON.stringify(snap);
    if (key === this.last) return;
    this.last = key;
    if (import.meta.env.DEV) this.doc.documentElement.dataset.waExportSelection = key;
    this.onChange(snap);
  }
}
