// Every WhatsApp Web DOM selector lives here, so a WhatsApp update means patching one file.
//
// Live markup facts, observed 2026-10-24 on WhatsApp Web 2.3000.1051605128:
// - #main is the open chat; it's replaced when switching chats.
// - A message is <div data-id="<bare msg id>" data-testid="conv-msg-<bare msg id>"> inside [role=row].
//   The bare id has no chat/sender prefix; the page side resolves it through MsgStore.
// - In "Select messages" mode each message gets a nested
//   <input type="checkbox" aria-checked="true|false" aria-label="Checkbox, unselected , ">.
// - The selection toolbar has buttons aria-label "Cancel selection", "Star", "Delete",
//   "Forward messages", "Download"; icons are <svg><title>ic-fast-forward</title></svg>, not data-icon.
// - The "N selected" counter is a leaf <span aria-live="polite">.
export const SEL = {
  messageRow: ['[data-testid^="conv-msg-"][data-id]', '[data-id^="true_"]', '[data-id^="false_"]'].join(","),
  checkbox: ['input[type="checkbox"]', '[role="checkbox"]'].join(","),
  chatRoot: "#main",
  forwardButton: 'button[aria-label="Forward messages"], [role="button"][aria-label="Forward messages"]',
  forwardIconTitle: "ic-fast-forward",
};
