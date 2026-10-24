import type { ExportBundle } from "../../types";
import type { SizeLimits } from "../collect";
import { zipWriter } from "./zip";

export interface Writer {
  id: string;
  label: string;
  fileType: string; // short name for progress, e.g. "ZIP"
  limits: SizeLimits;
  write(b: ExportBundle, onProgress?: (percent: number) => void): Promise<{ blob: Blob; filename: string }>;
}

export const writers: Record<string, Writer> = { zip: zipWriter };

export const DEFAULT_WRITER = "zip";

export function getWriter(id: string): Writer {
  return writers[id] ?? writers[DEFAULT_WRITER];
}
