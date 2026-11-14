/** Where the site is published. Every absolute link to the site is built from this one value. */
export declare const SITE_URL: string;
/** Builds the site into `outDir` (.output/site by default), replacing whatever was there. Returns `outDir`. */
export declare function buildSite(outDir?: string): string;
