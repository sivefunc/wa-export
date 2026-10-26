import { storage } from "wxt/utils/storage";
import { DEFAULT_ORDERING, orderings } from "./export/orderings";
import { DEFAULT_WRITER, writers } from "./export/writers";

export type LongImages = "single" | "split";

export type Quality = "best" | "balanced" | "small" | "custom";

export interface Settings {
  format: string;
  order: string;
  longImages: LongImages; // PNG/JPEG: one whole image, or parts in a ZIP when too long for one
  quality: Quality; // PDF/PNG/JPEG: resolution and JPEG compression
  customQuality: number; // percent, 10–100, used when quality is "custom"
  theme: Theme; // HTML/PDF/images: light, dark, or auto
}

export type Theme = "auto" | "light" | "dark";

export const themeChoices: Record<Theme, { id: Theme; label: string; shortLabel: string; hint: string }> = {
  auto: { id: "auto", label: "Auto (images follow WhatsApp, HTML the viewer)", shortLabel: "Auto", hint: "Images follow WhatsApp; HTML follows the viewer" },
  light: { id: "light", label: "Light", shortLabel: "Light", hint: "Always the light look" },
  dark: { id: "dark", label: "Dark", shortLabel: "Dark", hint: "Always the dark look" },
};

export const qualityChoices: Record<Quality, { id: Quality; label: string; shortLabel: string; hint: string }> = {
  best: { id: "best", label: "Best (sharpest, largest files)", shortLabel: "Best", hint: "2× resolution, light compression" },
  balanced: { id: "balanced", label: "Balanced", shortLabel: "Balanced", hint: "1.5× resolution, medium compression" },
  small: { id: "small", label: "Small files", shortLabel: "Small", hint: "1× resolution, strong compression" },
  custom: { id: "custom", label: "Custom percentage", shortLabel: "Custom", hint: "Resolution and compression together" },
};

export const CUSTOM_QUALITY = { min: 10, max: 100, step: 5, fallback: 75 };

const clampQuality = (n: unknown) =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.round(Math.min(CUSTOM_QUALITY.max, Math.max(CUSTOM_QUALITY.min, n)))
    : CUSTOM_QUALITY.fallback;

export const longImageChoices: Record<LongImages, { id: LongImages; label: string; shortLabel: string; hint: string }> = {
  single: { id: "single", label: "One whole image", shortLabel: "One image", hint: "Refused if too long for one image" },
  split: { id: "split", label: "Split long chats into parts (ZIP)", shortLabel: "Split into parts", hint: "A ZIP of images, cut between messages" },
};

export const DEFAULT_SETTINGS: Settings = {
  format: DEFAULT_WRITER,
  order: DEFAULT_ORDERING,
  longImages: "single",
  quality: "best",
  customQuality: CUSTOM_QUALITY.fallback,
  theme: "auto",
};

export const settingsItem = storage.defineItem<Settings>("sync:settings", { fallback: DEFAULT_SETTINGS });

/** Stored settings, with any id this version doesn't know replaced by its default. */
export async function loadSettings(): Promise<Settings> {
  const s = await settingsItem.getValue();
  return {
    format: writers[s?.format] ? s.format : DEFAULT_SETTINGS.format,
    order: orderings[s?.order] ? s.order : DEFAULT_SETTINGS.order,
    longImages: longImageChoices[s?.longImages] ? s.longImages : DEFAULT_SETTINGS.longImages,
    quality: qualityChoices[s?.quality] ? s.quality : DEFAULT_SETTINGS.quality,
    customQuality: clampQuality(s?.customQuality),
    theme: themeChoices[s?.theme] ? s.theme : DEFAULT_SETTINGS.theme,
  };
}
