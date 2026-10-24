import type { WaMessage } from "../types";

export interface Ordering {
  id: string;
  label: string;
  shortLabel: string; // for the settings menu
  compare(a: WaMessage, b: WaMessage): number;
}

export const orderings: Record<string, Ordering> = {
  date: {
    id: "date",
    label: "By date sent (oldest first)",
    shortLabel: "Oldest first",
    compare: (a, b) => (a.timestamp ?? Infinity) - (b.timestamp ?? Infinity) || 0,
  },
};

export const DEFAULT_ORDERING = "date";

/** A sorted copy; Array.prototype.sort is stable, so ties keep their order. */
export function applyOrdering<T extends WaMessage>(msgs: T[], id: string): T[] {
  const ordering = orderings[id] ?? orderings[DEFAULT_ORDERING];
  return [...msgs].sort(ordering.compare);
}
