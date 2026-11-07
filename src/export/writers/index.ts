import type { ExportBundle } from "../../types";
import type { Settings } from "../../settings";
import type { SizeLimits } from "../collect";
import { htmlWriter } from "./html";
import { jpegWriter, pdfWriter, pngWriter } from "./image";
import { zipWriter } from "./zip";
import { DEFAULT_WRITER, type WriterId, type WriterInfo } from "./catalog";

export { DEFAULT_WRITER } from "./catalog";

export interface Writer extends WriterInfo {
  limits: SizeLimits;
  wantsAvatars?: boolean; // collect profile pictures into bundle.avatars
  write(b: ExportBundle, onProgress?: (percent: number) => void, settings?: Settings): Promise<{ blob: Blob; filename: string }>;
}

/** Every format, in the catalog's order (the order the settings list them). */
export const writers: Record<WriterId, Writer> & Record<string, Writer | undefined> = { zip: zipWriter, html: htmlWriter, pdf: pdfWriter, png: pngWriter, jpeg: jpegWriter };

export function getWriter(id: string): Writer {
  return writers[id] ?? writers[DEFAULT_WRITER];
}
