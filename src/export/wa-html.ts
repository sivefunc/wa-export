// WhatsApp formatting → HTML for the HTML export. Text is escaped first, so only the tags made here exist.

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

// Same edges as markdown.ts, plus our own tags (escaped text has no other < or >), so markers can nest.
const OPEN = "(^|[\\s([{>])";
const CLOSE = "(?=$|[\\s)\\]}.,!?:;<])";
const marker = (m: string) => {
  const e = `\\${m}`;
  return new RegExp(`${OPEN}${e}([^\\s${e}\\n](?:[^${e}\\n]*[^\\s${e}\\n])?)${e}${CLOSE}`, "gm");
};
const STYLES: [RegExp, string][] = [
  [marker("*"), "strong"],
  [marker("_"), "em"],
  [marker("~"), "del"],
];
// Runs on escaped text, so quotes and angle brackets that end a link are entities by now. Trailing punctuation,
// a trailing & and formatting markers belong to the sentence, not the link. NUL marks a stashed code span.
const URL = /https?:\/\/[^\s<>"'\u0000]+?(?=(?:[.,!?:;)\]*_~]|&amp;)*(?:\s|$|\u0000|&lt;|&gt;|&quot;|&#39;))/g;

export function whatsappToHtml(input: string): string {
  const stash: string[] = [];
  const protect = (html: string) => `\u0000${stash.push(html) - 1}\u0000`;

  let text = escapeHtml(input.replace(/\u0000/g, ""));
  // Code first, so markers inside it are never converted.
  text = text.replace(/```([\s\S]*?)```/g, (_m, code: string) => protect(`<pre><code>${code.replace(/^\n|\n$/g, "")}</code></pre>`));
  text = text.replace(/`([^`\n\u0000]+)`/g, (_m, code: string) => protect(`<code>${code}</code>`));
  text = text.replace(URL, (url) => protect(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`));
  for (const [re, tag] of STYLES) text = text.replace(re, `$1<${tag}>$2</${tag}>`);

  return text.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => stash[Number(i)]);
}
