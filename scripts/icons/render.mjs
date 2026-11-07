// Re-render committed toolbar/store icons: pnpm icons
// First-time setup: pnpm exec playwright install chromium
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const source = await readFile(new URL("../../assets/icon.svg", import.meta.url), "utf8");
const output = new URL("../../public/icon/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of [16, 32, 48, 96, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${source}`);
    await page.screenshot({
      path: fileURLToPath(new URL(`${size}.png`, output)),
      omitBackground: true,
    });
    console.log(`Rendered icon/${size}.png`);
  }
} finally {
  await browser.close();
}
