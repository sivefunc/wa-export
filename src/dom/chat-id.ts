/** The chat jid inside a message data-id: "false_<chat>_<msg>[_<participant>]" → "<chat>". */
export function parseChatJid(dataId: string): string | null {
  const parts = dataId.split("_");
  if (parts.length < 3 || (parts[0] !== "true" && parts[0] !== "false")) return null;
  return parts[1].includes("@") ? parts[1] : null;
}
