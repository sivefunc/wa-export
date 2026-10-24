// Bundled into the fixture add-on: the real ZIP writer, exposed to the fixture's test script.
import { getWriter } from "../../src/export/writers";

(globalThis as { __waExportGetWriter?: typeof getWriter }).__waExportGetWriter = getWriter;
