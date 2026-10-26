import { describe, expect, it } from "vitest";
import { QUALITY } from "../src/export/raster/plan";

describe("quality presets", () => {
  it("trade resolution and JPEG compression for size; best is today's output", () => {
    expect(QUALITY.best).toEqual({ scale: 2, jpeg: 0.9 });
    expect(QUALITY.balanced).toEqual({ scale: 1.5, jpeg: 0.8 });
    expect(QUALITY.small).toEqual({ scale: 1, jpeg: 0.65 });
  });
});
