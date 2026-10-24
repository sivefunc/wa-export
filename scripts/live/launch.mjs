// Launch Chromium with the built extension, a persistent profile (keeps the WhatsApp login) and a CDP port.
// Usage: node scripts/live/launch.mjs [extensionDir]   (default .output/chrome-mv3)
import { resolve } from "node:path";
import { chromium } from "playwright";

const ext = resolve(process.argv[2] ?? ".output/chrome-mv3");
const context = await chromium.launchPersistentContext(resolve(".live/profile"), {
  channel: "chromium",
  headless: false,
  acceptDownloads: true,
  downloadsPath: resolve(".live/downloads"),
  viewport: null,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, "--remote-debugging-port=9333"],
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto("https://web.whatsapp.com");
console.log(`launched with ${ext}; CDP on http://localhost:9333`);
context.on("close", () => process.exit(0));
