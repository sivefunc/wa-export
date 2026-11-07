// WhatsApp Web listens for keydown in the capture phase on window, so it sees every key before our
// shadow root does: an Escape that closes our settings menu also cancelled the whole selection.
// Listeners on one target run in the order they were added, so this guard is installed from a
// document_start content script, before WhatsApp's scripts run (checked live 2026-11-06).

/** The event the guard hands a key to our UI with; `detail` is the original KeyboardEvent. */
export const KEY_EVENT = "wa-export:keydown";

const HOST = "wa-export-ui";

/**
 * Keep keys pressed inside our UI away from WhatsApp while the UI asks for them (its host has
 * `data-keys="own"`, set while the settings menu is open), and hand them to the UI as KEY_EVENT.
 * Other keys pass through untouched. Returns a function that removes the guard.
 */
export function installKeyGuard(win: Window): () => void {
  const guard = (event: KeyboardEvent) => {
    const host = event.composedPath().find((node): node is HTMLElement => (node as Element).localName === HOST);
    if (host?.dataset.keys !== "own") return;
    event.stopImmediatePropagation();
    host.dispatchEvent(new CustomEvent<KeyboardEvent>(KEY_EVENT, { detail: event }));
  };
  win.addEventListener("keydown", guard, true);
  return () => win.removeEventListener("keydown", guard, true);
}
