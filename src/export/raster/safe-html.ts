// Turns the snapshot renderer's HTML into DOM for the PNG/PDF layout without innerHTML. The renderer
// already escapes all chat text (src/export/wa-html.ts); this is a second line of defence, so an
// escaping bug can't turn a message into code running in WhatsApp's page.

/** Elements that run code, load other documents or change how the page resolves URLs. */
const BLOCKED_ELEMENTS = new Set(["script", "iframe", "frame", "frameset", "object", "embed", "applet", "base", "link", "meta", "form", "noscript"]);

/** Attributes holding a URL the browser may follow or load. */
const URL_ATTRIBUTES = new Set(["href", "src", "xlink:href", "action", "formaction", "poster", "srcset", "background", "data"]);

/**
 * True for URLs the layout may keep: in-page anchors, relative paths, http(s), mailto/tel, blob: and
 * data: images. Browsers ignore tabs, newlines and leading spaces in a scheme, so those are removed first.
 */
function isSafeUrl(value: string): boolean {
  const url = value.replace(/[\u0000- ]/g, "").toLowerCase();
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(url)?.[1];
  if (!scheme) return true; // "#top", "media/001.jpg"
  if (scheme === "data") return url.startsWith("data:image/");
  return ["http", "https", "mailto", "tel", "blob"].includes(scheme);
}

/** Remove blocked elements, event handler attributes and unsafe URLs from everything under `root`. */
function sanitize(root: ParentNode): void {
  for (const el of [...root.querySelectorAll("*")]) {
    if (BLOCKED_ELEMENTS.has(el.localName)) {
      el.remove();
      continue;
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || (URL_ATTRIBUTES.has(name) && !isSafeUrl(attr.value))) el.removeAttribute(attr.name);
    }
  }
}

/**
 * Parse `html` into an inert document (DOMParser runs no scripts and loads nothing) and sanitize it.
 * Import the nodes you need into the live page with `document.importNode`.
 */
export function parseSafeHtml(html: string): Document {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  sanitize(parsed);
  return parsed;
}
