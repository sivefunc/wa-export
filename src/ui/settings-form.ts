import { orderings } from "../export/orderings";
import { writers } from "../export/writers";
import { CUSTOM_QUALITY, longImageChoices, qualityChoices, themeChoices, type Settings } from "../settings";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function selectHtml(name: keyof Settings, label: string, entries: { id: string; label: string }[], value: string): string {
  const options = entries
    .map((e) => `<option value="${esc(e.id)}"${e.id === value ? " selected" : ""}>${esc(e.label)}</option>`)
    .join("");
  return `<label>${label}<select name="${name}">${options}</select></label>`;
}

/** The format and order pickers, shared by the options page and the panel next to Export. */
export function settingsFieldsHtml(s: Settings): string {
  return (
    selectHtml("format", "Export format", Object.values(writers), s.format) +
    selectHtml("order", "Message order", Object.values(orderings), s.order) +
    selectHtml("theme", "Theme (HTML, PDF and images)", Object.values(themeChoices), s.theme) +
    selectHtml("longImages", "Long images (PNG and JPEG)", Object.values(longImageChoices), s.longImages) +
    selectHtml("quality", "Quality (PDF, PNG and JPEG)", Object.values(qualityChoices), s.quality) +
    `<label>Custom quality (%)<input type="number" name="customQuality" min="${CUSTOM_QUALITY.min}" max="${CUSTOM_QUALITY.max}" step="${CUSTOM_QUALITY.step}" value="${s.customQuality}"></label>`
  );
}

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
