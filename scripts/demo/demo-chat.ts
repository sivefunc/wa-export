// The fictional "Bamboo team" chat used for the README screenshots, the demo export and tests.
// Every name, message and file is made up; the media comes from docs/demo/assets/.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExportBundle } from "../../src/types";
import { demoChatFrom } from "./demo-chat-browser";

export function demoChat(assetsDir: string): ExportBundle {
  return demoChatFrom((name, mime) => new Blob([readFileSync(join(assetsDir, name))], { type: mime }));
}
