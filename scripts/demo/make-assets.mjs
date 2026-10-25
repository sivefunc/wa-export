// Builds the fictional demo media in docs/demo/assets/ from the hand-drawn SVGs in docs/demo/src/.
// Nothing here comes from a real chat: drawings are ours, sound and video are generated.
// Usage: pnpm demo:assets   (needs ffmpeg with libopus and libx264 on PATH)
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const src = join(root, "docs/demo/src");
const out = join(root, "docs/demo/assets");
mkdirSync(out, { recursive: true });

// SVG → raster in Chromium. Canvas output carries no EXIF or text metadata.
const RASTERS = [
  ["avatar-bao.svg", "avatar-bao.jpg", 192, 192, "image/jpeg"],
  ["avatar-mei.svg", "avatar-mei.jpg", 192, 192, "image/jpeg"],
  ["avatar-group.svg", "avatar-group.jpg", 192, 192, "image/jpeg"],
  ["photo-mockup.svg", "photo-mockup.jpg", 1280, 853, "image/jpeg"],
  ["sticker-bao.svg", "sticker-bao.webp", 512, 512, "image/webp"],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [from, to, w, h, mime] of RASTERS) {
  const svg = "data:image/svg+xml;base64," + readFileSync(join(src, from)).toString("base64");
  const b64 = await page.evaluate(
    async ({ svg, w, h, mime }) => {
      const img = new Image();
      img.src = svg;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      return c.toDataURL(mime, 0.86).split(",")[1];
    },
    { svg, w, h, mime },
  );
  writeFileSync(join(out, to), Buffer.from(b64, "base64"));
}
await browser.close();

// Generated sound and video; -map_metadata -1 and bitexact keep encoder tags and dates out.
const ffmpeg = (...args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
const clean = ["-map_metadata", "-1", "-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact"];
// A 6-second warbling tone shaped like speech.
ffmpeg(
  "-f", "lavfi", "-i", "aevalsrc='0.35*sin(2*PI*(170+45*sin(2*PI*2.7*t))*t)*(0.55+0.45*sin(2*PI*1.3*t))':s=48000:d=6",
  "-ac", "1", "-c:a", "libopus", "-b:a", "24k", ...clean, join(out, "voice-note.ogg"),
);
// A 4-second slow zoom over the mockup, with a soft tone.
ffmpeg(
  "-loop", "1", "-i", join(out, "photo-mockup.jpg"),
  "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000:duration=4",
  "-vf", "zoompan=z='1+0.0015*on':d=96:s=640x426:fps=24,format=yuv420p",
  "-t", "4", "-threads", "1", "-c:v", "libx264", "-preset", "veryslow", "-crf", "30", "-c:a", "aac", "-b:a", "48k", "-af", "volume=0.2",
  "-movflags", "+faststart", ...clean, join(out, "demo-clip.mp4"),
);

// A one-page PDF written by hand (Helvetica is built into every PDF reader).
const lines = ["Release notes v0.2", "", "- Export to HTML that looks like WhatsApp", "- Profile pictures in the HTML export", "- Settings menu next to Export", "- Menu animations"];
const text = lines
  .map((l, i) => `BT /F1 ${i ? 14 : 22} Tf 72 ${760 - i * 26} Td (${l.replace(/[()\\]/g, "\\$&")}) Tj ET`)
  .join("\n");
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
];
let pdf = "%PDF-1.4\n";
const offsets = objects.map((body, i) => {
  const at = Buffer.byteLength(pdf);
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  return at;
});
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync(join(out, "release-notes.pdf"), pdf);

console.log("demo assets written to docs/demo/assets/");
