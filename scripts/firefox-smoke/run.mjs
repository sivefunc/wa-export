// Headless Firefox check of the content-script paths unit tests can't cover:
// the real writers fed page-world bytes (the ZIP once hung at 33%), the PNG/JPEG/PDF snapshot pipeline
// (canvas, SVG foreignObject, video frames) on the demo chat, and <a download> saving.
// Usage: pnpm test:firefox   Env: FIREFOX_BINARY (optional; Selenium Manager finds Firefox and geckodriver),
// WA_EXPORT_SMOKE_OUT (optional: a folder to keep the demo PNG/JPEG/PDF in).
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { rolldown } from "rolldown";
import { Builder } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";

const here = dirname(fileURLToPath(import.meta.url));
const work = mkdtempSync(join(tmpdir(), "wa-export-smoke-"));
const ext = join(work, "ext");
const downloads = join(work, "downloads");
cpSync(join(here, "fixture"), ext, { recursive: true });
const bundle = await rolldown({ input: join(here, "entry.ts") });
await bundle.write({ format: "iife", file: join(ext, "writer.js") });
const assetsDir = join(here, "../../docs/demo/assets");
const assets = Object.fromEntries(readdirSync(assetsDir).map((f) => [f, readFileSync(join(assetsDir, f)).toString("base64")]));
writeFileSync(join(ext, "assets.js"), `globalThis.__waDemoAssets = ${JSON.stringify(assets)};`);

// An .xpi is a zip of the add-on folder (built with JSZip so it works on any OS).
const xpiZip = new JSZip();
const addDir = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) addDir(full);
    else xpiZip.file(relative(ext, full).split("\\").join("/"), readFileSync(full));
  }
};
addDir(ext);
const xpi = join(work, "smoke.xpi");
writeFileSync(xpi, await xpiZip.generateAsync({ type: "nodebuffer" }));

const options = new firefox.Options()
  .addArguments("-headless")
  .setPreference("browser.download.folderList", 2)
  .setPreference("browser.download.dir", downloads)
  .setPreference("browser.download.useDownloadDir", true)
  .setPreference("browser.download.always_ask_before_handling_new_types", false);
if (process.env.FIREFOX_BINARY) options.setBinary(process.env.FIREFOX_BINARY);

const driver = await new Builder().forBrowser("firefox").setFirefoxOptions(options).build();
let failed = false;
try {
  await driver.installAddon(xpi, true);
  await driver.get("https://example.com/");
  await driver.wait(async () => (await driver.getTitle()).startsWith("WA-EXPORT-SMOKE"), 60_000);
  const result = JSON.parse((await driver.getTitle()).slice("WA-EXPORT-SMOKE ".length));
  await driver.sleep(3000);
  const saved = existsSync(downloads) && readdirSync(downloads).includes("wa-export-smoke.zip");
  const version = (await driver.getCapabilities()).get("browserVersion");
  console.log(`Firefox ${version}`);
  console.log(`ZIP writer with page bytes: ${result.zip?.ok ? "ok" : "FAIL"} ${JSON.stringify(result.zip ?? result.error)}`);
  console.log(`HTML writer with page bytes: ${result.html?.ok ? "ok" : "FAIL"} ${JSON.stringify(result.html ?? result.error)}`);
  for (const id of ["png", "jpeg", "pdf"]) {
    console.log(`${id.toUpperCase()} writer on the demo chat: ${result[id]?.ok ? "ok" : "FAIL"} ${JSON.stringify(result[id] ?? result.error)}`);
  }
  console.log(`<a download> from content script: ${saved ? "ok" : "FAIL"}`);
  if (process.env.WA_EXPORT_SMOKE_OUT) {
    mkdirSync(process.env.WA_EXPORT_SMOKE_OUT, { recursive: true });
    for (const f of readdirSync(downloads).filter((f) => f.startsWith("demo-"))) cpSync(join(downloads, f), join(process.env.WA_EXPORT_SMOKE_OUT, f));
  }
  failed = !result.zip?.ok || !result.html?.ok || !result.png?.ok || !result.jpeg?.ok || !result.pdf?.ok || !saved;
} finally {
  await driver.quit();
}
process.exit(failed ? 1 : 0);
