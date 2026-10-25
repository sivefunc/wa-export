// Browser check for the PNG, JPEG and PDF writers: renders the fictional demo chat in Chromium
// (Playwright) and checks the files. Usage: node scripts/raster-smoke/run.mjs [outDir]
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { rolldown } from "rolldown";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const out = process.argv[2] ?? mkdtempSync(join(tmpdir(), "wa-export-raster-"));
mkdirSync(out, { recursive: true });
const bundle = await rolldown({ input: join(here, "entry.ts") });
const { output } = await bundle.generate({ format: "iife" });
const assetsDir = join(root, "docs/demo/assets");
const assets = Object.fromEntries(readdirSync(assetsDir).map((f) => [f, readFileSync(join(assetsDir, f)).toString("base64")]));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<!doctype html><title>raster</title><body></body>");
await page.addScriptTag({ content: output[0].code });
const results = await page.evaluate(async (assets) => {
  const { getWriter, demoChatFrom } = globalThis.__waRaster;
  const file = (name, mime) => new Blob([Uint8Array.from(atob(assets[name]), (c) => c.charCodeAt(0))], { type: mime });
  const res = {};
  for (const id of ["png", "jpeg", "pdf"]) {
    const t0 = performance.now();
    const seen = [];
    const { blob, filename } = await getWriter(id).write(demoChatFrom(file), (p) => seen.push(p), { format: id, order: "date", longImages: "single" });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    res[id] = { filename, type: blob.type, size: blob.size, ms: Math.round(performance.now() - t0), progress: seen.at(-1), b64: btoa(bin) };
  }
  return res;
}, assets);
await browser.close();

let failed = false;
const SIGNATURES = { png: [0x89, 0x50, 0x4e, 0x47], jpeg: [0xff, 0xd8, 0xff], pdf: [0x25, 0x50, 0x44, 0x46] };
for (const [id, r] of Object.entries(results)) {
  const bytes = Buffer.from(r.b64, "base64");
  writeFileSync(join(out, r.filename), bytes);
  const ok = SIGNATURES[id].every((b, i) => bytes[i] === b) && r.progress === 100 && bytes.length > 20_000;
  failed ||= !ok;
  console.log(`${id}: ${ok ? "ok" : "FAIL"} ${r.filename} ${r.type} ${Math.round(r.size / 1024)} KB in ${r.ms} ms`);
}
console.log(`files in ${out}`);
process.exit(failed ? 1 : 0);
