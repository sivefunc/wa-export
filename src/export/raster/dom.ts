// The in-browser half of image and PDF exports: prepare media, lay the snapshot out offscreen, measure it,
// and rasterize slices through an SVG <foreignObject>. Needs a real DOM and canvas (content script).
import type { ExportBundle } from "../../types";
import { renderChatSnapshot, snapshotCss } from "../render-chat-html";
import type { TextLine } from "./pdf";
import { blocksIn, type Block, type Slice } from "./plan";

export const PAGE_WIDTH = 900; // CSS px of the laid-out chat

export interface LaidOut {
  width: number;
  height: number;
  css: string;
  blocks: (Block & { x: number; w: number; html: string })[];
  lines: TextLine[];
}

const timeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

/** Page-world bytes copied into this compartment first (Firefox content scripts deny libraries access otherwise). */
async function own(blob: Blob): Promise<Blob> {
  return new Blob([structuredClone(await blob.arrayBuffer())], { type: blob.type });
}

/** A data: URL of the image at most maxW pixels wide; PNG keeps transparency (stickers). */
async function downscale(doc: Document, blob: Blob, maxW: number, png: boolean): Promise<string | null> {
  try {
    const bmp = await timeout(createImageBitmap(await own(blob)), 10_000);
    const w = Math.min(maxW, bmp.width);
    const h = Math.round((bmp.height * w) / bmp.width);
    const c = doc.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return c.toDataURL(png ? "image/png" : "image/jpeg", 0.86);
  } catch {
    return null;
  }
}

/** A video's first frame as a JPEG data: URL, or null if this browser can't decode it. */
async function firstFrame(doc: Document, blob: Blob, maxW: number): Promise<string | null> {
  const url = URL.createObjectURL(await own(blob));
  const v = doc.createElement("video");
  const once = (name: string) => new Promise((resolve) => v.addEventListener(name, resolve, { once: true }));
  try {
    v.muted = true;
    v.preload = "auto";
    v.src = url;
    await timeout(once("loadeddata"), 5000);
    v.currentTime = Math.min(0.1, (v.duration || 0) / 2);
    await timeout(once("seeked"), 3000);
    const w = Math.min(maxW, v.videoWidth);
    const c = doc.createElement("canvas");
    c.width = w;
    c.height = Math.round((v.videoHeight * w) / v.videoWidth);
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.86);
  } catch {
    return null;
  } finally {
    v.removeAttribute("src");
    URL.revokeObjectURL(url);
  }
}

/** Whether WhatsApp is showing its dark theme, from its own surface color (else the system setting). */
export function pageIsDark(doc: Document): boolean {
  const view = doc.defaultView;
  const surface = view?.getComputedStyle(doc.documentElement).getPropertyValue("--WDS-surface-default").trim();
  const rgb = surface?.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (rgb) {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(rgb.slice(i, i + 2), 16));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
  }
  return !!view?.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

/** Photos, stickers and pictures at the size they are shown (2×), and video first frames. */
export async function prepareMedia(doc: Document, b: ExportBundle, onStep: () => void) {
  const srcs = new Map<string, string>();
  const posters = new Map<string, string>();
  for (const r of b.records) {
    const m = r.exportedMedia;
    const blob = m && b.media.get(m.path);
    if (!m || !blob || !r.media) continue;
    if (r.media.kind === "image") {
      const url = await downscale(doc, blob, 660, false);
      if (url) srcs.set(`media:${m.path}`, url);
    } else if (r.media.kind === "sticker") {
      const url = await downscale(doc, blob, 380, true);
      if (url) srcs.set(`media:${m.path}`, url);
    } else if (r.media.kind === "video") {
      const url = await firstFrame(doc, blob, 660);
      if (url) posters.set(m.path, url);
    }
    onStep();
  }
  for (const [jid, blob] of b.avatars ?? []) {
    const url = await downscale(doc, blob, 80, false);
    if (url) srcs.set(`avatars:${jid}`, url);
  }
  return { srcs, posters };
}

