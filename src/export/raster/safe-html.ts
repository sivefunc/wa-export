// Turns the snapshot renderer's HTML into DOM for the PNG/PDF layout without innerHTML. The renderer
// already escapes all chat text (src/export/wa-html.ts); this is a second line of defence, so an
// escaping bug can't turn a message into code running in WhatsApp's page, or make it load anything.

/** Elements that run code, load other documents or change how the page resolves URLs. */
const BLOCKED_ELEMENTS = new Set(["script", "iframe", "frame", "frameset", "object", "embed", "applet", "base", "link", "meta", "form", "noscript"]);

/** Attributes the renderer never uses that hold URLs a browser could follow or load: always removed. */
const DROPPED_ATTRIBUTES = new Set(["srcset", "imagesrcset", "action", "formaction"]);

/** Attributes whose URL the browser loads (on links, href/xlink:href are navigation instead). */
const LOADING_ATTRIBUTES = new Set(["src", "poster", "background", "data", "href", "xlink:href"]);
const LINKS = new Set(["a", "area"]);

/** Browsers ignore control characters and spaces inside a URL scheme, so compare without them. */
const normalize = (url: string) => url.replace(/[\u0000-\u0020]/g, "").toLowerCase();

/** Sources the layout may load: our own raster data: images (media is inlined before layout) or #fragments. */
function isSafeSource(value: string): boolean {
  const url = normalize(value);
  return url.startsWith("#") || /^data:image\/(png|jpeg|gif|webp)[;,]/.test(url);
}

/** Link targets: inert in a layout, but never script. Relative, #, http(s), mailto: and tel: stay. */
function isSafeLink(value: string): boolean {
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(normalize(value))?.[1];
  return !scheme || ["http", "https", "mailto", "tel"].includes(scheme);
}

/** Inline styles that could load something: url(), image-set(), or a CSS escape that could spell either. */
const LOADING_STYLE = /url\s*\(|image-set\s*\(|\\/i;

/** True when the attribute could run code or load something, so it must go. */
function isUnsafeAttribute(el: Element, name: string, value: string): boolean {
  if (name.startsWith("on") || DROPPED_ATTRIBUTES.has(name)) return true;
  if (name === "style") return LOADING_STYLE.test(value);
  if (!LOADING_ATTRIBUTES.has(name)) return false;
  return LINKS.has(el.localName) && name.endsWith("href") ? !isSafeLink(value) : !isSafeSource(value);
}

/** Remove blocked elements and unsafe attributes from everything under `root`. */
function sanitize(root: ParentNode): void {
  for (const el of [...root.querySelectorAll("*")]) {
    if (BLOCKED_ELEMENTS.has(el.localName)) {
      el.remove();
      continue;
    }
    for (const attr of [...el.attributes]) {
      if (isUnsafeAttribute(el, attr.name.toLowerCase(), attr.value)) el.removeAttribute(attr.name);
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
