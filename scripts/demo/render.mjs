// Renders the fictional demo export (docs/demo/bamboo-team.html) and its README screenshots (docs/images/).
// Usage: pnpm demo   (run pnpm demo:assets first if the drawings changed)
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { Builder } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const html = join(root, "docs/demo/bamboo-team.html");
const work = mkdtempSync(join(tmpdir(), "wa-export-demo-"));
const bundle = await rolldown({ input: join(root, "scripts/demo/render-html.ts"), platform: "node" });
await bundle.write({ format: "esm", file: join(work, "render-html.mjs") });
// Fixed zone and language, so the output doesn't depend on (or reveal) the machine it was made on.
const env = { ...process.env, TZ: "UTC", LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" };
execFileSync(process.execPath, [join(work, "render-html.mjs"), join(root, "docs/demo/assets"), html], { env, stdio: "inherit" });

// Screenshots in Firefox (as test:firefox, through Selenium): it plays the H.264 clip, Playwright's Chromium can't.
for (const scheme of ["light", "dark"]) {
  const options = new firefox.Options()
    .addArguments("-headless", "--width=900", "--height=1000")
    .setPreference("layout.css.prefers-color-scheme.content-override", scheme === "dark" ? 0 : 1)
    .setPreference("intl.locale.requested", "en-US")
    .setPreference("media.autoplay.default", 5);
  if (process.env.FIREFOX_BINARY) options.setBinary(process.env.FIREFOX_BINARY);
  const driver = await new Builder().forBrowser("firefox").setFirefoxOptions(options).build();
  try {
    await driver.get(`file://${html}`);
    await driver.wait(
      () =>
        driver.executeScript(
          "return [...document.images].every((i) => i.complete && (i.naturalWidth || !i.getAttribute('src'))) && [...document.querySelectorAll('video')].every((v) => v.readyState >= 2)",
        ),
      15000,
    );
    await driver.sleep(500);
    writeFileSync(join(root, `docs/images/html-export-${scheme}.png`), Buffer.from(await driver.takeFullPageScreenshot(), "base64"));
  } finally {
    await driver.quit();
  }
}
console.log("wrote docs/demo/bamboo-team.html and docs/images/html-export-{light,dark}.png");