/** Text of every visible line, measured word by word so wrapped lines come out separately. */
function measureLines(root: Element, base: DOMRect): TextLine[] {
  const lines: TextLine[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = root.ownerDocument.createRange();
  const view = root.ownerDocument.defaultView!;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const parent = node.parentElement;
    if (!parent || parent.closest("style") || view.getComputedStyle(parent).visibility === "hidden") continue;
    let line: TextLine | null = null;
    for (const word of node.data.matchAll(/\S+/g)) {
      range.setStart(node, word.index!);
      range.setEnd(node, word.index! + word[0].length);
      const r = range.getClientRects()[0];
      if (!r || !r.width) continue;
      const box = { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
      if (line && Math.abs(line.y - box.y) < 3) {
        line.w = box.x + box.w - line.x;
        line.text += ` ${word[0]}`;
      } else {
        if (line) lines.push(line);
        line = { ...box, text: word[0] };
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Lays the snapshot out in an offscreen shadow root and measures its blocks and lines of text. */
export async function layOut(doc: Document, b: ExportBundle, media: Awaited<ReturnType<typeof prepareMedia>>, dark: boolean): Promise<LaidOut> {
  const pieces = renderChatSnapshot(b, { srcs: media.srcs, posters: media.posters });
  const css = `${snapshotCss(dark)}\n.slot > * { margin: 0 !important; }`;
  const host = doc.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-100000px;top:0;width:${PAGE_WIDTH}px;pointer-events:none;contain:layout paint`;
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `<style>${css}</style><div class="wa" style="width:${PAGE_WIDTH}px">${pieces.header}<main class="chat">${pieces.blocks.join("")}${pieces.end}</main></div>`;
  doc.body.append(host);
  try {
    const root = shadow.querySelector(".wa")!;
    await Promise.all([...root.querySelectorAll("img")].map((img) => img.decode().catch(() => {})));
    const base = root.getBoundingClientRect();
    const els = [root.querySelector(".top")!, ...root.querySelector("main")!.children];
    const blocks = els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height, html: el.outerHTML };
    });
    return { width: PAGE_WIDTH, height: Math.ceil(base.height), css, blocks, lines: measureLines(root, base) };
  } finally {
    host.remove();
  }
}

/**
 * Draws the slice's blocks onto a canvas at the given scale. The canvas is `height` tall (a PDF page can be
 * taller than its slice); the rest shows the chat background.
 */
export async function rasterize(doc: Document, laid: LaidOut, slice: Slice, scale: number, height = slice.y1 - slice.y0): Promise<HTMLCanvasElement> {
  const y0 = slice.y0;
  const slots = blocksIn(laid.blocks, slice)
    .map((bk) => `<div class="slot" style="position:absolute;left:${bk.x}px;top:${bk.y - y0}px;width:${bk.w}px">${bk.html}</div>`)
    .join("");
  // Parse as HTML, then serialize as XHTML: <foreignObject> needs well-formed markup.
  const scratch = doc.implementation.createHTMLDocument("");
  // A block cut by the slice (taller than a page) must not spill below it.
  const clip = Math.min(height, slice.y1 - slice.y0);
  scratch.body.innerHTML = `<div class="wa" style="position:relative;width:${laid.width}px;height:${height}px"><style>${laid.css}</style><div style="position:absolute;inset:0 0 auto 0;height:${clip}px;overflow:hidden">${slots}</div></div>`;
  const xhtml = new XMLSerializer().serializeToString(scratch.body.firstElementChild!);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${laid.width}" height="${height}"><foreignObject x="0" y="0" width="100%" height="100%">${xhtml}</foreignObject></svg>`;
  // A data: URL, not blob:: Chrome taints the canvas for a foreignObject SVG loaded from blob:.
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await timeout(img.decode(), 30_000);
  const canvas = doc.createElement("canvas");
  canvas.width = Math.round(laid.width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function canvasBlob(canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg", quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`Couldn't encode the ${type === "image/png" ? "PNG" : "JPEG"}`))), type, quality),
  );
}
