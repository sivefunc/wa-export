// Bundled for the browser checks: the real writers plus the fictional demo chat.
import { demoChatFrom } from "../demo/demo-chat-browser";
import { getWriter } from "../../src/export/writers";

(globalThis as any).__waRaster = { getWriter, demoChatFrom };
