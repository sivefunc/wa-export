import { loadSettings, settingsItem } from "./settings";
import { readSettingsFields, settingsFieldsHtml } from "./ui/settings-form";

export async function renderOptions(root: HTMLElement): Promise<void> {
  const settings = await loadSettings();
  root.innerHTML = `
    <h1>WA Export settings</h1>
    ${settingsFieldsHtml(settings)}
    <p class="note">More formats and orderings are coming. You can also change these with the ⚙ button next to Export in WhatsApp Web.</p>
    <p role="status" aria-live="polite"></p>`;
  const status = root.querySelector<HTMLElement>("[role=status]")!;
  root.addEventListener("change", async () => {
    await settingsItem.setValue(readSettingsFields(root));
    status.textContent = "Saved";
  });
}
