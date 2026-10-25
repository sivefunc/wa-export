// Writes the demo chat through the real HTML writer. Run by scripts/demo/render.mjs with TZ=UTC and en-US.
import { writeFileSync } from "node:fs";
import { htmlWriter } from "../../src/export/writers/html";
import { demoChat } from "./demo-chat";

const [assetsDir, outFile] = process.argv.slice(2);
const { blob } = await htmlWriter.write(demoChat(assetsDir));
writeFileSync(outFile, Buffer.from(await blob.arrayBuffer()));
