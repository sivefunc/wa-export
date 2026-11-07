// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseSafeHtml } from "../src/export/raster/safe-html";
import { snapshotCss } from "../src/export/render-chat-html";

const html = (markup: string) => parseSafeHtml(markup).body.innerHTML;

describe("parseSafeHtml", () => {
  it("keeps the chat markup the renderer produces", () => {
    const markup =
      '<div class="wa" style="width:900px"><style>.a{color:red}</style><p class="text">Hi <b>Ana</b> &amp; <a href="https://example.com/x">link</a></p>' +
      '<img src="data:image/jpeg;base64,AAAA" alt="photo"><svg viewBox="0 0 24 24"><path d="M0 0h24"></path></svg></div>';
    expect(html(markup)).toBe(markup);
  });

  it("removes elements that run or load code", () => {
    const out = html('<p>a</p><script>alert(1)</script><iframe src="https://x"></iframe><object data="x"></object><embed src="x"><base href="https://x/"><link rel="stylesheet" href="https://x"><meta http-equiv="refresh" content="0"><form action="https://x"></form><p>b</p>');
    expect(out).toBe("<p>a</p><p>b</p>");
  });

  it("removes event handler attributes, in HTML and SVG", () => {
    const out = html('<img src="data:image/png;base64,AA" onerror="alert(1)" ONLOAD="x()"><svg onload="x()"><a onclick="y()">z</a></svg>');
    expect(out).not.toMatch(/on(error|load|click)/i);
    expect(out).toContain('src="data:image/png;base64,AA"');
  });

  it("keeps only raster data: images and #fragments as sources, so the layout loads nothing", () => {
    const out = html(
      '<img src="data:image/png;base64,AA"><img src="data:image/webp;base64,BB"><img src="https://tracker.example/p.gif">' +
        '<img src="data:image/svg+xml,<svg onload=x()>"><img src="blob:https://web.whatsapp.com/1"><img src="media/001.jpg">' +
        '<video poster="https://x/p.jpg"></video><svg><image href="https://x/i.png"></image><use href="#icon"></use></svg>',
    );
    expect(out).toContain('src="data:image/png;base64,AA"');
    expect(out).toContain('src="data:image/webp;base64,BB"');
    expect(out).toContain('href="#icon"');
    expect(out).not.toMatch(/https:|svg\+xml|blob:|media\/001|poster=/);
  });

  it("keeps ordinary links, which can't run or load anything in a layout, and removes script ones", () => {
    const out = html(
      '<a href="https://example.com/x">a</a><a href="mailto:ana@example.com">b</a><a href="#top">c</a>' +
        '<a href="javascript:alert(1)">d</a><a href=" JaVa\tScript:alert(1)">e</a><a href="data:text/html,x">f</a>' +
        '<svg><a href="vbscript:x"><text>g</text></a></svg>',
    );
    expect(out).toBe(
      '<a href="https://example.com/x">a</a><a href="mailto:ana@example.com">b</a><a href="#top">c</a>' +
        "<a>d</a><a>e</a><a>f</a><svg><a><text>g</text></a></svg>",
    );
  });

  it("removes srcset, action and formaction outright: the renderer never uses them", () => {
    const out = html('<img src="data:image/png;base64,AA" srcset="data:image/png;base64,AA 1x, https://x/2.png 2x"><button formaction="https://x">b</button>');
    expect(out).toBe('<img src="data:image/png;base64,AA"><button>b</button>');
  });

  it("removes style attributes that could load something, and keeps plain ones", () => {
    const out = html(
      '<div style="width:900px;height:12px">a</div><div style="background:url(https://x/b.png)">b</div>' +
        '<div style="background-image: URL (x)">c</div><div style="background:image-set(&quot;x.png&quot; 1x)">d</div><div style="background:u\\72l(x)">e</div>',
    );
    expect(out).toBe('<div style="width:900px;height:12px">a</div><div>b</div><div>c</div><div>d</div><div>e</div>');
  });

  it("removes <style> elements that could load something; the real snapshot CSS passes unchanged", () => {
    const out = html(
      '<div><style>.a{color:red}</style><style>@import "https://x/a.css";</style><style>.b{background:url(https://x/b.png)}</style>' +
        '<style>.c{background:image-set("x.png" 1x)}</style><style>.d{background:u\\72l(x)}</style><svg><style>@import url(x)</style></svg></div>',
    );
    expect(out).toBe("<div><style>.a{color:red}</style><svg></svg></div>");
    for (const dark of [false, true]) {
      const css = `${snapshotCss(dark)}\n.slot > * { margin: 0 !important; }`;
      expect(parseSafeHtml(`<div class="wa"><style>${css}</style></div>`).querySelector("style")?.textContent).toBe(css);
    }
  });

  it("removes SVG animation elements, which could rewrite an href after sanitizing", () => {
    const out = html(
      '<svg><a href="#x"><set attributeName="href" to="https://x/"></set><animate attributeName="href" values="https://x/"></animate>' +
        '<animateMotion dur="1s"></animateMotion><animateTransform attributeName="transform"></animateTransform><text>t</text></a></svg>',
    );
    expect(out).toBe('<svg><a href="#x"><text>t</text></a></svg>');
  });

  it("strips inside nested content too", () => {
    const out = html('<div><div><span onmouseover="x()"><script>y()</script>ok</span></div></div>');
    expect(out).toBe("<div><div><span>ok</span></div></div>");
  });
});
