import type { SelectionSnapshot } from "../dom/selection-tracker";
import type { CollectOptions, CollectResult } from "../export/collect";
import { problemLines } from "../export/render-chat-md";
import type { Writer } from "../export/writers";
import type { Settings } from "../settings";
import type { UiState } from "./state";

export interface ControllerDeps {
  setState(s: UiState): void;
  loadSettings(): Promise<Settings>;
  collect(o: Omit<CollectOptions, "rpc">): Promise<CollectResult>;
  getWriter(id: string): Writer;
  save(blob: Blob, filename: string): void;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** The Export button's behavior, independent of the DOM and the page bridge. */
export function createExportController(d: ControllerDeps) {
  let selection: SelectionSnapshot = { active: false, ids: [] };
  let state: UiState = { kind: "hidden" };
  let running = false;
  let pendingConfirm: ((ok: boolean) => void) | null = null;

  const set = (s: UiState) => {
    state = s;
    d.setState(s);
  };
  const showSelection = () => set(selection.active ? { kind: "idle", count: selection.ids.length } : { kind: "hidden" });

  return {
    selectionChanged(s: SelectionSnapshot) {
      selection = s;
      // A result or a question stays on screen until the user acts on it.
      if (state.kind === "idle" || state.kind === "hidden") showSelection();
    },

    async exportNow() {
      if (running) return;
      running = true;
      try {
        const settings = await d.loadSettings();
        const res = await d.collect({
          ids: [...selection.ids],
          orderingId: settings.order,
          onProgress: (done, total) => set({ kind: "working", done, total }),
          confirmLargeExport: (bytes) =>
            new Promise<boolean>((resolve) => {
              pendingConfirm = resolve;
              set({ kind: "confirm", bytes });
            }),
        });
        if (!res.ok) return set({ kind: "error", message: res.error.message });
        try {
          const { blob, filename } = await d.getWriter(settings.format).write(res.bundle);
          d.save(blob, filename);
        } catch (err) {
          return set({ kind: "error", message: `Couldn't create the export file: ${errorText(err)}` });
        }
        set({ kind: "done", messages: res.bundle.records.length, problems: problemLines(res.bundle) });
      } catch (err) {
        set({ kind: "error", message: `Export failed: ${errorText(err)}` });
      } finally {
        running = false;
      }
    },

    confirm(ok: boolean) {
      const resolve = pendingConfirm;
      pendingConfirm = null;
      if (ok) set({ kind: "working", done: 0, total: 1 });
      resolve?.(ok);
    },

    dismiss: showSelection,
  };
}
