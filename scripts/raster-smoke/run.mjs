// Chromium check for the PNG, JPEG and PDF writers (canvas, SVG foreignObject, video frames): renders the
// fictional demo chat with Playwright's Chromium and checks the files. test:firefox covers Firefox.
// Usage: pnpm test:chromium [outDir]   (first time: pnpm exec playwright install chromium)
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
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
  // A long chat: 1000 text messages are too tall for one image even at 1×.
  const long = demoChatFrom(file);
  const text = long.records.find((r) => !r.media && r.text);
  long.records = Array.from({ length: 1000 }, (_, i) => ({ ...text, id: `LONG${i}`, fromMe: i % 3 === 0, timestamp: text.timestamp + i * 30, text: `Message ${i + 1}: ${text.text}` }));
  const settings = (longImages) => ({ format: "png", order: "date", longImages });
  const t1 = performance.now();
  res.tooLong = await getWriter("png").write(long, () => {}, settings("single")).then(() => "no error", (e) => e.message);
  const split = await getWriter("png").write(long, () => {}, settings("split"));
  res.split = { filename: split.filename, type: split.type ?? split.blob.type, size: split.blob.size, ms: Math.round(performance.now() - t1) };
  const t2 = performance.now();
  const longPdf = await getWriter("pdf").write(long, () => {}, settings("single"));
  res.longPdf = { size: longPdf.blob.size, ms: Math.round(performance.now() - t2), b64: "" };
  const pdfBytes = new Uint8Array(await longPdf.blob.arrayBuffer());
  let pbin = "";
  for (let i = 0; i < pdfBytes.length; i += 0x8000) pbin += String.fromCharCode(...pdfBytes.subarray(i, i + 0x8000));
  res.longPdf.b64 = btoa(pbin);
  const zipBytes = new Uint8Array(await split.blob.arrayBuffer());
  let zbin = "";
  for (let i = 0; i < zipBytes.length; i += 0x8000) zbin += String.fromCharCode(...zipBytes.subarray(i, i + 0x8000));
  res.split.b64 = btoa(zbin);
  return res;
}, assets);
await browser.close();

let failed = false;
const SIGNATURES = { png: [0x89, 0x50, 0x4e, 0x47], jpeg: [0xff, 0xd8, 0xff], pdf: [0x25, 0x50, 0x44, 0x46] };
const { tooLong, split, longPdf, ...formats } = results;
const tooLongOk = /too long for one image/.test(tooLong);
console.log(`long chat as one image: ${tooLongOk ? "ok, refused" : "FAIL"} (${tooLong})`);
const zip = await JSZip.loadAsync(Buffer.from(split.b64, "base64"));
const parts = Object.keys(zip.files).filter((f) => f.endsWith(".png"));
const partsOk = split.filename.endsWith(".zip") && parts.length >= 2;
console.log(`long chat split into parts: ${partsOk ? "ok" : "FAIL"} ${parts.length} PNGs in ${split.filename}, ${Math.round(split.size / 1024)} KB in ${split.ms} ms`);
const longPdfBytes = Buffer.from(longPdf.b64, "base64");
const pageCount = Number(longPdfBytes.toString("latin1").match(/\/Count (\d+)/)?.[1] ?? 0);
console.log(`long chat as PDF: ${pageCount > 20 ? "ok" : "FAIL"} ${pageCount} pages, ${Math.round(longPdf.size / 1024)} KB in ${longPdf.ms} ms`);
writeFileSync(join(out, "long.pdf"), longPdfBytes);
failed ||= !tooLongOk || !partsOk || pageCount <= 20;
for (const [id, r] of Object.entries(formats)) {
  const bytes = Buffer.from(r.b64, "base64");
  writeFileSync(join(out, r.filename), bytes);
  const ok = SIGNATURES[id].every((b, i) => bytes[i] === b) && r.progress === 100 && bytes.length > 20_000;
  failed ||= !ok;
  console.log(`${id}: ${ok ? "ok" : "FAIL"} ${r.filename} ${r.type} ${Math.round(r.size / 1024)} KB in ${r.ms} ms`);
}
console.log(`files in ${out}`);
process.exit(failed ? 1 : 0);
