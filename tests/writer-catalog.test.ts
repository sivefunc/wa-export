import { describe, expect, it } from "vitest";
import { writers } from "../src/export/writers";
import { DEFAULT_WRITER, isWriterId, writerCatalog } from "../src/export/writers/catalog";

describe("writer catalog", () => {
  it("lists every writer, in the registry's order, with the writer's own names", () => {
    expect(Object.keys(writerCatalog)).toEqual(Object.keys(writers));
    for (const [id, info] of Object.entries(writerCatalog)) {
      const { id: wid, label, fileType, description } = writers[id]!;
      expect({ id: wid, label, fileType, description }).toEqual(info);
    }
  });

  it("knows the default and rejects unknown or inherited ids", () => {
    expect(isWriterId(DEFAULT_WRITER)).toBe(true);
    expect(isWriterId("pdf-someday")).toBe(false);
    expect(isWriterId("toString")).toBe(false);
    expect(isWriterId(undefined)).toBe(false);
  });
});
