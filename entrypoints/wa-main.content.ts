import { createRpcServer, windowTransport } from "../src/bridge/rpc";
import { createHandlers, type WppLike } from "../src/page/handlers";

export default defineContentScript({
  matches: ["https://web.whatsapp.com/*"],
  runAt: "document_start",
  world: "MAIN",
  main() {
    createRpcServer(windowTransport("page"), createHandlers(() => (window as unknown as { WPP?: WppLike }).WPP));
  },
});
