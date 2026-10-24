import { describe, expect, it } from "vitest";
import { applyOrdering, DEFAULT_ORDERING, orderings } from "../src/export/orderings";
import { msg } from "./fixtures/messages";

describe("orderings", () => {
  it("registers date as the default", () => {
    expect(DEFAULT_ORDERING).toBe("date");
    expect(orderings.date.label).toBeTruthy();
  });

  it("sorts by timestamp ascending", () => {
    const late = msg({ timestamp: 300 });
    const early = msg({ timestamp: 100 });
    const mid = msg({ timestamp: 200 });
    expect(applyOrdering([late, early, mid], "date").map((m) => m.timestamp)).toEqual([100, 200, 300]);
  });

  it("is stable for ties", () => {
    const a = msg({ timestamp: 100 });
    const b = msg({ timestamp: 100 });
    expect(applyOrdering([b, a], "date")).toEqual([b, a]);
  });

  it("puts null timestamps last", () => {
    const none = msg({ timestamp: null });
    const some = msg({ timestamp: 5 });
    expect(applyOrdering([none, some], "date")).toEqual([some, none]);
  });

  it("falls back to date for an unknown id and does not mutate the input", () => {
    const input = [msg({ timestamp: 2 }), msg({ timestamp: 1 })];
    const copy = [...input];
    expect(applyOrdering(input, "nope").map((m) => m.timestamp)).toEqual([1, 2]);
    expect(input).toEqual(copy);
  });
});
