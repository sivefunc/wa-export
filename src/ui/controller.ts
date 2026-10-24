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
  let exportedKey = ""; // the selection the current summary belongs to

  const set = (s: UiState) => {
    state = s;
    d.setState(s);
  };
  const showSelection = () => set(selection.active ? { kind: "idle", count: selection.ids.length } : { kind: "hidden" });

  return {
    selectionChanged(s: SelectionSnapshot) {
      selection = s;
      // A result stays on screen until dismissed, or until the user starts ticking a new selection.
      const newSelection = s.active && s.ids.length > 0 && s.ids.join() !== exportedKey;
      if (state.kind === "idle" || state.kind === "hidden") showSelection();
      else if ((state.kind === "done" || state.kind === "error") && newSelection) showSelection();
    },

    async exportNow() {
      if (running) return;
      running = true;
      exportedKey = selection.ids.join();
      try {
        const settings = await d.loadSettings();
        const writer = d.getWriter(settings.format);
        const res = await d.collect({
          ids: [...selection.ids],
          orderingId: settings.order,
          limits: writer.limits,
          avatars: writer.wantsAvatars ?? false,
          onProgress: (p) => set({ kind: "working", ...p }),
          confirmLargeExport: (bytes) =>
            new Promise<boolean>((resolve) => {
              pendingConfirm = resolve;
              set({ kind: "confirm", bytes });
            }),
        });
        if (!res.ok) return set({ kind: "error", message: res.error.message });
        try {
          const writing = (done: number) => set({ kind: "working", stage: "writing", fileType: writer.fileType, done, total: 100 });
          writing(0);
          const { blob, filename } = await writer.write(res.bundle, writing);
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
      if (ok) set({ kind: "working", stage: "downloading", done: 0, total: 1 });
      resolve?.(ok);
    },

    dismiss: showSelection,
  };
}
