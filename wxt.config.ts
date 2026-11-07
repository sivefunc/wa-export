import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "wxt";
import { vendorWaJs } from "./scripts/build/vendor-wa-js";

const WA_JS_DIST = resolve("node_modules/@wppconnect/wa-js/dist");
const WA_JS_DEST = "vendor/wppconnect-wa.js";

export default defineConfig({
  manifestVersion: 3,
  zip: {
    // The sources zip is uploaded to AMO: keep the live WhatsApp profile, secrets and exports out.
    excludeSources: [".live/**", ".superpowers/**", ".env*", "web-ext-artifacts/**", "**/*.zip"],
  },
  manifest: ({ browser }) => ({
    name: "WA Export for WhatsApp Web",
    description: "Export selected WhatsApp Web messages to ZIP, HTML, PDF or images, entirely on your computer.",
    permissions: ["storage"],
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            // data_collection_permissions needs Firefox 140 on desktop and 142 on Android.
            gecko: {
              id: "sivefunc@gmail.com",
              strict_min_version: "140.0",
              // The extension collects nothing; AMO requires this declaration.
              data_collection_permissions: { required: ["none"] },
            },
            gecko_android: { strict_min_version: "142.0" },
          },
        }
      : { minimum_chrome_version: "111" }),
  }),
  hooks: {
    // WA-JS is bundled from node_modules, never fetched at runtime, with its one Node-only eval removed.
    "build:publicAssets": (_wxt, files) => {
      files.push(
        { contents: vendorWaJs(readFileSync(`${WA_JS_DIST}/wppconnect-wa.js`, "utf8")), relativeDest: WA_JS_DEST },
        { absoluteSrc: `${WA_JS_DIST}/wppconnect-wa.js.LICENSE.txt`, relativeDest: `${WA_JS_DEST}.LICENSE.txt` },
        { absoluteSrc: resolve("THIRD_PARTY_NOTICES.md"), relativeDest: "THIRD_PARTY_NOTICES.md" },
      );
    },
    // WA-JS must run before our page bridge, in the same MAIN-world script list.
    "build:manifestGenerated": (_wxt, manifest) => {
      const main = manifest.content_scripts?.find((cs: any) => cs.world === "MAIN");
      if (!main) throw new Error("MAIN-world content script missing from manifest");
      main.js = [WA_JS_DEST, ...(main.js ?? [])];
    },
  },
});
