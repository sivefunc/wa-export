import { strToU8, Zip, ZipDeflate, ZipPassThrough } from "fflate";

export interface ZipEntry {
  path: string;
  data: Uint8Array | string;
  /** Deflate text; store media as is (photos, video and audio are already compressed). */
  compress: boolean;
}

/** Bytes fed to the archive between pauses, so a big export doesn't freeze the page. */
const SLICE_BYTES = 4 * 1024 * 1024;
const pause = () => new Promise<void>((resolve) => setTimeout(resolve));

/**
 * Build a ZIP blob with fflate's streaming API: synchronous, no Web Workers (WhatsApp's page may
 * block them) and no eval. Pauses between slices keep the page responsive and drive `onProgress`
 * (whole percentages, rising to 100).
 */
export async function buildZip(entries: ZipEntry[], onProgress?: (pct: number) => void): Promise<Blob> {
  const files = entries.map((e) => ({ ...e, bytes: typeof e.data === "string" ? strToU8(e.data) : e.data }));
  const total = files.reduce((n, f) => n + f.bytes.length, 0);
  const parts: Uint8Array[] = [];
  let failure: Error | null = null;
  const zip = new Zip((err, chunk) => {
    if (err) failure = err;
    else parts.push(chunk);
  });

  let done = 0;
  let last = -1;
  const report = () => {
    const pct = total ? Math.floor((done / total) * 100) : 100;
    if (pct > last) onProgress?.((last = pct));
  };

  for (const f of files) {
    const entry = f.compress ? new ZipDeflate(f.path, { level: 6 }) : new ZipPassThrough(f.path);
    zip.add(entry);
    if (!f.bytes.length) entry.push(f.bytes, true);
    for (let at = 0; at < f.bytes.length; at += SLICE_BYTES) {
      const end = Math.min(at + SLICE_BYTES, f.bytes.length);
      entry.push(f.bytes.subarray(at, end), end === f.bytes.length);
      done += end - at;
      report();
      await pause();
      if (failure) throw failure;
    }
  }
  zip.end();
  if (failure) throw failure;
  if (last < 100) onProgress?.(100);
  return new Blob(parts as BlobPart[], { type: "application/zip" });
}
