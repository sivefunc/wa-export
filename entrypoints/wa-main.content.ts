export default defineContentScript({
  matches: ["https://web.whatsapp.com/*"],
  runAt: "document_start",
  world: "MAIN",
  main() {},
});
