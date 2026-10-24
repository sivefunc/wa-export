import type { ChatInfo, WaMessage } from "../types";

export const CHANNEL = "wa-export:v1";

export interface Ops {
  HEALTH: { req: {}; res: { ready: boolean; missing: string[]; waJsVersion: string | null } };
  GET_CHAT: { req: { jid: string }; res: ChatInfo };
  GET_MESSAGES: {
    req: { ids: string[] };
    res: { messages: WaMessage[]; failures: { id: string; code: "message_not_found"; detail: string }[] };
  };
  GET_MEDIA: { req: { id: string }; res: { mime: string; buffer: ArrayBuffer } };
}

export type OpName = keyof Ops;

/**
 * Error codes that cross the bridge:
 * not_ready | media_not_found | media_expired | view_once | timeout | unknown_op | internal
 */
export class RpcError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "RpcError";
  }
}
