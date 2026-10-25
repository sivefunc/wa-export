// Renders the README banner (docs/images/banner.png) from docs/demo/src/banner.html.
// Usage: pnpm demo:banner
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 320 }, deviceScaleFactor: 2 });
await page.goto(`file://${join(root, "docs/demo/src/banner.html")}`);
await page.waitForFunction(() => window.bannerReady);
await page.locator("canvas").screenshot({ path: join(root, "docs/images/banner.png") });
await browser.close();
console.log("wrote docs/images/banner.png");
