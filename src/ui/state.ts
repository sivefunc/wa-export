import { formatBytes } from "../export/collect";

export type UiState =
  | { kind: "hidden" }
  | { kind: "idle"; count: number }
  | { kind: "working"; stage: "reading" | "downloading"; done: number; total: number }
  | { kind: "working"; stage: "writing"; fileType: string; done: number; total: number }
  | { kind: "confirm"; bytes: number }
  | { kind: "done"; messages: number; problems: string[] } // problems already in plain text
  | { kind: "error"; message: string };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export { formatBytes };

/** Share of the current stage that is done (0–1) while working; null otherwise. */
export function progressFraction(s: UiState): number | null {
  if (s.kind !== "working") return null;
  return s.total > 0 ? Math.min(1, s.done / s.total) : 0;
}

export function buttonLabel(s: UiState): string {
  switch (s.kind) {
    case "hidden":
      return "";
    case "idle":
      return s.count ? `Export ${s.count}` : "Export";
    case "working":
      if (s.stage === "writing") return `Creating ${s.fileType}… ${s.done}%`;
      if (s.stage === "reading") return `Reading ${plural(s.total, "message")}…`;
      return `Downloading files ${s.done}/${s.total}…`;
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
