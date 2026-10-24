// Headless Firefox check of the content-script paths unit tests can't cover:
// the real ZIP writer fed page-world bytes (once hung at 33%), and <a download> saving.
// Usage: pnpm test:firefox   Env: FIREFOX_BINARY (optional; Selenium Manager finds Firefox and geckodriver).
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Builder } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";

const here = dirname(fileURLToPath(import.meta.url));
const work = mkdtempSync(join(tmpdir(), "wa-export-smoke-"));
const ext = join(work, "ext");
const downloads = join(work, "downloads");
cpSync(join(here, "fixture"), ext, { recursive: true });
execFileSync(resolve(here, "../../node_modules/.bin/rolldown"), [join(here, "entry.ts"), "--format", "iife", "--file", join(ext, "writer.js")], { stdio: "ignore" });
const xpi = join(work, "smoke.xpi");
execFileSync("zip", ["-qr", xpi, "."], { cwd: ext });

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
  console.log(`<a download> from content script: ${saved ? "ok" : "FAIL"}`);
  failed = !result.zip?.ok || !saved;
} finally {
  await driver.quit();
}
process.exit(failed ? 1 : 0);
