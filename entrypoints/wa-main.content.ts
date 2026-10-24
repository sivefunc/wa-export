import { createRpcServer, windowTransport } from "../src/bridge/rpc";
import { createHandlers, type ReuploadManagerLike, type WppLike } from "../src/page/handlers";

type PageWindow = Window & { WPP?: WppLike; require?: (name: string) => any };

function reuploadManager(): ReuploadManagerLike | null {
  try {
    return (window as PageWindow).require?.("WAWebRequestMediaReuploadManager")?.RequestMediaReuploadManager ?? null;
  } catch {
    return null;
  }
}

export default defineContentScript({
  matches: ["https://web.whatsapp.com/*"],
  runAt: "document_start",
  world: "MAIN",
  main() {
    createRpcServer(
      windowTransport("page"),
      createHandlers(() => (window as PageWindow).WPP, reuploadManager),
    );
  },
});
