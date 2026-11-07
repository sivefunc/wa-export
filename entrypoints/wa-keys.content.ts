import { installKeyGuard } from "../src/ui/key-guard";

// Must run before WhatsApp's own scripts so its keyboard guard is the first window listener.
export default defineContentScript({
  matches: ["https://web.whatsapp.com/*"],
  runAt: "document_start",
  main() {
    installKeyGuard(window);
  },
});
