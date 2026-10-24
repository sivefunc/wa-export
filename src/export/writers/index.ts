import type { ExportBundle } from "../../types";
import type { SizeLimits } from "../collect";
import { htmlWriter } from "./html";
import { zipWriter } from "./zip";

export interface Writer {
  id: string;
  label: string;
  fileType: string; // short name for progress and the settings menu, e.g. "ZIP"
  description: string; // one line under fileType in the settings menu
  limits: SizeLimits;
  wantsAvatars?: boolean; // collect profile pictures into bundle.avatars
  write(b: ExportBundle, onProgress?: (percent: number) => void): Promise<{ blob: Blob; filename: string }>;
}

export const writers: Record<string, Writer> = { zip: zipWriter, html: htmlWriter };

export const DEFAULT_WRITER = "zip";

export function getWriter(id: string): Writer {
  return writers[id] ?? writers[DEFAULT_WRITER];
}
