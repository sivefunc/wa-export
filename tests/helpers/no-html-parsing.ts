import { vi } from "vitest";

/**
 * Spy on every way of turning a string into DOM, so a test can assert the UI never parses HTML
 * (Firefox Add-ons flags innerHTML; the UI builds nodes instead). Call `restore()` when done.
 */
export function spyOnHtmlParsing() {
  const setter = vi.spyOn(Element.prototype, "innerHTML", "set");
  const shadowSetter = vi.spyOn(ShadowRoot.prototype, "innerHTML", "set");
  const outer = vi.spyOn(Element.prototype, "outerHTML", "set");
  const adjacent = vi.spyOn(Element.prototype, "insertAdjacentHTML");
  const calls = () => setter.mock.calls.length + shadowSetter.mock.calls.length + outer.mock.calls.length + adjacent.mock.calls.length;
  const restore = () => [setter, shadowSetter, outer, adjacent].forEach((s) => s.mockRestore());
  return { calls, restore };
}
