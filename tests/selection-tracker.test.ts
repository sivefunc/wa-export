// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkedState, isSelectionModeActive, SelectionTracker, type SelectionSnapshot } from "../src/dom/selection-tracker";

type Box = { top: number; height: number };
const boxes = new WeakMap<Element, Box>();

function setBox(el: Element, box: Box) {
  boxes.set(el, box);
}

beforeEach(() => {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const b = boxes.get(this);
    if (!b) return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} } as DOMRect;
    return { top: b.top, bottom: b.top + b.height, left: 0, right: 20, width: 20, height: b.height, x: 0, y: b.top, toJSON() {} } as DOMRect;
  };
  document.body.innerHTML = '<div id="main"></div>';
});

afterEach(() => {
  document.body.innerHTML = "";
});

const main = () => document.getElementById("main")!;

/** A message row with the checkbox nested inside it. */
function nestedRow(id: string, checked: boolean, top: number) {
  const row = document.createElement("div");
  row.dataset.id = id;
  const box = document.createElement("span");
  box.setAttribute("role", "checkbox");
  box.setAttribute("aria-checked", String(checked));
  row.append("hello", box);
  main().append(row);
  setBox(row, { top, height: 50 });
  setBox(box, { top: top + 15, height: 20 });
  return { row, box };
}

/** A message row whose checkbox is a sibling, matched by vertical position. */
function siblingRow(id: string, checked: boolean, top: number) {
  const wrap = document.createElement("div");
  const box = document.createElement("span");
  box.setAttribute("role", "checkbox");
  box.setAttribute("aria-checked", String(checked));
  const row = document.createElement("div");
  row.dataset.id = id;
  wrap.append(box, row);
  main().append(wrap);
  setBox(row, { top, height: 50 });
  setBox(box, { top: top + 15, height: 20 });
  return { row, box };
}

function tracker() {
  const changes: SelectionSnapshot[] = [];
  const t = new SelectionTracker(document, (s) => changes.push(s));
  return { t, changes };
}

describe("checkedState", () => {
  it("reads aria-checked, then input.checked, else null", () => {
    const a = document.createElement("span");
    a.setAttribute("aria-checked", "true");
    expect(checkedState(a)).toBe(true);
    a.setAttribute("aria-checked", "false");
    expect(checkedState(a)).toBe(false);
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = true;
    expect(checkedState(input)).toBe(true);
    expect(checkedState(document.createElement("div"))).toBeNull();
  });
});

describe("isSelectionModeActive", () => {
  it("is false without visible checkboxes and true with one", () => {
    expect(isSelectionModeActive(document)).toBe(false);
    nestedRow("false_1@c.us_A", false, 100);
    expect(isSelectionModeActive(document)).toBe(true);
  });
});

describe("SelectionTracker", () => {
  it("nested aria-checked=true row is selected", () => {
    nestedRow("false_1@c.us_A", true, 100);
    nestedRow("false_1@c.us_B", false, 200);
    const { t } = tracker();
    t.reconcile();
    expect(t.snapshot()).toEqual({ active: true, chatJid: "1@c.us", ids: ["false_1@c.us_A"] });
  });

  it("sibling checkbox matched by geometry", () => {
    siblingRow("false_1@c.us_A", false, 100);
    siblingRow("false_1@c.us_B", true, 200);
    const { t } = tracker();
    t.reconcile();
    expect(t.snapshot().ids).toEqual(["false_1@c.us_B"]);
  });

  it("unchecking removes the id", () => {
    const { box } = nestedRow("false_1@c.us_A", true, 100);
    const { t } = tracker();
    t.reconcile();
    box.setAttribute("aria-checked", "false");
    t.reconcile();
    expect(t.snapshot().ids).toEqual([]);
  });

  it("row removed from DOM stays selected", () => {
    const { row } = nestedRow("false_1@c.us_A", true, 100);
    nestedRow("false_1@c.us_B", false, 200);
    const { t } = tracker();
    t.reconcile();
    row.remove();
    t.reconcile();
    expect(t.snapshot().ids).toEqual(["false_1@c.us_A"]);
  });

  it("leaving selection mode clears", () => {
    nestedRow("false_1@c.us_A", true, 100);
    const { t } = tracker();
    t.reconcile();
    main().querySelectorAll('[role="checkbox"]').forEach((b) => b.remove());
    t.reconcile();
    expect(t.snapshot()).toEqual({ active: false, chatJid: null, ids: [] });
  });

  it("rows from a different chat jid clear the set", () => {
    nestedRow("false_1@c.us_A", true, 100);
    const { t } = tracker();
    t.reconcile();
    main().innerHTML = "";
    nestedRow("false_2@g.us_X_9@c.us", false, 100);
    t.reconcile();
    expect(t.snapshot()).toEqual({ active: true, chatJid: "2@g.us", ids: [] });
  });

  it("ids keep first-checked order", () => {
    const a = nestedRow("false_1@c.us_A", false, 100);
    nestedRow("false_1@c.us_B", true, 200);
    const { t } = tracker();
    t.reconcile();
    a.box.setAttribute("aria-checked", "true");
    t.reconcile();
    expect(t.snapshot().ids).toEqual(["false_1@c.us_B", "false_1@c.us_A"]);
  });

  it("reports changes through onChange only when the snapshot changes", () => {
    const { box } = nestedRow("false_1@c.us_A", false, 100);
    const { t, changes } = tracker();
    t.reconcile();
    t.reconcile();
    box.setAttribute("aria-checked", "true");
    t.reconcile();
    expect(changes.map((c) => c.ids)).toEqual([[], ["false_1@c.us_A"]]);
  });
});
