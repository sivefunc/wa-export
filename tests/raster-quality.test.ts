import { describe, expect, it } from "vitest";
import { QUALITY, qualityPreset } from "../src/export/raster/plan";

describe("quality presets", () => {
  it("trade resolution and JPEG compression for size; best is today's output", () => {
    expect(QUALITY.best).toEqual({ scale: 2, jpeg: 0.9 });
    expect(QUALITY.balanced).toEqual({ scale: 1.5, jpeg: 0.8 });
    expect(QUALITY.small).toEqual({ scale: 1, jpeg: 0.65 });
  });

  it("picks the named preset", () => {
    expect(qualityPreset({ quality: "small", customQuality: 40 })).toEqual(QUALITY.small);
  });

  it("a custom percentage moves resolution and compression together", () => {
    expect(qualityPreset({ quality: "custom", customQuality: 100 })).toEqual({ scale: 2, jpeg: 1 });
    expect(qualityPreset({ quality: "custom", customQuality: 50 })).toEqual({ scale: 1.5, jpeg: 0.5 });
    expect(qualityPreset({ quality: "custom", customQuality: 10 })).toEqual({ scale: 1.1, jpeg: 0.1 });
  });
});
