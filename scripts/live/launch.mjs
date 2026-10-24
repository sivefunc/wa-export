// Launch Chromium with the built extension, a persistent profile (keeps the WhatsApp login) and a CDP port.
// Usage: node scripts/live/launch.mjs [extensionDir]   (default .output/chrome-mv3-dev)
// Env: WA_EXPORT_CDP_PORT, WA_EXPORT_PROFILE_DIR, WA_EXPORT_DOWNLOADS_DIR (see config.mjs).
import { resolve } from "node:path";
import { chromium } from "playwright";
import { CDP_PORT, CDP_URL, DOWNLOADS_DIR, PROFILE_DIR } from "./config.mjs";

const ext = resolve(process.argv[2] ?? ".output/chrome-mv3-dev");
const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  channel: "chromium",
  headless: false,
  acceptDownloads: true,
  downloadsPath: DOWNLOADS_DIR,
  viewport: null,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, `--remote-debugging-port=${CDP_PORT}`],
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto("https://web.whatsapp.com");
console.log(`launched with ${ext}; CDP on ${CDP_URL}`);
context.on("close", () => process.exit(0));
