// Plain-object stand-ins for WhatsApp Web's internal MsgModel, shaped like what WA-JS returns.

export const BASE64_THUMBNAIL = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL".repeat(18);

export const wid = (s: string) => ({ _serialized: s });
export const wid$1 = (s: string) => ({ $1: s });

export const chatText = {
  id: { fromMe: false, _serialized: "false_123@c.us_AAA" },
  type: "chat",
  t: 1792845296,
  body: "*bold* and _italic_",
  from: wid("123@c.us"),
  to: wid("999@c.us"),
  notifyName: "Ana",
};

export const imageWithCaption = {
  id: { fromMe: false, _serialized: "false_123@c.us_IMG" },
  type: "image",
  t: 1792845300,
  body: BASE64_THUMBNAIL,
  caption: "the caption",
  mimetype: "image/jpeg",
  size: 204800,
  from: wid("123@c.us"),
  mediaData: { mediaStage: "RESOLVED" },
};

export const idAsDollarOne = {
  id: { fromMe: true, $1: "true_123@c.us_DOLLAR" },
  type: "chat",
  t: 1792845301,
  body: "hi",
  from: wid$1("999@c.us"),
};

export const groupMessage = {
  id: { fromMe: false, _serialized: "false_120363@g.us_GRP_456@c.us" },
  type: "chat",
  t: 1792845302,
  body: "from a group",
  from: wid("120363@g.us"),
  author: wid("456@c.us"),
  notifyName: "Luis",
};

export const ownMessage = {
  id: { fromMe: true, _serialized: "true_123@c.us_OWN" },
  type: "chat",
  t: 1792845303,
  body: "mine",
  from: wid("999@c.us"),
};

export const voiceNote = {
  id: { fromMe: false, _serialized: "false_123@c.us_PTT" },
  type: "ptt",
  t: 1792845304,
  body: BASE64_THUMBNAIL,
  mimetype: "audio/ogg; codecs=opus",
  duration: "42",
  size: 12000,
  from: wid("123@c.us"),
  mediaData: { mediaStage: "RESOLVED" },
};

export const replyWithMissingQuote = {
  id: { fromMe: false, _serialized: "false_123@c.us_REPLY" },
  type: "chat",
  t: 1792845305,
  body: "replying",
  from: wid("123@c.us"),
  quotedStanzaID: "OLD",
  quotedParticipant: wid("456@c.us"),
};

export const replyWithQuote = {
  ...replyWithMissingQuote,
  id: { fromMe: false, _serialized: "false_123@c.us_REPLY2" },
  quotedMsg: { type: "chat", body: "Does this reproduce in Firefox?", t: 1792845000 },
};

export const revoked = {
  id: { fromMe: false, _serialized: "false_123@c.us_DEL" },
  type: "revoked",
  t: 1792845306,
  from: wid("123@c.us"),
};

export const pdfDocument = {
  id: { fromMe: false, _serialized: "false_123@c.us_PDF" },
  type: "document",
  t: 1792845307,
  body: BASE64_THUMBNAIL,
  caption: "",
  filename: "design-spec.pdf",
  mimetype: "application/pdf",
  size: 1258291,
  from: wid("123@c.us"),
  mediaData: { mediaStage: "RESOLVED" },
};
