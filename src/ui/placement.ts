import { SEL } from "../dom/selectors";

const BUTTONS = 'button, [role="button"]';

/** Forward's outermost wrapper inside the toolbar row (the first ancestor whose parent holds other buttons). */
export function toolbarSlot(forward: HTMLElement): HTMLElement {
  let slot = forward;
  while (slot.parentElement && slot.parentElement.querySelectorAll(BUTTONS).length < 2) slot = slot.parentElement;
  return slot;
}

/** WhatsApp's "Forward messages" button: by label first, then by its icon (labels are localized). */
export function findForwardButton(doc: Document): HTMLElement | null {
  const byLabel = doc.querySelector<HTMLElement>(SEL.forwardButton);
  if (byLabel) return byLabel;
  for (const title of doc.querySelectorAll("svg title")) {
    if (title.textContent?.trim() === SEL.forwardIconTitle) {
      return title.closest<HTMLElement>('button, [role="button"]');
    }
  }
  return null;
}
