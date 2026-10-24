# Live checklist

WhatsApp Web 2.3000.1051605128 · WA-JS 4.7.2 · tested 2026-10-24 on the owner's self-chat.

| Case | Chromium | Firefox | Evidence |
|---|---|---|---|
| WA-JS loads and the bridge answers | ✅ | | HEALTH ready, GET_CHAT → `+1 555-0100` |
| Select mode detected, ticks tracked | ✅ | | tracked count matches WhatsApp's "N selected" (3, 4, 5, 6) |
| Selection spanning a long scroll | ✅ | | 5 ids tracked after scrolling up 12 screens |
| Leaving select mode clears | ✅ | | "Cancel selection" → `{active:false, ids:[]}` |
| Export button placement | ✅ | | in the toolbar right after Forward; summary panel above it |
| Nothing selected | ✅ | | "Select at least one message first." |
| Own messages | ✅ | | rendered as "You" |
| Plain text with a link | ✅ | | text verbatim in chat.md |
| Forwarded message | ✅ | | `_↪ Forwarded_` label |
| Image with caption | ✅ | | caption above `![](media/001-photo.jpg)`; 972×646 JPEG, 102 764 bytes |
| Voice note | ✅ | | `🎤 [voice note, 0:03]`; valid Ogg/Opus, 7 623 bytes |
| Album | ✅ | | one selected row → both photos exported (fix: album expansion) |
| Expired media (Aug/Sep) | ✅ | | 5 files reported "expired on WhatsApp, not re-requested"; ZIP still produced; REMOTE_NEED_UPLOAD count unchanged (guard blocked every re-upload request) |
| PDF that downloads | ⏳ | | every PDF in the test chat had expired; needs a fresh one |
| Formatted text (`*bold*` …) | ⏳ | | none in the test chat yet |
| Reply (quoted) | ⏳ | | none in the test chat yet |
| Video | ⏳ | | none in the test chat yet |
| `<a download>` save | ✅ | | ZIP downloaded via the anchor |
