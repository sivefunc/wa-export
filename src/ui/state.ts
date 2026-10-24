export type UiState =
  | { kind: "hidden" }
  | { kind: "idle"; count: number }
  | { kind: "working"; done: number; total: number }
  | { kind: "confirm"; bytes: number }
  | { kind: "done"; messages: number; problems: string[] } // problems already in plain text
  | { kind: "error"; message: string };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function formatBytes(bytes: number): string {
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function buttonLabel(s: UiState): string {
  switch (s.kind) {
    case "hidden":
      return "";
    case "idle":
      return s.count ? `Export ${s.count}` : "Export";
    case "working":
      return `Exporting ${s.done}/${s.total}…`;
    case "confirm":
      return `This export is ${formatBytes(s.bytes)}. Continue?`;
    case "done": {
      const base = `Exported ${plural(s.messages, "message")}`;
      return s.problems.length ? `${base} · ${plural(s.problems.length, "problem")}` : base;
    }
    case "error":
      return s.message;
  }
}
