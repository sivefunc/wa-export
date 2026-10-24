import { describe, expect, it } from "vitest";
import { parseChatJid } from "../src/dom/chat-id";

describe("parseChatJid", () => {
  it("reads the chat from a direct-chat id", () => {
    expect(parseChatJid("true_123@c.us_ABC")).toBe("123@c.us");
  });

  it("reads the group, not the participant, from a group id", () => {
    expect(parseChatJid("false_120363@g.us_3EB0_456@c.us")).toBe("120363@g.us");
  });

  it("returns null for anything else", () => {
    expect(parseChatJid("garbage")).toBeNull();
    expect(parseChatJid("true_nojid_ABC")).toBeNull();
    expect(parseChatJid("")).toBeNull();
  });
});
