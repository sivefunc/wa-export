// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { CHANNEL } from "../src/bridge/protocol";
import { windowTransport } from "../src/bridge/rpc";

function deliver(data: unknown, init: { origin?: string; source?: MessageEventSource | null } = {}) {
  window.dispatchEvent(new MessageEvent("message", { data, origin: init.origin ?? location.origin, source: init.source === undefined ? window : init.source }));
}

describe("windowTransport", () => {
  it("delivers only same-window, same-origin messages on our channel in its direction", () => {
    const got: unknown[] = [];
    const stop = windowTransport("content").listen((m) => got.push(m));
    const response = { channel: CHANNEL, dir: "response", requestId: "1", ok: true, value: 1 };
    deliver(response);
    deliver({ ...response, requestId: "foreign-origin" }, { origin: "https://evil.example" });
    deliver({ ...response, requestId: "other-source" }, { source: null });
    deliver({ ...response, requestId: "other-channel", channel: "other:v1" });
    deliver({ ...response, requestId: "own-direction", dir: "request" });
    stop();
    deliver({ ...response, requestId: "after-stop" });
    expect(got).toEqual([response]);
  });

  it("the page side hears requests, not responses", () => {
    const got: any[] = [];
    const stop = windowTransport("page").listen((m) => got.push(m));
    deliver({ channel: CHANNEL, dir: "request", requestId: "r", op: "HEALTH", req: {} });
    deliver({ channel: CHANNEL, dir: "response", requestId: "x", ok: true, value: 1 });
    stop();
    expect(got.map((m) => m.requestId)).toEqual(["r"]);
  });
});
