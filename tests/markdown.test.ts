import { describe, expect, it } from "vitest";
import { whatsappToMarkdown } from "../src/export/markdown";

describe("whatsappToMarkdown", () => {
  it.each([
    ["*bold*", "**bold**"],
    ["say *this* now", "say **this** now"],
    ["_italic_", "_italic_"],
    ["~strike~", "~~strike~~"],
    ["(*wrapped*)", "(**wrapped**)"],
    ["*end*.", "**end**."],
  ])("converts emphasis: %s", (input, expected) => {
    expect(whatsappToMarkdown(input)).toBe(expected);
  });

  it("leaves inline code untouched, including markers inside it", () => {
    expect(whatsappToMarkdown("run `a *b* c` now")).toBe("run `a *b* c` now");
  });

  it("turns a monospace block into a fenced block on its own lines", () => {
    expect(whatsappToMarkdown("look:\n```const a = *b*;```\ndone")).toBe("look:\n```\nconst a = *b*;\n```\ndone");
  });

  it("keeps multi-line monospace blocks intact", () => {
    expect(whatsappToMarkdown("```\nline *1*\nline ~2~\n```")).toBe("```\nline *1*\nline ~2~\n```");
  });

  it.each([
    ["2*3*4"],
    ["*not\nbold*"],
    ["a * b * c"],
    ["snake_case_name"],
    ["> quote"],
    ["- item"],
    ["1. item"],
    ["مرحبا 👋 ¿qué tal?"],
  ])("leaves %j unchanged", (input) => {
    expect(whatsappToMarkdown(input)).toBe(input);
  });
});
