// Run a JS snippet (an async function body) in the live WhatsApp page and print its JSON result.
// Usage: node scripts/live/probe.mjs <file.js | -e "code">
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { CDP_URL } from "./config.mjs";

const code = process.argv[2] === "-e" ? process.argv[3] : readFileSync(process.argv[2], "utf8");
const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().startsWith("https://web.whatsapp.com"));
if (!page) throw new Error("WhatsApp page not found");
const result = await page.evaluate(`(async () => { ${code} })()`);
console.log(JSON.stringify(result, null, 2));
await browser.close().catch(() => {});
process.exit(0);
