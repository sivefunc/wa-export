import { describe, expect, it } from "vitest";
import { blocksIn, chooseScale, paginate } from "../src/export/raster/plan";

const blocks = (...hs: number[]) => {
  let y = 0;
  return hs.map((h) => {
    const b = { y, h };
    y += h + 2; // 2px gap between blocks
    return b;
  });
};

describe("paginate", () => {
  it("keeps everything in one slice when it fits", () => {
    expect(paginate(blocks(100, 100), 300, 1000)).toEqual([{ y0: 0, y1: 300 }]);
  });

  it("cuts between blocks, never through one", () => {
    // blocks at 0-100, 102-202, 204-304, 306-406; total 420
    expect(paginate(blocks(100, 100, 100, 100), 420, 250)).toEqual([
      { y0: 0, y1: 204 },
      { y0: 204, y1: 420 },
    ]);
  });

  it("cuts a block taller than a slice at the slice edge", () => {
    expect(paginate(blocks(50, 700, 50), 810, 300)).toEqual([
      { y0: 0, y1: 52 },
      { y0: 52, y1: 352 },
      { y0: 352, y1: 652 },
      { y0: 652, y1: 810 },
    ]);
  });

  it("an empty chat is one slice of its total height", () => {
    expect(paginate([], 120, 1000)).toEqual([{ y0: 0, y1: 120 }]);
  });
});

describe("chooseScale", () => {
  it("is 2x when the image fits", () => {
    expect(chooseScale(900, 5000)).toBe(2);
  });

  it("scales down a tall image so its longest side stays within 32000px", () => {
    expect(chooseScale(900, 20000)).toBe(1.6);
  });

  it("scales down to stay within 200M pixels", () => {
    expect(chooseScale(10000, 10000)).toBeCloseTo(Math.sqrt(2), 5);
  });

  it("returns null when even 1x doesn't fit", () => {
    expect(chooseScale(900, 40000)).toBeNull();
  });
});

describe("blocksIn", () => {
  it("takes the blocks of a slice only, not the next one that starts at its end", () => {
    const bs = blocks(100, 100, 100); // 0-100, 102-202, 204-304
    expect(blocksIn(bs, { y0: 0, y1: 204 }).map((b) => b.y)).toEqual([0, 102]);
    expect(blocksIn(bs, { y0: 204, y1: 400 }).map((b) => b.y)).toEqual([204]);
  });

  it("includes a tall block cut by the slice", () => {
    expect(blocksIn([{ y: 0, h: 900 }], { y0: 300, y1: 600 })).toHaveLength(1);
  });
});
