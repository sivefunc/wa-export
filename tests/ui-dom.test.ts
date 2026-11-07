// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { builder } from "../src/ui/dom";

const el = builder(document);

describe("element builder", () => {
  it("sets attributes and appends text and element children", () => {
    const node = el("button", { class: "item", "aria-checked": "true", "data-value": "zip" }, "ZIP ", el("span", { class: "hint" }, "files"));
    expect(node.outerHTML).toBe('<button class="item" aria-checked="true" data-value="zip">ZIP <span class="hint">files</span></button>');
  });

  it("treats text and attribute values as data, never markup", () => {
    const evil = '"><img src=x onerror=alert(1)>';
    const node = el("p", { title: evil }, evil);
    expect(node.querySelector("img")).toBeNull();
    expect(node.textContent).toBe(evil);
    expect(node.getAttribute("title")).toBe(evil);
  });

  it("skips null, undefined and false, flattens arrays, and maps true to an empty attribute", () => {
    const node = el("select", { name: "format", disabled: true, hidden: false, title: undefined }, [el("option", {}, "a"), [null, el("option", {}, "b")]], false);
    expect(node.outerHTML).toBe('<select name="format" disabled=""><option>a</option><option>b</option></select>');
  });

  it("draws SVG icons in the SVG namespace", () => {
    const svg = el.icon("M0 0h24v24H0Z");
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(svg.outerHTML).toBe('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M0 0h24v24H0Z"></path></svg>');
  });
});
