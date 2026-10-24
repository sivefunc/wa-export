import type { ExportBundle, ExportRecord } from "../types";
import { whatsappToMarkdown } from "./markdown";
import { mediaKindLabel, problemText } from "./problems";

const pad = (n: number) => String(n).padStart(2, "0");

export function formatLocal(tsSeconds: number | null): string {
  if (tsSeconds == null) return "unknown time";
  const d = new Date(tsSeconds * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const senderOf = (r: ExportRecord) => (r.fromMe ? "You" : r.sender.name || r.sender.jid || "Unknown");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const quote = (text: string) => text.split("\n").map((line) => (line ? `> ${line}` : ">")).join("\n");

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDuration(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

function mediaLine(r: ExportRecord): string | null {
  const m = r.exportedMedia;
  if (!m || !r.media) return null;
  switch (r.media.kind) {
    case "image":
    case "sticker":
      return `![](${m.path})`;
    case "voice": {
      const label = r.media.durationSec != null ? `voice note, ${formatDuration(r.media.durationSec)}` : "voice note";
      return `🎤 [${label}](${m.path})`;
    }
    default: {
      const name = m.filename ?? m.path.split("/").pop()!;
      const type = name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1]?.toUpperCase() ?? mediaKindLabel(r.media.kind);
      return `📎 [${name}](${m.path}) (${type}, ${formatSize(m.size)})`;
    }
  }
}

/** For documents WhatsApp stores the filename as the caption; don't print it twice. */
function visibleText(r: ExportRecord): string {
  if (r.media?.kind === "document" && r.text === r.media.filename) return "";
  return r.text;
}

function renderMessage(r: ExportRecord): string {
  const parts = [`## ${senderOf(r)} — ${formatLocal(r.timestamp)}`];
  if (r.isForwarded) parts.push("_↪ Forwarded_");
  if (r.quoted) {
    const who = r.quoted.senderName ?? "Unknown";
    const when = r.quoted.timestamp != null ? ` — ${formatLocal(r.quoted.timestamp)}` : "";
    parts.push(`> Replying to **${who}**${when}\n>\n${quote(whatsappToMarkdown(r.quoted.text))}`);
  } else if (r.quotedUnavailable) {
    parts.push("> Replying to a message that isn't available");
  }
  const text = visibleText(r);
  if (text) parts.push(whatsappToMarkdown(text));
  const line = mediaLine(r);
  if (line) parts.push(line);
  for (const p of r.problems) parts.push(`⚠️ ${mediaKindLabel(r.media?.kind)} missing: ${problemText(p)}`);
  if (r.type === "revoked") parts.push("_(deleted message)_");
  else if (!text && !r.media && !r.problems.length) parts.push(`_(unsupported message type: ${r.type})_`);
  return parts.join("\n\n");
}

/** One plain-language line per problem, shared by chat.md and the summary in WhatsApp. */
export function problemLines(b: ExportBundle): string[] {
  const byId = new Map(b.records.map((r) => [r.id, r]));
  return b.problems.map((p) => {
    const r = p.messageId ? byId.get(p.messageId) : undefined;
    if (!r) return `Message ${p.messageId ?? "unknown"}: ${problemText(p)}`;
    return `${senderOf(r)} at ${formatLocal(r.timestamp)}: ${mediaKindLabel(r.media?.kind)} ${problemText(p)}`;
  });
}

export function renderChatMd(b: ExportBundle): string {
  const exported = formatLocal(Math.floor(b.exportedAt.getTime() / 1000));
  const header = [
    `# WhatsApp export: ${b.chat.name || "Unknown chat"}`,
    `Exported: ${exported} · ${plural(b.records.length, "message")}`,
  ];
  if (b.problems.length) {
    header.push(`## Export problems\n\n${problemLines(b).map((line) => `- ${line}`).join("\n")}`);
  }
  return `${header.join("\n\n")}\n\n---\n\n${b.records.map(renderMessage).join("\n\n")}\n`;
}
