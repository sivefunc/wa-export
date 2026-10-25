import { storage } from "wxt/utils/storage";
import { DEFAULT_ORDERING, orderings } from "./export/orderings";
import { DEFAULT_WRITER, writers } from "./export/writers";

export type LongImages = "single" | "split";

export interface Settings {
  format: string;
  order: string;
  longImages: LongImages; // PNG/JPEG: one whole image, or parts in a ZIP when too long for one
}

export const longImageChoices: Record<LongImages, { id: LongImages; label: string; shortLabel: string; hint: string }> = {
  single: { id: "single", label: "One whole image", shortLabel: "One image", hint: "Refused if too long for one image" },
  split: { id: "split", label: "Split long chats into parts (ZIP)", shortLabel: "Split into parts", hint: "A ZIP of images, cut between messages" },
};

export const DEFAULT_SETTINGS: Settings = { format: DEFAULT_WRITER, order: DEFAULT_ORDERING, longImages: "single" };

export const settingsItem = storage.defineItem<Settings>("sync:settings", { fallback: DEFAULT_SETTINGS });

/** Stored settings, with any id this version doesn't know replaced by its default. */
export async function loadSettings(): Promise<Settings> {
  const s = await settingsItem.getValue();
  return {
    format: writers[s?.format] ? s.format : DEFAULT_SETTINGS.format,
    order: orderings[s?.order] ? s.order : DEFAULT_SETTINGS.order,
    longImages: longImageChoices[s?.longImages] ? s.longImages : DEFAULT_SETTINGS.longImages,
  };
}
