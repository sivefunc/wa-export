import { orderings } from "./export/orderings";
import { writers } from "./export/writers";
import { loadSettings, settingsItem, type Settings } from "./settings";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function selectHtml(name: keyof Settings, label: string, entries: { id: string; label: string }[], value: string): string {
  const options = entries
    .map((e) => `<option value="${esc(e.id)}"${e.id === value ? " selected" : ""}>${esc(e.label)}</option>`)
    .join("");
  return `<label>${label}<select name="${name}">${options}</select></label>`;
}

export async function renderOptions(root: HTMLElement): Promise<void> {
  const settings = await loadSettings();
  root.innerHTML = `
    <h1>WA Export settings</h1>
    ${selectHtml("format", "Export format", Object.values(writers), settings.format)}
    ${selectHtml("order", "Message order", Object.values(orderings), settings.order)}
    <p class="note">More formats and orderings are coming.</p>
    <p role="status" aria-live="polite"></p>`;
  const status = root.querySelector<HTMLElement>("[role=status]")!;
  root.addEventListener("change", async () => {
    const read = (name: keyof Settings) => root.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!.value;
    await settingsItem.setValue({ format: read("format"), order: read("order") });
    status.textContent = "Saved";
  });
}
