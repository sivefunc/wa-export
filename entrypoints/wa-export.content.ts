import { createRpcClient, windowTransport } from "../src/bridge/rpc";
import { SelectionTracker, type SelectionSnapshot } from "../src/dom/selection-tracker";

export default defineContentScript({
  matches: ["https://web.whatsapp.com/*"],
  runAt: "document_idle",
  main() {
    const rpc = createRpcClient(windowTransport("content"));

    // Dev-only: expose what the page bridge returns for the current selection, for live probing.
    const probe = async (s: SelectionSnapshot) => {
      if (!import.meta.env.DEV) return;
      const result: Record<string, unknown> = { at: new Date().toISOString(), selection: s };
      try {
        result.health = await rpc.call("HEALTH", {}, 5_000);
        if (s.ids.length) result.messages = await rpc.call("GET_MESSAGES", { ids: s.ids }, 30_000);
      } catch (err) {
        result.error = String(err);
      }
      document.documentElement.dataset.waExportProbe = JSON.stringify(result);
    };

    const tracker = new SelectionTracker(document, (s) => void probe(s));
    tracker.start();
    void probe(tracker.snapshot());
  },
});
