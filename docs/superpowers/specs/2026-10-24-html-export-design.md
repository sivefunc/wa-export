# HTML export ("WhatsApp look") — design

Approved in conversation on 2026-10-24.

## Intent

The ZIP is built for Claude Code: Markdown plus loose media. People also want to *see* an export the way it
looked in WhatsApp, to check it worked and to share or print it. A second format gives them that: a single
self-contained `.html` file that renders the selected messages like WhatsApp Web and can be saved as a PDF from
the browser's print dialog.

## Goals

- New writer `html`, picked in Options as "HTML (WhatsApp look)". ZIP stays the default.
- One file, no network, opens in any current browser (Chrome 111+, Firefox 128+, Safari is fine but untested).
- Looks like WhatsApp Web: beige chat background, white incoming and green outgoing bubbles, tails on the first
  bubble of a run, colored sender names in groups, time in the bubble's corner, centered day chips,
  "Forwarded" label, reply boxes with a colored bar, WhatsApp formatting (`*bold*`, `_italic_`, `~strike~`,
  `` `code` ``, ```` ```mono``` ````), clickable links. Light and dark themes follow the system.
- Media is embedded: photos and stickers inline (click to enlarge), videos and voice notes/audio play inline,
  documents as a card that downloads the original file.
- Deleted messages, unsupported types and media problems are shown in the conversation, and an "Export problems"
  box at the top lists them, using the same plain-language text as chat.md.
- A "Save as PDF" button calls `window.print()`; print CSS hides the toolbar and keeps bubble colors.

## Non-goals

- Producing a PDF inside the extension (rasterizing via html2canvas or drawing with pdf-lib). The browser's print
  engine gives real, selectable text with correct emoji and scripts.
- WhatsApp's doodle wallpaper and other WhatsApp artwork (not ours to ship).
- Video thumbnails, read receipts, reactions, edited marks.

## Decisions

- **Embedding.** Media bytes go into `<script type="application/octet-stream" data-media="N">` blocks as base64,
  written as many Blob parts so no single JavaScript string grows with file size. A small inline script decodes
  each block to a Blob URL on load and assigns it to the matching `<img>`, `<video>`, `<audio>` or download link.
  This avoids per-browser `data:` URL size limits for large videos.
- **Limits.** Base64 grows the file by a third and the browser must hold it all, so the HTML writer warns above
  200 MB of media and refuses above 500 MB ("use ZIP for larger exports"). Writers declare their limits;
  collect() takes them as options (ZIP keeps 500 MB / 1.5 GB).
- **Progress.** The writer reports progress per media byte encoded; the UI label becomes "Creating HTML… N%"
  (each writer declares a short `fileType`).
- **Firefox.** Bytes are copied with `structuredClone` before encoding, the same fix the ZIP writer needs for
  page-compartment buffers. The headless Firefox smoke check runs the HTML writer too.
- **Dates and times** use the browser's locale (`toLocaleDateString` / `toLocaleTimeString`), passed in so tests
  are deterministic.
- **Escaping.** Every piece of message text, name and filename is HTML-escaped before formatting is applied;
  links are only `http(s)` and open with `rel="noopener noreferrer"`. The page has a CSP meta that blocks all
  network access (`default-src 'none'`), allowing only its own inline script and style and `blob:` media.
- **Pure renderer.** `renderChatHtml(bundle, opts)` returns the page as an array of string parts, with
  `{ media: path }` placeholders where encoded bytes go; the writer fills them. Tests parse the parts with jsdom.

## Profile pictures (added 2026-10-24)

- HTML only (the ZIP is unchanged): the chat's picture in the header; in groups, each sender's picture beside the
  first bubble of their run, as WhatsApp Web does. No picture → the initial on the sender's color.
- Writers opt in with `wantsAvatars`; collect() then calls `GET_AVATARS` with the chat jid and the other senders'
  jids. The page side asks WA-JS (`contact.getProfilePictureUrl(jid, false)`, the small ~5 KB picture), fetches it
  only if the URL is `https://*.whatsapp.net`, and only keeps `image/*` up to 1 MB.
- Pictures are decoration: a missing or failed one is not an export problem.
- Each picture is embedded once and decoded once, however many bubbles show it.

## Files

- `src/export/wa-html.ts` — WhatsApp formatting → safe HTML.
- `src/export/render-chat-html.ts` — the page (markup, CSS, inline script).
- `src/export/writers/html.ts` — encodes media, assembles the Blob, registers as `html`.
- `src/export/naming.ts` — `exportFilename(name, at, ext)`.
- `src/export/writers/index.ts`, `src/export/collect.ts`, `src/ui/controller.ts`, `src/ui/state.ts` — writer
  `fileType` and limits.
- `scripts/firefox-smoke/` — also run the HTML writer with page-world bytes.
