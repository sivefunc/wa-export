// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseSafeHtml } from "../src/export/raster/safe-html";

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

  it("removes links and sources with script or non-image data URLs", () => {
    const out = html(
      '<a href="javascript:alert(1)">a</a><a href=" JaVa\tScript:alert(1)">b</a><img src="data:text/html,<script>x</script>">' +
        '<svg><a href="vbscript:x"><use xlink:href="javascript:x"></use></a></svg><a href="#top">c</a><img src="blob:https://web.whatsapp.com/1">',
    );
    expect(out).not.toMatch(/script:|data:text/i);
    expect(out).toContain('href="#top"');
    expect(out).toContain('src="blob:https://web.whatsapp.com/1"');
  });

  it("strips inside nested content too", () => {
    const out = html('<div><div><span onmouseover="x()"><script>y()</script>ok</span></div></div>');
    expect(out).toBe("<div><div><span>ok</span></div></div>");
  });
});
