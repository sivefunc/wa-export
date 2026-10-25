# Live checklist

WhatsApp Web 2.3000.1051605128 · WA-JS 4.7.2 · tested 2026-10-24 on the owner's self-chat.

| Case | Chromium | Firefox | Evidence |
|---|---|---|---|
| WA-JS loads and the bridge answers | ✅ | ✅ | HEALTH ready, GET_CHAT → `+1 555-0100` |
| Select mode detected, ticks tracked | ✅ | ✅ | tracked count matches WhatsApp's "N selected" (3, 4, 5, 6) |
| Selection spanning a long scroll | ✅ | | 5 ids tracked after scrolling up 12 screens |
| Leaving select mode clears | ✅ | | "Cancel selection" → `{active:false, ids:[]}` |
| Export button placement | ✅ | ✅ | in the toolbar right after Forward; summary panel above it |
| Nothing selected | ✅ | | "Select at least one message first." |
| Own messages | ✅ | ✅ | rendered as "You" |
| Plain text with a link | ✅ | | text verbatim in chat.md |
| Forwarded message | ✅ | ✅ | `_↪ Forwarded_` label |
| Image with caption | ✅ | ✅ | caption above `![](media/001-photo.jpg)`; 972×646 JPEG, 102 764 bytes |
| Voice note | ✅ | ✅ | `🎤 [voice note, 0:03]`; valid Ogg/Opus, 7 623 bytes |
| Album | ✅ | | one selected row → both photos exported (fix: album expansion) |
| Missing file named | ✅ | | `⚠️ File missing (report.pdf): expired on WhatsApp, not re-requested` |
| Expired media (Aug/Sep) | ✅ | | 5 files reported "expired on WhatsApp, not re-requested"; ZIP still produced; REMOTE_NEED_UPLOAD count unchanged (guard blocked every re-upload request) |
| PDF that downloads | ✅ | ✅ | fresh 21.9 MB PDF, valid `PDF document, version 1.4`, original filename kept |
| Formatted text | ✅ | ✅ | `*Hola*` → `**Hola**`, `_Hola_` unchanged |
| Reply (quoted) | ✅ | ✅ | quote of own text → "Replying to **You**" + quoted text; quote of a video → `_(Video)_` (fixes: quoted fromMe + kind) |
| Video | ✅ | ✅ | MP4 2.8 MB, valid ISO Media |
| `<a download>` save | ✅ | ✅ | ZIP downloaded via the anchor |
| Group chat, other members' messages | ✅ | | senders with `@lid` ids resolved to their profile names; received image at full size; long formatted message intact |
| 1:1 chat with an unsaved contact | ✅ | | name from their WhatsApp profile name; links kept as text |
| Edited message | ✅ | | final text exported (no "edited" mark yet) |
| HTML format: page opens, media shows and plays | | | pending live run; fictional sample checked in Chromium (light, dark, print to PDF) |
| HTML format: Save as PDF | | | pending live run |
| PDF, PNG, JPEG export in WhatsApp | | | pending live run; demo chat checked in Chromium (test:chromium) and a Firefox content script (test:firefox) |
| Profile pictures (GET_AVATARS over the real bridge) | ✅ | | 8 of 9 jids (`@c.us`, `@lid`, `@g.us`) → JPEG 2–6 KB from `*.whatsapp.net`; an unknown number → left out |

## Firefox notes

- The owner's Firefox export (2026-10-24 11:53) gave 10 messages and 0 problems. Media: 1280×963 + 972×646 JPEG, 2 Ogg/Opus voice notes, a 2.8 MB MP4, a 21.9 MB PDF.
- Found and fixed in Firefox:
  - the button floated on the first tick
  - the "5/5" progress counted messages and files together
  - ZIP creation stalled at 33%: JSZip hit page-compartment buffers. Reproduced in headless Firefox 158; fixed with a structuredClone copy.
