// Every WhatsApp Web DOM selector lives here, so a WhatsApp update means patching one file.
// Observed markup facts (to be confirmed at the live gate):
// - message rows carry data-id = "<true|false>_<chat jid>_<msg id>[_<participant jid>]"
export const SEL = {
  messageRow: ['[data-id^="true_"]', '[data-id^="false_"]', '[data-testid^="conv-msg-"][data-id]'].join(","),
  checkbox: ['[role="checkbox"]', 'input[type="checkbox"]', '[data-icon*="checkbox"]'].join(","),
  selectionCounter: ['[data-testid="selection-count"]', '[aria-label*="selected" i]'].join(","),
  chatRoot: "#main",
  forwardIcon: ['[data-icon="forward"]', '[data-icon*="forward"]', '[data-testid*="forward"]'].join(","),
};
