import { describe, expect, it } from "vitest";
import { escapeHtml, whatsappToHtml } from "../src/export/wa-html";

describe("escapeHtml", () => {
  it("escapes the five HTML-special characters", () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
  });
});

describe("whatsappToHtml", () => {
  it("escapes markup in message text", () => {
    expect(whatsappToHtml("<img src=x onerror=alert(1)>")).toBe("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("renders bold, italic and strikethrough", () => {
    expect(whatsappToHtml("*bold* _italic_ ~gone~")).toBe("<strong>bold</strong> <em>italic</em> <del>gone</del>");
  });

  it("nests markers", () => {
    expect(whatsappToHtml("*_both_*")).toBe("<strong><em>both</em></strong>");
  });

  it("leaves markers that aren't at word edges", () => {
    expect(whatsappToHtml("2*3*4 and snake_case_name and * spaced *")).toBe("2*3*4 and snake_case_name and * spaced *");
  });

  it("renders inline code and code blocks without formatting inside", () => {
    expect(whatsappToHtml("run `npm *i*` now")).toBe("run <code>npm *i*</code> now");
    expect(whatsappToHtml("```\nconst a = *b*;\n```")).toBe("<pre><code>const a = *b*;</code></pre>");
  });

  it("links http(s) URLs, leaving trailing punctuation and underscores alone", () => {
    expect(whatsappToHtml("see https://example.com/a_b_c?x=1&y=2.")).toBe(
      'see <a href="https://example.com/a_b_c?x=1&amp;y=2" target="_blank" rel="noopener noreferrer">https://example.com/a_b_c?x=1&amp;y=2</a>.',
    );
  });

  it("stops a link at a closing quote or angle bracket", () => {
    expect(whatsappToHtml(`'https://example.com' <https://example.org>`)).toBe(
      '&#39;<a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>&#39; ' +
        '&lt;<a href="https://example.org" target="_blank" rel="noopener noreferrer">https://example.org</a>&gt;',
    );
  });

  it("does not link other schemes", () => {
    expect(whatsappToHtml("javascript:alert(1)")).toBe("javascript:alert(1)");
  });

  it("keeps newlines for pre-wrap rendering", () => {
    expect(whatsappToHtml("a\n*b*")).toBe("a\n<strong>b</strong>");
  });

  it("is not confused by NUL characters in the input", () => {
    expect(whatsappToHtml("x\u00000\u0000 `y`")).toBe("x0 <code>y</code>");
  });
});
