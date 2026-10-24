import { createRpcClient, windowTransport } from "../src/bridge/rpc";
import { SelectionTracker } from "../src/dom/selection-tracker";
import { collect } from "../src/export/collect";
import { getWriter } from "../src/export/writers";
import { loadSettings, settingsItem } from "../src/settings";
import { createExportController } from "../src/ui/controller";
import { mountExportUi } from "../src/ui/export-ui";
import { saveBlob } from "../src/ui/save";

export default defineContentScript({
  matches: ["https://web.whatsapp.com/*"],
  runAt: "document_idle",
  main(ctx) {
    const rpc = createRpcClient(windowTransport("content"));
    const ui = mountExportUi(document, { load: loadSettings, save: (s) => settingsItem.setValue(s) });
    const controller = createExportController({
      setState: ui.setState,
      loadSettings,
      collect: (o) => collect({ ...o, rpc }),
      getWriter,
      save: saveBlob,
    });
    ui.onExport(() => void controller.exportNow());
    ui.onConfirm(controller.confirm);
    ui.onDismiss(controller.dismiss);

    const tracker = new SelectionTracker(document, controller.selectionChanged, ui.place);
    tracker.start();
    ui.setState({ kind: "hidden" });

    ctx.onInvalidated(() => {
      tracker.stop();
      ui.destroy();
    });
  },
});
