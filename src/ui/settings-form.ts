import { orderings } from "../export/orderings";
import { writerCatalog } from "../export/writers/catalog";
import { CUSTOM_QUALITY, longImageChoices, qualityChoices, themeChoices, type Settings } from "../settings";
import type { Builder } from "./dom";

/** A labelled <select> with one option per entry, `value` preselected. */
function select(el: Builder, name: keyof Settings, label: string, entries: { id: string; label: string }[], value: string): HTMLElement {
  const options = entries.map((e) => el("option", { value: e.id, selected: e.id === value }, e.label));
  return el("label", {}, label, el("select", { name }, options));
}

/** The settings pickers for the options page, built as DOM. */
export function settingsFields(el: Builder, s: Settings): HTMLElement[] {
  return [
    select(el, "format", "Export format", Object.values(writerCatalog), s.format),
    select(el, "order", "Message order", Object.values(orderings), s.order),
    select(el, "theme", "Theme (HTML, PDF and images)", Object.values(themeChoices), s.theme),
    select(el, "longImages", "Long images (PNG and JPEG)", Object.values(longImageChoices), s.longImages),
    select(el, "quality", "Quality (PDF, PNG and JPEG)", Object.values(qualityChoices), s.quality),
    el(
      "label",
      {},
      "Custom quality (%)",
      el("input", { type: "number", name: "customQuality", min: CUSTOM_QUALITY.min, max: CUSTOM_QUALITY.max, step: CUSTOM_QUALITY.step, value: s.customQuality }),
    ),
  ];
}

/** Read the pickers back into settings; an empty or invalid custom quality falls back to the default. */
export function readSettingsFields(root: ParentNode): Settings {
  const read = (name: keyof Settings) => root.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!.value;
  return {
    format: read("format"),
    order: read("order"),
    longImages: read("longImages") as Settings["longImages"],
    quality: read("quality") as Settings["quality"],
    customQuality: Number(root.querySelector<HTMLInputElement>('input[name="customQuality"]')!.value) || CUSTOM_QUALITY.fallback,
    theme: read("theme") as Settings["theme"],
  };
}
