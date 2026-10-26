// The HTML export: one self-contained page that looks like WhatsApp Web. Media bytes are not part of the
// markup; the page carries placeholders (a media path or an avatar jid) that the writer fills with base64 blocks.
import type { ExportBundle, ExportRecord, MediaKind } from "../types";
import { mediaKindLabel, problemText } from "./problems";
import { problemLines } from "./render-chat-md";
import { escapeHtml, whatsappToHtml } from "./wa-html";

export type HtmlPart = string | { from: "media" | "avatars"; key: string; id: string; mime: string };

export interface HtmlOptions {
  locale?: string; // dates and times; undefined = the browser's
  theme?: "auto" | "light" | "dark"; // auto: the viewer's system setting
}

/**
 * Where media comes from. The interactive page gets placeholders the writer fills with base64; a snapshot
 * (for images and PDF) gets data: URLs prepared beforehand, keyed "media:<path>" / "avatars:<jid>".
 */
interface Source {
  snapshot: boolean;
  attrs(from: "media" | "avatars", key: string, mime: string): string | null;
  poster(path: string): string | null; // a video's first frame (snapshot only)
}

/** The page cut into the pieces a snapshot lays out and paginates. */
export interface ChatPieces {
  title: string;
  header: string; // the <header class="top"> element
  blocks: string[]; // problems box, day chips and messages, in order
  end: string;
}

const KIND_ICONS: Record<MediaKind, string> = {
  image: "📷",
  video: "🎥",
  voice: "🎤",
  audio: "🎵",
  document: "📄",
  sticker: "💟",
};

// Sender name colors, readable on both the light and the dark bubble.
const NAME_COLORS = ["#d6336c", "#1f7aec", "#00a884", "#e67700", "#7048e8", "#0b8a9c", "#c2255c", "#5c940d", "#ae3ec9", "#e8590c", "#1971c2", "#2b8a3e"];

