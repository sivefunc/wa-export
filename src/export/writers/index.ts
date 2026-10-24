import type { ExportBundle } from "../../types";
import { zipWriter } from "./zip";

export interface Writer {
  id: string;
  label: string;
  write(b: ExportBundle): Promise<{ blob: Blob; filename: string }>;
}

export const writers: Record<string, Writer> = { zip: zipWriter };

export const DEFAULT_WRITER = "zip";

export function getWriter(id: string): Writer {
  return writers[id] ?? writers[DEFAULT_WRITER];
}
