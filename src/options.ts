import { loadSettings, settingsItem } from "./settings";
import { builder } from "./ui/dom";
import { readSettingsFields, settingsFields } from "./ui/settings-form";

/** Draw the settings page into `root` and save every change. */
export async function renderOptions(root: HTMLElement): Promise<void> {
  const settings = await loadSettings();
  const el = builder(root.ownerDocument);
  const status = el("p", { role: "status", "aria-live": "polite" });
  root.replaceChildren(
    el("h1", {}, "WA Export settings"),
    ...settingsFields(el, settings),
    el("p", { class: "note" }, "More formats and orderings are coming. You can also change these with the ⚙ button next to Export in WhatsApp Web."),
    status,
  );
  root.addEventListener("change", async () => {
    await settingsItem.setValue(readSettingsFields(root));
    status.textContent = "Saved";
  });
}
