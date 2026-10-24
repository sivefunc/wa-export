import { storage } from "wxt/utils/storage";
import { DEFAULT_ORDERING, orderings } from "./export/orderings";
import { DEFAULT_WRITER, writers } from "./export/writers";

export interface Settings {
  format: string;
  order: string;
}

export const DEFAULT_SETTINGS: Settings = { format: DEFAULT_WRITER, order: DEFAULT_ORDERING };

export const settingsItem = storage.defineItem<Settings>("sync:settings", { fallback: DEFAULT_SETTINGS });

/** Stored settings, with any id this version doesn't know replaced by its default. */
export async function loadSettings(): Promise<Settings> {
  const s = await settingsItem.getValue();
  return {
    format: writers[s?.format] ? s.format : DEFAULT_SETTINGS.format,
    order: orderings[s?.order] ? s.order : DEFAULT_SETTINGS.order,
  };
}
