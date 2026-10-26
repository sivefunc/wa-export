// Pure layout decisions for image and PDF exports: where to cut, and how big a canvas may get.

export interface Block {
  y: number; // top, CSS px from the top of the page
  h: number;
}

export interface Slice {
  y0: number;
  y1: number;
}

/**
 * Cuts a laid-out page into slices of at most maxH, between blocks (messages, day chips) where possible.
 * A block taller than a slice is cut at the slice edge.
 */
export function paginate(blocks: Block[], total: number, maxH: number): Slice[] {
  const tops = blocks.map((b) => b.y).sort((a, b) => a - b);
  const slices: Slice[] = [];
  let y0 = 0;
  while (y0 < total || slices.length === 0) {
    const limit = y0 + maxH;
    if (limit >= total) {
      slices.push({ y0, y1: total });
      break;
    }
    const cut = tops.filter((t) => t > y0 && t <= limit).pop() ?? limit;
    slices.push({ y0, y1: cut });
    y0 = cut;
  }
  return slices;
}

// Canvas limits that hold in current Chrome and Firefox.
export const MAX_SIDE = 32000;
export const MAX_AREA = 200_000_000;

/** The largest scale up to `preferred` that keeps a w×h canvas within limits; null if even 1× doesn't fit. */
export function chooseScale(w: number, h: number, preferred = 2): number | null {
  const scale = Math.min(preferred, MAX_SIDE / Math.max(w, h), Math.sqrt(MAX_AREA / (w * h)));
  return scale >= 1 ? Math.round(scale * 1e6) / 1e6 : null;
}

/** The blocks drawn in a slice: those overlapping [y0, y1). A block starting at y1 belongs to the next slice. */
export function blocksIn<T extends Block>(blocks: T[], s: Slice): T[] {
  return blocks.filter((b) => b.y < s.y1 && b.y + b.h > s.y0);
}

/** The text lines of a page, in page coordinates: each line goes to the page holding its middle. */
export function linesIn<T extends Block & { x: number; w: number }>(lines: T[], s: Slice): T[] {
  return lines.filter((l) => l.y + l.h / 2 >= s.y0 && l.y + l.h / 2 < s.y1).map((l) => ({ ...l, y: l.y - s.y0 }));
}

/** Output presets: canvas scale over the 900px layout, and JPEG quality (PDF pages are JPEG too). */
export const QUALITY = {
  best: { scale: 2, jpeg: 0.9 },
  balanced: { scale: 1.5, jpeg: 0.8 },
  small: { scale: 1, jpeg: 0.65 },
} as const;
