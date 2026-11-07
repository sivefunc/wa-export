const SVG_NS = "http://www.w3.org/2000/svg";

export type Child = Node | string | false | null | undefined | Child[];
export type Attrs = Record<string, string | number | boolean | null | undefined>;

export interface Builder {
  /** Create `tag` with `attrs` (true → empty attribute; false, null, undefined → left out) and `children`. */
  (tag: string, attrs?: Attrs, ...children: Child[]): HTMLElement;
  /** A 24×24 SVG icon drawn from one path, hidden from screen readers. */
  icon(path: string): SVGSVGElement;
}

function setAttrs(el: Element, attrs: Attrs): void {
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    el.setAttribute(name, value === true ? "" : String(value));
  }
}

function appendAll(parent: Node, children: Child[]): void {
  for (const child of children) {
    if (Array.isArray(child)) appendAll(parent, child);
    else if (child !== false && child !== null && child !== undefined) parent.appendChild(typeof child === "string" ? parent.ownerDocument!.createTextNode(child) : child);
  }
}

/**
 * Builds DOM for `doc` without parsing HTML: text and attribute values are stored as data, so
 * nothing needs escaping and chat-derived text (file names, error messages) can never become markup.
 */
export function builder(doc: Document): Builder {
  const el = ((tag: string, attrs: Attrs = {}, ...children: Child[]) => {
    const node = doc.createElement(tag);
    setAttrs(node, attrs);
    appendAll(node, children);
    return node;
  }) as Builder;
  el.icon = (path) => {
    const svg = doc.createElementNS(SVG_NS, "svg");
    setAttrs(svg, { viewBox: "0 0 24 24", "aria-hidden": "true" });
    const shape = doc.createElementNS(SVG_NS, "path");
    shape.setAttribute("d", path);
    svg.appendChild(shape);
    return svg;
  };
  return el;
}
