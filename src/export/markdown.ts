// Best-effort WhatsApp → Markdown. The raw text is always kept in messages.json.

const OPEN = "(^|[\\s([{])";
const CLOSE = "(?=$|[\\s)\\]}.,!?:;])";
const inner = (marker: string) => `([^\\s${marker}\\n](?:[^${marker}\\n]*[^\\s${marker}\\n])?)`;
const BOLD = new RegExp(`${OPEN}\\*${inner("*")}\\*${CLOSE}`, "gm");
const STRIKE = new RegExp(`${OPEN}~${inner("~")}~${CLOSE}`, "gm");

export function whatsappToMarkdown(input: string): string {
  const stash: string[] = [];
  const protect = (value: string) => `${stash.push(value) - 1}`;

  // Code first, so markers inside it are never converted.
  let text = input.replace(/```([\s\S]*?)```/g, (_m, code: string, offset: number, all: string) => {
    const before = offset > 0 && all[offset - 1] !== "\n" ? "\n" : "";
    const end = offset + _m.length;
    const after = end < all.length && all[end] !== "\n" ? "\n" : "";
    return `${before}${protect("```\n" + code.replace(/^\n|\n$/g, "") + "\n```")}${after}`;
  });
  text = text.replace(/`[^`\n]+`/g, (code) => protect(code));

  // _italic_ is already Markdown.
  text = text.replace(BOLD, "$1**$2**").replace(STRIKE, "$1~~$2~~");

  return text.replace(/(\d+)/g, (_m, i: string) => stash[Number(i)]);
}