const pad = (n: number) => String(n).padStart(2, "0");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function colorFor(key: string): string {
  let h = 0;
  for (const c of key) h = (h * 31 + c.codePointAt(0)!) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDuration(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

const senderKey = (r: ExportRecord) => (r.fromMe ? "me" : r.sender.jid || r.sender.name || "unknown");
// Quotes only carry the sender's name, so names pick the color; a bubble and a reply to it then match.
const colorKey = (r: ExportRecord) => r.sender.name || senderKey(r);
const senderName = (r: ExportRecord) => (r.fromMe ? "You" : r.sender.name || r.sender.jid || "Unknown");

/** For documents WhatsApp stores the filename as the caption; don't print it twice. */
function visibleText(r: ExportRecord): string {
  if (r.media?.kind === "document" && r.text === r.media.filename) return "";
  return r.text;
}

export function renderChatHtml(b: ExportBundle, o: HtmlOptions = {}): HtmlPart[] {
  const media: HtmlPart[] = [];
  const ids = new Map<string, string>(); // each file and avatar is embedded once
  const source: Source = {
    snapshot: false,
    attrs(from, key, mime) {
      let id = ids.get(`${from}:${key}`);
      if (!id) {
        id = `m${media.length + 1}`;
        media.push({ from, key, id, mime });
        ids.set(`${from}:${key}`, id);
      }
      return `data-media="${id}" data-mime="${escapeHtml(mime)}"`;
    },
    poster: () => null,
  };
  const pieces = buildChat(b, o, source);
  const parts: HtmlPart[] = [];
  const push = (s: string) => parts.push(s);

  push(`<!doctype html>
<html lang="${escapeHtml(o.locale ?? "en")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src blob:; media-src blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="generator" content="WA Export">
<title>${escapeHtml(pieces.title)}</title>
<style>${pageCss(o.theme)}</style>
</head>
<body>
${pieces.header}
<main class="chat">
${pieces.blocks.join("\n")}
${pieces.end}
</main>
<div id="lightbox" hidden><img alt=""></div>
`);
  parts.push(...media);
  push(`<script>${SCRIPT}</script>
</body>
</html>
`);
  return parts;
}

export interface SnapshotOptions extends HtmlOptions {
  srcs: Map<string, string>; // "media:<path>" / "avatars:<jid>" → data: URL
  posters: Map<string, string>; // media path → first-frame data: URL
}

// Characters XML 1.0 can't carry (controls, U+FFFE/FFFF, lone surrogates): one in any message would make the
// <foreignObject> SVG fail to decode, so snapshots drop them.
const NOT_XML = /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu;
const cleanXml = (s: string) => s.replace(NOT_XML, "");

/** The static look for images and PDF: no script or controls, media as data: URLs. */
export function renderChatSnapshot(b: ExportBundle, o: SnapshotOptions): ChatPieces {
  const p = buildChat(b, o, {
    snapshot: true,
    attrs: (from, key) => {
      const url = o.srcs.get(`${from}:${key}`);
      return url ? `src="${escapeHtml(url)}"` : null;
    },
    poster: (path) => o.posters.get(path) ?? null,
  });
  return { title: cleanXml(p.title), header: cleanXml(p.header), blocks: p.blocks.map(cleanXml), end: cleanXml(p.end) };
}

/** Static waveform bars, the same for a given message every time. */
function waveHtml(seed: string): string {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const bars: string[] = [];
  for (let i = 0; i < 28; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    bars.push(`<i style="height:${4 + ((h >>> 0) % 17)}px"></i>`);
  }
  return `<span class="wave">${bars.join("")}</span>`;
}

function buildChat(b: ExportBundle, o: HtmlOptions, src: Source): ChatPieces {
  const dayOf = (ts: number) => new Date(ts * 1000).toLocaleDateString(o.locale, { day: "numeric", month: "long", year: "numeric" });
  const timeOf = (ts: number | null) =>
    ts == null ? "" : new Date(ts * 1000).toLocaleTimeString(o.locale, { hour: "2-digit", minute: "2-digit" });
  const isGroup = Boolean(b.chat.jid?.endsWith("@g.us")) || new Set(b.records.filter((r) => !r.fromMe).map(senderKey)).size > 1;

  /** A round picture, embedded once per jid, or the initial on a colored circle like WhatsApp's default. */
  function avatarHtml(jid: string | null, name: string, cls: string, color: string): string {
    const blob = jid ? b.avatars?.get(jid) : undefined;
    const attrs = jid && blob ? src.attrs("avatars", jid, blob.type || "image/jpeg") : null;
    if (attrs) return `<img class="${cls}" ${attrs} alt="">`;
    const initial = [...name.replace(/^[^\p{L}\p{N}]+/u, "")][0]?.toUpperCase() ?? "?";
    return `<span class="${cls} initial" style="background:${color}">${escapeHtml(initial)}</span>`;
  }

  function mediaHtml(r: ExportRecord): string {
    const m = r.exportedMedia;
    if (!m || !r.media) return "";
    const kind = r.media.kind;
    const dur = r.media.durationSec != null ? formatDuration(r.media.durationSec) : "";
    if (kind === "document") {
      const name = m.filename ?? m.path.split("/").pop()!;
      const ext = name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1]?.toUpperCase() ?? "FILE";
      const inner =
        `<span class="doc-ext">${escapeHtml(ext.slice(0, 4))}</span>` +
        `<span class="doc-info"><span class="doc-name">${escapeHtml(name)}</span>` +
        `<span class="doc-meta">${escapeHtml(ext)} · ${formatSize(m.size)}</span></span>`;
      if (src.snapshot) return `<div class="doc">${inner}</div>`;
      return `<a class="doc" ${src.attrs("media", m.path, m.mime)} download="${escapeHtml(name)}" title="Download">${inner}</a>`;
    }
    if (src.snapshot && (kind === "voice" || kind === "audio")) {
      return `<div class="audio still"><span class="audio-icon">${KIND_ICONS[kind]}</span><span class="play-icon">▶</span>${waveHtml(r.id)}<span class="dur">${dur}</span></div>`;
    }
    if (src.snapshot && kind === "video") {
      const poster = src.poster(m.path);
      const still = poster ? `<img class="frame" src="${escapeHtml(poster)}" alt="">` : "";
      return `<div class="video still">${still}<span class="play">▶</span>${dur ? `<span class="vdur">🎥 ${dur}</span>` : ""}</div>`;
    }
    const data = src.attrs("media", m.path, m.mime);
    if (!data) return `<div class="missing">${KIND_ICONS[kind]} ${escapeHtml(mediaKindLabel(kind))}</div>`;
    switch (kind) {
      case "image":
        return `<img class="photo" ${data} alt="Photo">`;
      case "sticker":
        return `<img class="sticker" ${data} alt="Sticker">`;
      case "video":
        return `<video class="video" controls preload="metadata" ${data}></video>`;
      default: {
        const d = dur ? `<span class="dur">${dur}</span>` : "";
        return `<div class="audio"><span class="audio-icon">${KIND_ICONS[kind]}</span><audio controls preload="metadata" ${data}></audio>${d}</div>`;
      }
    }
  }

  function quoteHtml(r: ExportRecord): string {
    if (r.quoted) {
      const q = r.quoted;
      const who = q.fromMe ? "You" : (q.senderName ?? "Unknown");
      const color = q.fromMe ? "var(--you)" : colorFor(q.senderName ?? "unknown");
      const icon = q.kind ? `${KIND_ICONS[q.kind]} ` : "";
      const body = q.text
        ? icon + whatsappToHtml(q.text)
        : q.kind
          ? `${KIND_ICONS[q.kind]} ${escapeHtml(mediaKindLabel(q.kind))}`
          : `<i>No text</i>`;
      return `<div class="quote" style="--bar:${color}"><div class="quote-name">${escapeHtml(who)}</div><div class="quote-text">${body}</div></div>`;
    }
    if (r.quotedUnavailable) return `<div class="quote" style="--bar:var(--muted)"><div class="quote-text"><i>Message not available</i></div></div>`;
    return "";
  }

  function messageHtml(r: ExportRecord, first: boolean): string {
    const side = r.fromMe ? "out" : "in";
    const text = visibleText(r);
    const mediaProblems = r.problems.filter((p) => p.code !== "unsupported_type");
    const kind = r.media?.kind;
    const bare = kind === "sticker" && r.exportedMedia && !text && !r.quoted && !r.isForwarded;
    const overlay = (kind === "image" || kind === "video") && r.exportedMedia && !text;
    const time = escapeHtml(timeOf(r.timestamp));
    const body: string[] = [];

    if (first && isGroup && !r.fromMe) body.push(`<div class="name" style="color:${colorFor(colorKey(r))}">${escapeHtml(senderName(r))}</div>`);
    if (r.isForwarded) body.push(`<div class="forwarded">↪ Forwarded</div>`);
    body.push(quoteHtml(r));
    body.push(mediaHtml(r));
    const file = r.media?.filename ? ` (${r.media.filename})` : "";
    for (const p of mediaProblems) {
      body.push(`<div class="missing">⚠️ ${escapeHtml(`${mediaKindLabel(kind)} missing${file}: ${problemText(p)}`)}</div>`);
    }
    if (r.type === "revoked") body.push(`<div class="text deleted">🚫 This message was deleted<span class="spacer">${time}</span></div>`);
    else if (text) body.push(`<div class="text">${whatsappToHtml(text)}<span class="spacer">${time}</span></div>`);
    else if (!r.media && !mediaProblems.length) {
      body.push(`<div class="text deleted">Unsupported message (${escapeHtml(r.type)}): ${escapeHtml(problemText({ messageId: r.id, code: "unsupported_type", detail: r.type }))}<span class="spacer">${time}</span></div>`);
    }
    body.push(`<span class="meta${overlay ? " overlay" : ""}">${time}</span>`);

    const cls = ["msg", side, first ? "first" : "", bare ? "bare" : ""].filter(Boolean).join(" ");
    // Groups: other people's bubbles leave room for a picture, shown on the first bubble of each run.
    const indent = isGroup && !r.fromMe;
    const pp = indent && first ? avatarHtml(r.sender.jid, senderName(r), "pp", colorFor(colorKey(r))) : "";
    return `<div class="row ${side}${indent ? " indent" : ""}">${pp}<div class="${cls}" data-id="${escapeHtml(r.id)}">${body.join("")}</div></div>`;
  }

  const title = b.chat.name || "WhatsApp chat";
  const exported = `${new Date(b.exportedAt).toLocaleDateString(o.locale, { day: "numeric", month: "long", year: "numeric" })}, ${timeOf(Math.floor(b.exportedAt.getTime() / 1000))}`;
  const button = src.snapshot ? "" : `\n  <button type="button" id="print" title="Opens the print dialog; choose “Save as PDF”">Save as PDF</button>`;
  const header = `<header class="top">
  ${avatarHtml(b.chat.jid, b.chat.name || "?", "avatar", colorFor(title))}
  <div class="who"><div class="chat-name">${escapeHtml(title)}</div><div class="sub">${plural(b.records.length, "message")} · exported ${escapeHtml(exported)}</div></div>${button}
</header>`;

  const blocks: string[] = [];
  if (b.problems.length) {
    const items = problemLines(b).map((line) => `<li>${escapeHtml(line)}</li>`).join("");
    blocks.push(`<section class="system problems"><strong>⚠️ Export problems</strong><ul>${items}</ul></section>`);
  }
  let lastDay = "";
  let lastKey = "";
  for (const r of b.records) {
    const day = r.timestamp != null ? dayOf(r.timestamp) : lastDay;
    if (day && day !== lastDay) {
      blocks.push(`<div class="day"><span>${escapeHtml(day)}</span></div>`);
      lastDay = day;
      lastKey = "";
    }
    const key = senderKey(r);
    blocks.push(messageHtml(r, key !== lastKey));
    lastKey = key;
  }
  return { title, header, blocks, end: `<p class="end">Exported with WA Export. Only the selected messages are shown.</p>` };
}

const LIGHT = `
  --bg: #efeae2; --panel: #f0f2f5; --in: #ffffff; --out: #d9fdd3; --text: #111b21; --muted: #667781;
  --chip: #ffffff; --chip-text: #54656f; --quote-in: #f5f6f6; --quote-out: #d1f4cc; --you: #06a884;
  --link: #027eb5; --system: #ffeecd; --system-text: #54656f; --shadow: 0 1px 0.5px rgba(11, 20, 26, .13);
  --accent: #008069; --accent-text: #fff; --code: rgba(11, 20, 26, .06);
`;
const DARK = `
  --bg: #0b141a; --panel: #202c33; --in: #202c33; --out: #005c4b; --text: #e9edef; --muted: #8696a0;
  --chip: #182229; --chip-text: #8696a0; --quote-in: #1d282f; --quote-out: #025144; --you: #06cf9c;
  --link: #53bdeb; --system: #182229; --system-text: #ffd279; --shadow: 0 1px 0.5px rgba(11, 20, 26, .5);
  --accent: #21c063; --accent-text: #0b141a; --code: rgba(255, 255, 255, .08);
`;

const BASE = `
* { box-sizing: border-box; }
html, body { margin: 0; }
body, .wa {
  background: var(--bg); color: var(--text);
  font: 14.2px/19px "Segoe UI", "Helvetica Neue", Helvetica, "Lucida Grande", Arial, Ubuntu, Cantarell, "Fira Sans", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.top {
  position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 12px;
  height: 59px; padding: 0 16px; background: var(--panel); border-bottom: 1px solid rgba(134, 150, 160, .15);
}
.avatar, .pp { flex: none; border-radius: 50%; object-fit: cover; }
.avatar { width: 40px; height: 40px; font-size: 18px; }
.initial { display: grid; place-items: center; color: #fff; font-weight: 500; }
.row.indent { position: relative; padding-left: 38px; }
.pp { position: absolute; left: 0; top: 10px; width: 28px; height: 28px; font-size: 13px; }
.who { flex: 1; min-width: 0; }
.chat-name { font-size: 16px; line-height: 21px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sub { font-size: 13px; line-height: 20px; color: var(--muted); }
#print {
  flex: none; border: 0; border-radius: 18px; padding: 8px 16px; font: inherit; font-weight: 500;
  background: var(--accent); color: var(--accent-text); cursor: pointer;
}
.chat { max-width: 920px; margin: 0 auto; padding: 12px 4% 24px; }
.day { display: flex; justify-content: center; margin: 12px 0 8px; }
.day span, .system, .end {
  background: var(--chip); color: var(--chip-text); border-radius: 7.5px; box-shadow: var(--shadow);
  font-size: 12.5px; line-height: 21px; padding: 5px 12px 6px;
}
.system { display: block; max-width: 560px; margin: 8px auto; background: var(--system); color: var(--system-text); }
.system ul { margin: 4px 0 0; padding-left: 18px; }
.end { display: table; margin: 18px auto 0; }
.row { display: flex; margin-top: 2px; }
.row.out { justify-content: flex-end; }
.msg {
  position: relative; max-width: min(65%, 520px); min-width: 72px; padding: 6px 7px 8px 9px;
  border-radius: 7.5px; background: var(--in); box-shadow: var(--shadow); overflow-wrap: anywhere;
}
.msg.out { background: var(--out); }
.msg.first { margin-top: 10px; }
.msg.in.first { border-top-left-radius: 0; }
.msg.out.first { border-top-right-radius: 0; }
.msg.first::before { content: ""; position: absolute; top: 0; width: 8px; height: 13px; background: inherit; }
.msg.in.first::before { left: -8px; clip-path: polygon(0 0, 100% 0, 100% 100%); }
.msg.out.first::before { right: -8px; clip-path: polygon(0 0, 100% 0, 0 100%); }
.msg.bare, .msg.bare:not(:has(.text)) { background: transparent; box-shadow: none; padding: 0; }
.msg.bare::before { display: none; }
.name { font-size: 12.8px; line-height: 22px; font-weight: 500; }
.forwarded { color: var(--muted); font-size: 13px; font-style: italic; margin-bottom: 2px; }
.text { white-space: pre-wrap; }
.text a { color: var(--link); }
.text code, .quote code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; background: var(--code); border-radius: 3px; padding: 0 3px; }
.text pre { margin: 2px 0; white-space: pre-wrap; }
.text pre code { display: block; padding: 6px 8px; }
.deleted { color: var(--muted); font-style: italic; }
.spacer { display: inline-block; visibility: hidden; padding-left: 10px; font-size: 11px; height: 0; }
.meta { position: absolute; right: 7px; bottom: 3px; font-size: 11px; line-height: 15px; color: var(--muted); white-space: nowrap; }
.meta.overlay {
  bottom: 8px; right: 10px; color: #fff; padding: 0 4px; border-radius: 4px;
  background: rgba(11, 20, 26, .35);
}
.msg:not(:has(.text)) { padding-bottom: 22px; }
.msg:has(.meta.overlay) { padding: 3px 3px 3px 3px; }
.msg.bare .meta { background: var(--chip); padding: 0 6px; border-radius: 8px; bottom: 4px; right: 4px; }
.quote {
  border-left: 4px solid var(--bar); border-radius: 7.5px; background: var(--quote-in);
  padding: 5px 10px 6px 8px; margin: 0 0 4px; font-size: 13.2px; line-height: 19px;
}
.out .quote { background: var(--quote-out); }
.quote-name { color: var(--bar); font-weight: 500; }
.quote-text { color: var(--muted); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; }
.photo, .video { display: block; width: 330px; max-width: 100%; min-height: 120px; border-radius: 6px; background: rgba(134, 150, 160, .2); cursor: zoom-in; object-fit: cover; }
.video { cursor: auto; }
.photo + .text, .video + .text { margin-top: 5px; padding: 0 4px; }
.sticker { display: block; width: 190px; height: 190px; object-fit: contain; }
.audio { display: flex; align-items: center; gap: 8px; min-width: 260px; }
.audio audio { flex: 1; min-width: 0; height: 36px; }
.audio-icon { font-size: 20px; }
.dur { color: var(--muted); font-size: 11px; }
.doc {
  display: flex; align-items: center; gap: 10px; min-width: 240px; padding: 10px; border-radius: 6px;
  background: var(--quote-in); color: inherit; text-decoration: none;
}
.out .doc { background: var(--quote-out); }
.doc-ext {
  flex: none; width: 32px; height: 40px; border-radius: 3px; display: grid; place-items: end center; padding-bottom: 4px;
  background: #df5a52; color: #fff; font-size: 9px; font-weight: 700;
}
.doc-info { display: flex; flex-direction: column; min-width: 0; }
.doc-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-meta { color: var(--muted); font-size: 12px; }
.missing { color: var(--muted); font-size: 13px; background: var(--code); border-radius: 6px; padding: 6px 8px; margin: 2px 0; }
#lightbox { position: fixed; inset: 0; z-index: 9; display: grid; place-items: center; background: rgba(11, 20, 26, .92); cursor: zoom-out; }
#lightbox[hidden] { display: none; }
#lightbox img { max-width: 95vw; max-height: 95vh; }
@media print {
  @page { margin: 12mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .top { position: static; }
  #print, #lightbox { display: none !important; }
  .chat { max-width: none; padding: 0 12px; }
  .row, .day, .system { break-inside: avoid; }
}
`;

const RESPONSIVE = `@media (max-width: 600px) { .msg { max-width: 85%; } .chat { padding: 8px 10px 18px; } }`;

/** The HTML page's styles: the viewer's light/dark setting, or one fixed theme. */
function pageCss(theme: HtmlOptions["theme"] = "auto"): string {
  if (theme === "light" || theme === "dark") {
    return `\n:root {\n  color-scheme: ${theme};${theme === "dark" ? DARK : LIGHT}}\n${BASE}\n${RESPONSIVE}`;
  }
  return `
:root {
  color-scheme: light dark;${LIGHT}}
@media (prefers-color-scheme: dark) {
  :root {${DARK}}
}
${BASE}
${RESPONSIVE}`;
}

// Snapshots (images, PDF): one fixed theme, a static header, and still versions of video and audio.
// No viewport-dependent rules: the offscreen layout and the SVG render must agree whatever WhatsApp's window size.
const SNAPSHOT_CSS = `
.wa { direction: ltr; }
.wa .top { position: static; }
.video.still { position: relative; display: block; width: 330px; max-width: 100%; aspect-ratio: 16 / 9; border-radius: 6px;
  background: #0b141a; overflow: hidden; }
.video.still .frame { display: block; width: 100%; height: 100%; object-fit: cover; }
.video.still .play { position: absolute; left: 50%; top: 50%; width: 48px; height: 48px; margin: -24px 0 0 -24px; border-radius: 50%;
  display: grid; place-items: center; background: rgba(11, 20, 26, .55); color: #fff; font-size: 20px; }
.video.still .vdur { position: absolute; left: 8px; bottom: 6px; padding: 0 4px; border-radius: 4px; color: #fff; font-size: 11px;
  background: rgba(11, 20, 26, .35); }
.audio.still { min-width: 280px; padding: 6px 0; }
.audio.still .play-icon { color: var(--muted); font-size: 18px; }
.wave { display: flex; flex: 1; align-items: center; gap: 2px; height: 24px; }
.wave i { display: block; width: 3px; border-radius: 2px; background: var(--muted); opacity: .7; }
`;

/** Styles for a snapshot root, `<div class="wa">`, in the given theme. */
export function snapshotCss(dark: boolean): string {
  return `.wa {${dark ? DARK : LIGHT}}\n${BASE}${SNAPSHOT_CSS}`;
}

// Decodes each media's base64 blocks into a Blob URL and gives it to the elements that show it.
const SCRIPT = `
(() => {
  const blocks = new Map();
  for (const s of document.querySelectorAll('script[type="application/octet-stream"]')) {
    if (!blocks.has(s.dataset.for)) blocks.set(s.dataset.for, []);
    blocks.get(s.dataset.for).push(s);
  }
  const urls = new Map();
  for (const el of document.querySelectorAll("[data-media]")) {
    const id = el.dataset.media;
    if (!urls.has(id)) {
      const chunks = (blocks.get(id) || []).map((s) => {
        const bin = atob(s.textContent.trim());
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        s.textContent = "";
        return bytes;
      });
      urls.set(id, chunks.length ? URL.createObjectURL(new Blob(chunks, { type: el.dataset.mime })) : null);
    }
    const url = urls.get(id);
    if (url) el.tagName === "A" ? (el.href = url) : (el.src = url);
  }
  const box = document.getElementById("lightbox");
  document.addEventListener("click", (e) => {
    const img = e.target.closest && e.target.closest("img.photo");
    if (img) { box.querySelector("img").src = img.src; box.hidden = false; }
    else if (e.target.closest && e.target.closest("#lightbox")) box.hidden = true;
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") box.hidden = true; });
  document.getElementById("print").addEventListener("click", () => window.print());
})();
`;
