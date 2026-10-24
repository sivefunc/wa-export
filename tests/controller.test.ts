import { describe, expect, it } from "vitest";
import type { CollectResult } from "../src/export/collect";
import { createExportController } from "../src/ui/controller";
import type { UiState } from "../src/ui/state";
import { record } from "./fixtures/messages";

function setup(result: CollectResult | (() => Promise<CollectResult>), write?: () => Promise<{ blob: Blob; filename: string }>) {
  const states: UiState[] = [];
  const saved: string[] = [];
  let confirmAnswer: ((ok: boolean) => void) | null = null;
  const c = createExportController({
    setState: (s) => states.push(s),
    loadSettings: async () => ({ format: "zip", order: "date" }),
    collect: async (o) => {
      if (typeof result === "function") return result();
      o.onProgress({ stage: "downloading", done: 1, total: 2 });
      return result;
    },
    getWriter: () => ({
      id: "zip",
      label: "ZIP",
      write:
        write ??
        (async (_b, onProgress) => {
          onProgress?.(50);
          return { blob: new Blob(["z"]), filename: "chat.zip" };
        }),
    }),
    save: (_blob, name) => saved.push(name),
  });
  return { c, states, saved, last: () => states.at(-1)!, answer: (ok: boolean) => confirmAnswer?.(ok), setConfirm: (fn: any) => (confirmAnswer = fn) };
}

const okResult = (): CollectResult => ({
  ok: true,
  bundle: { chat: { jid: null, name: "Team" }, exportedAt: new Date(), records: [record(), record()], media: new Map(), problems: [] },
});

describe("export controller", () => {
  it("shows the count while select mode is active and hides otherwise", () => {
    const { c, last } = setup(okResult());
    c.selectionChanged({ active: true, ids: ["a", "b"] });
    expect(last()).toEqual({ kind: "idle", count: 2 });
    c.selectionChanged({ active: false, ids: [] });
    expect(last()).toEqual({ kind: "hidden" });
  });

  it("exports, saves the file and reports done", async () => {
    const { c, states, saved, last } = setup(okResult());
    c.selectionChanged({ active: true, ids: ["a", "b"] });
    await c.exportNow();
    expect(states).toContainEqual({ kind: "working", stage: "downloading", done: 1, total: 2 });
    expect(states).toContainEqual({ kind: "working", stage: "zipping", done: 50, total: 100 });
    expect(saved).toEqual(["chat.zip"]);
    expect(last()).toEqual({ kind: "done", messages: 2, problems: [] });
  });

  it("a fatal collect result shows its message and saves nothing", async () => {
    const { c, saved, last } = setup({ ok: false, error: { code: "not_ready", message: "Can't read WhatsApp's messages. The extension needs an update." } });
    c.selectionChanged({ active: true, ids: ["a"] });
    await c.exportNow();
    expect(saved).toEqual([]);
    expect(last()).toEqual({ kind: "error", message: "Can't read WhatsApp's messages. The extension needs an update." });
  });

  it("a writer failure is reported", async () => {
    const { c, last } = setup(okResult(), async () => {
      throw new Error("out of memory");
    });
    c.selectionChanged({ active: true, ids: ["a"] });
    await c.exportNow();
    expect(last()).toEqual({ kind: "error", message: "Couldn't create the export file: out of memory" });
  });

  it("an unexpected collect crash is reported, not swallowed", async () => {
    const { c, last } = setup(async () => {
      throw new Error("boom");
    });
    c.selectionChanged({ active: true, ids: ["a"] });
    await c.exportNow();
    expect(last()).toEqual({ kind: "error", message: "Export failed: boom" });
  });

  it("done stays visible through selection changes until dismissed", async () => {
    const { c, last } = setup(okResult());
    c.selectionChanged({ active: true, ids: ["a"] });
    await c.exportNow();
    c.selectionChanged({ active: false, ids: [] });
    expect(last().kind).toBe("done");
    c.dismiss();
    expect(last()).toEqual({ kind: "hidden" });
  });

  it("asks before a large export and passes the answer through", async () => {
    let resolveCollect!: (r: CollectResult) => void;
    const states: UiState[] = [];
    let answer: boolean | null = null;
    const c = createExportController({
      setState: (s) => states.push(s),
      loadSettings: async () => ({ format: "zip", order: "date" }),
      collect: async (o) => {
        answer = await o.confirmLargeExport(600 * 1024 * 1024);
        return new Promise((r) => (resolveCollect = r));
      },
      getWriter: () => ({ id: "zip", label: "ZIP", write: async () => ({ blob: new Blob([]), filename: "x.zip" }) }),
      save: () => {},
    });
    c.selectionChanged({ active: true, ids: ["a"] });
    const running = c.exportNow();
    await new Promise((r) => setTimeout(r, 0));
    expect(states.at(-1)).toEqual({ kind: "confirm", bytes: 600 * 1024 * 1024 });
    c.confirm(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(answer).toBe(false);
    resolveCollect({ ok: false, error: { code: "cancelled", message: "Export cancelled." } });
    await running;
    expect(states.at(-1)).toEqual({ kind: "error", message: "Export cancelled." });
  });

  it("ignores a second export click while one is running", async () => {
    let calls = 0;
    const { c } = setup(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 5));
      return okResult();
    });
    c.selectionChanged({ active: true, ids: ["a"] });
    await Promise.all([c.exportNow(), c.exportNow()]);
    expect(calls).toBe(1);
  });
});
