import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import { demoChat } from "../scripts/demo/demo-chat";
import { buildSite, resolveRequest, SITE_URL } from "../scripts/site/build.mjs";
import { exportFilename } from "../src/export/naming";
import { renderChatMd } from "../src/export/render-chat-md";

const AMO = "https://addons.mozilla.org/en-US/firefox/addon/wa-export-for-whatsapp-web/";
const REPO = "https://github.com/sivefunc/wa-export";

let out: string;
let doc: Document;
const read = (path: string) => readFileSync(join(out, path), "utf8");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));

/** Local times differ between the test zone and the UTC sample on the page; compare everything else. */
const anyTime = (s: string) => s.replace(/\d{4}-\d\d-\d\d[ -]\d\d:?\d\d/g, "<time>");

beforeAll(() => {
  out = mkdtempSync(join(tmpdir(), "wa-export-site-"));
  buildSite(out);
  doc = new JSDOM(read("index.html")).window.document;
});

describe("website build", () => {
  it("writes the page, its assets and the files for crawlers and LLMs", () => {
    expect(files(out).map((f) => relative(out, f)).sort()).toEqual(
      [
        "_headers",
        "demo/bamboo-team.html",
        "favicon.svg",
        "img/whatsapp-menu-dark.png",
        "index.html",
        "index.md",
        "llms.txt",
        "main.js",
        "robots.txt",
        "sitemap.xml",
        "style.css",
      ].sort(),
    );
  });

  it("loads nothing from another site in its own code", () => {
    const loaded = [...doc.querySelectorAll("script[src], link[href]:not([rel=canonical]), img, iframe, source, use")].map(
      (el) => el.getAttribute("src") ?? el.getAttribute("href") ?? "",
    );
    expect(loaded.length).toBeGreaterThan(4);
    for (const url of loaded) expect([url, /^([a-z]+:|\/\/)/i.test(url)]).toEqual([url, false]);
    expect(read("style.css")).not.toMatch(/@import|url\(\s*["']?(https?:)?\/\//);
    expect(read("main.js")).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|import\(/);
  });

  it("has no inline script or style, so the strict CSP holds", () => {
    const scripts = [...doc.querySelectorAll("script")];
    expect(scripts.filter((s) => !s.src && s.type !== "application/ld+json")).toEqual([]);
    expect(doc.querySelectorAll("style, [style]")).toHaveLength(0);
    expect([...doc.querySelectorAll("*")].flatMap((el) => [...el.attributes].filter((a) => a.name.startsWith("on")))).toEqual([]);
    const headers = read("_headers");
    const [page, demo] = headers.split("/demo/*") as [string, string];
    // Cloudflare adds its Web Analytics beacon at the edge; the CSP lets exactly that script through, and it
    // reports to this site's own /cdn-cgi/rum (seen live 2026-11-15), so connect-src is 'self'.
    expect(page).toMatch(
      /Content-Security-Policy: default-src 'none'; script-src 'self' https:\/\/static\.cloudflareinsights\.com; style-src 'self'; img-src 'self'; frame-src 'self'; connect-src 'self';/,
    );
    expect(page).not.toContain("unsafe-inline");
    // The demo is a real export with its own strict CSP; no-transform keeps Cloudflare from adding the beacon to it.
    expect(demo).toMatch(/Cache-Control: .*no-transform/);
  });

  it("shows everything without JavaScript; motion hides content only under .js", () => {
    expect(doc.documentElement.classList.contains("js")).toBe(false);
    expect(read("main.js")).toContain('classList.add("js")');
    const css = read("style.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const hidingRules = [...css.matchAll(/([^{}]+)\{[^}]*opacity:\s*0[;}\s]/g)].map((m) => m[1]!.trim());
    for (const sel of hidingRules.filter((s) => !/^(from|to|\d+%)/.test(s) && !s.startsWith("@")))
      for (const part of sel.split(",")) expect([part.trim(), part.trim().startsWith(".js ")]).toEqual([part.trim(), true]);
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  it("points people to Firefox Add-ons and GitHub", () => {
    const hrefs = [...doc.querySelectorAll("a")].map((a) => a.href);
    expect(hrefs.filter((h) => h === AMO).length).toBeGreaterThanOrEqual(2);
    expect(hrefs).toContain(REPO);
    expect(doc.querySelector("h1")!.textContent!.replace(/\s+/g, " ").trim()).toBe("Save WhatsApp Web chats as files.");
    expect(doc.body.textContent).toMatch(/not affiliated with WhatsApp or Meta/i);
    // The add-on collects nothing; the website itself counts visits, and says so.
    expect(doc.querySelector("footer")!.textContent).toMatch(/This website counts visits with Cloudflare Web Analytics/);
  });

  it("describes every image and frame, and sandboxes the demo export", () => {
    for (const img of doc.querySelectorAll("img")) expect(img.getAttribute("alt")).not.toBeNull();
    const frame = doc.querySelector("iframe")!;
    expect(frame.getAttribute("src")).toBe("demo/bamboo-team.html");
    expect(frame.getAttribute("title")).toBeTruthy();
    // The export works inside the frame (Save as PDF prints, documents download, its GitHub link opens a tab)
    // but stays in its own opaque origin and can't navigate the page.
    const sandbox = frame.getAttribute("sandbox")!.split(/\s+/).sort();
    expect(sandbox).toEqual(["allow-downloads", "allow-modals", "allow-popups", "allow-popups-to-escape-sandbox", "allow-scripts"]);
  });

  it("previews safely: bad or escaping request paths never crash the server or leave the site", () => {
    const base = "/srv/site";
    expect(resolveRequest(base, "/")).toEqual({ status: 200, file: join(base, "index.html") });
    expect(resolveRequest(base, "/demo/bamboo-team.html")).toEqual({ status: 200, file: join(base, "demo/bamboo-team.html") });
    expect(resolveRequest(base, "/%")).toEqual({ status: 400 });
    expect(resolveRequest(base, "/..%2fpackage.json")).toEqual({ status: 403 });
  });

  it("shows the coding-agent sample exactly as the demo chat exports", () => {
    const bundle = demoChat(join(__dirname, "../docs/demo/assets"));
    const tree = doc.querySelector("#zip-tree")!.textContent!.split("\n").filter(Boolean);
    expect(anyTime(tree[0]!)).toBe(anyTime(exportFilename(bundle.chat.name, bundle.exportedAt)));
    const listed = tree.slice(1).flatMap((l) => l.match(/\d{3}-[\w.-]+/g) ?? []).map((f) => `media/${f}`);
    expect(listed).toEqual([...bundle.media.keys()]);
    const md = anyTime(renderChatMd(bundle));
    const sample = doc.querySelector("#chat-md")!.textContent!.trim();
    expect(md).toContain(anyTime(sample));
  });

  it("gives LLMs the same content as Markdown, and an llms.txt that links to it", () => {
    const md = read("index.md");
    for (const h of doc.querySelectorAll("main h2")) expect(md).toContain(`## ${h.textContent!.trim()}`);
    expect(md).toMatch(/This website counts visits with Cloudflare Web Analytics/);
    expect(md).toContain(AMO);
    const llms = read("llms.txt");
    expect(llms).toMatch(/^# WA Export\n\n> .+\n/);
    expect(llms).toContain(`${SITE_URL}/index.md`);
    expect(llms).toContain(`${REPO}/blob/main/README.md`);
  });

  it("deploys the built folder to the site's own domain with Workers static assets", () => {
    const jsonc = readFileSync(join(__dirname, "../wrangler.jsonc"), "utf8");
    const config = JSON.parse(jsonc.replace(/^\s*\/\/.*$/gm, ""));
    expect(config.main).toBeUndefined(); // static files only, no Worker code
    expect(config.assets.directory).toBe("./.output/site");
    expect(config.routes).toEqual([{ pattern: new URL(SITE_URL).host, custom_domain: true }]);
  });

  it("uses one canonical address everywhere", () => {
    expect(SITE_URL).toMatch(/^https:\/\/[^/]+$/);
    expect(doc.querySelector("link[rel=canonical]")!.getAttribute("href")).toBe(`${SITE_URL}/`);
    expect(doc.querySelector('meta[property="og:url"]')!.getAttribute("content")).toBe(`${SITE_URL}/`);
    expect(doc.querySelector('meta[property="og:image"]')!.getAttribute("content")).toBe(`${SITE_URL}/img/whatsapp-menu-dark.png`);
    expect(read("sitemap.xml")).toContain(`<loc>${SITE_URL}/</loc>`);
    expect(read("robots.txt")).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    const ld = JSON.parse(doc.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(ld).toMatchObject({ "@type": "SoftwareApplication", url: `${SITE_URL}/`, downloadUrl: AMO });
  });
});
