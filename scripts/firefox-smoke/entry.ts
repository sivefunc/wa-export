// Bundled into the fixture add-on: the real writers and the fictional demo chat, exposed to the test script.
import { getWriter } from "../../src/export/writers";
import { demoChatFrom } from "../demo/demo-chat-browser";

Object.assign(globalThis, { __waExportGetWriter: getWriter, __waDemoChatFrom: demoChatFrom });
