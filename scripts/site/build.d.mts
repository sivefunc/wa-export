/** Where the site is published. Every absolute link to the site is built from this one value. */
export declare const SITE_URL: string;
/** Builds the site into `outDir` (.output/site by default), replacing whatever was there. Returns `outDir`. */
export declare function buildSite(outDir?: string): string;
/** Maps a request URL to a file in the built site: 400 for a malformed path, 403 for one leaving the site. */
export declare function resolveRequest(base: string, url: string): { status: 200; file: string } | { status: 400 | 403 };
