// Builds the website (site/) into .output/site, ready for Cloudflare Pages. No dependencies, so the
// host can run it without installing anything.
// Usage: pnpm site:build          build into .output/site
//        pnpm site                build, then serve it on http://localhost:4173 (PORT to change)
import { cpSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Where the site is published. Every absolute link to the site is built from this one value. */
export const SITE_URL = "https://wa-export.joan.engineer";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = join(root, "site");
const DEFAULT_OUT = join(root, ".output/site");

/** Files the page shows that already live elsewhere in the repo, so they're never copied by hand. */
const SHARED = [
  ["docs/images/whatsapp-menu-dark.png", "img/whatsapp-menu-dark.png"],
  ["docs/demo/bamboo-team.html", "demo/bamboo-team.html"],
  ["assets/icon.svg", "favicon.svg"],
];

/** Text files that may contain the %SITE_URL% placeholder. */
const TEMPLATED = new Set([".html", ".md", ".txt", ".xml"]);

/** Every file below `dir`, as absolute paths. */
function filesIn(dir) {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? filesIn(join(dir, f)) : [join(dir, f)]));
}

/**
 * Builds the site into `outDir`, replacing whatever was there.
 * @param {string} [outDir] the output directory; .output/site by default
 * @returns {string} the output directory
 */
export function buildSite(outDir = DEFAULT_OUT) {
  rmSync(outDir, { recursive: true, force: true });
  cpSync(SOURCE, outDir, { recursive: true });
  for (const [from, to] of SHARED) cpSync(join(root, from), join(outDir, to));
  for (const file of filesIn(outDir)) {
    if (!TEMPLATED.has(extname(file)) || file.endsWith(join("demo", "bamboo-team.html"))) continue;
    writeFileSync(file, readFileSync(file, "utf8").replaceAll("%SITE_URL%", SITE_URL));
  }
  return outDir;
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

/**
 * Serves `dir` on localhost for previewing, the way Pages would: `/` is index.html.
 * @param {string} dir the built site
 * @param {number} port the port to listen on
 */
function serve(dir, port) {
  const base = resolve(dir);
  createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    const file = normalize(join(base, path.endsWith("/") ? `${path}index.html` : path));
    if (!file.startsWith(base + sep)) return void res.writeHead(403).end();
    try {
      const body = readFileSync(file);
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" }).end(body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  }).listen(port, "127.0.0.1", () => console.log(`Serving ${dir} on http://localhost:${port}`));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = buildSite();
  console.log(`Built ${out}`);
  if (process.argv.includes("--serve")) serve(out, Number(process.env.PORT ?? 4173));
}
