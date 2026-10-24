# WhatsApp Web Selected-Message Exporter — Design

Date: 2026-10-24
Status: approved 2026-10-24

## Why

The owner works with a team over WhatsApp and regularly needs to hand a stretch of that conversation to Claude Code: typically ~10 messages, sometimes many more, from several people (including the owner), carrying text, formatting, replies, and any kind of attachment (images, PDFs, documents, video, voice notes).

Today that means screenshots or piecemeal copy-paste, and attachments get lost. The goal is: select the messages in WhatsApp Web the same way you would to forward them, click Export, get a ZIP, drag the ZIP into Claude Code. Claude unzips it and sees the conversation as it happened.

## Goals

- Export an arbitrary set of messages the owner selected in WhatsApp Web's native "Select messages" mode (the forwarding selection) to a single ZIP.
- Preserve: sender, time, text with WhatsApp formatting, quoted replies, captions, and every attachment at the best quality WhatsApp Web can obtain, with original filenames where they exist.
- Output is optimized for a coding agent to read: one Markdown file in conversation order with attachments referenced inline.
- Works with zero configuration. Defaults: ZIP, ordered by message date.
- Never fails silently. Every problem is reported, both in the WhatsApp UI and inside the export.
- Works in Chromium (Chrome 111+) and Firefox (128+) from one codebase. **Firefox is the owner's daily browser**, so it is the primary target. Every milestone must work there, not just in Chrome.
- Publishable on the Chrome Web Store and Firefox Add-ons (AMO). The owner's goal is to publish; see "Store readiness".

## Non-goals (v1)

- Other output formats (TAR, PDF) and other orderings. The design must make them easy to add later (see "Extension points"), but v1 ships only ZIP + date order.
- Transcribing voice notes. Audio is exported as a file; transcription may become a setting later.
- Exporting whole chats, date ranges, or anything not explicitly selected.
- Actually submitting to public store listings is the last milestone, not part of the first working build. The code must be store-ready from the start, though.
- Safari. The owner decided: Chrome/Chromium and Firefox only. (Safari would need an Xcode wrapper and a paid Apple Developer account.)

## Anti-goals (failure even if it "works")

- Silently missing files, messages, or text. An export that looks complete but isn't is the worst outcome.
- Producing an empty or half-empty ZIP when the extension can't actually read messages.
- Any action that changes WhatsApp state: sending, forwarding, deleting, reacting, marking read/unread, auto-scrolling history. The extension is strictly read-only and only acts when the owner clicks Export.
- Bypassing view-once semantics.
- Any network traffic from the extension itself (no analytics, no remote code, no CDN). WhatsApp's own media downloader may fetch media it doesn't have cached; that is expected.
- Getting in the way of normal WhatsApp use.

## Owner's decisions

- Selection happens via WhatsApp's native select mode, like forwarding.
- Output is a ZIP the owner drags into Claude Code.
- Defaults minimal and workable; settings (formats such as TAR/PDF, ordering) can be added later.
- Default order: by date.
- Errors must be surfaced.
- Stack: WXT (accepted after explanation).
- Live testing: Claude drives a browser with Playwright against a real WhatsApp Web session; the owner scans the QR code. (Which number to use, real or a spare, will be confirmed before the first live session.)
- Daily browser: Firefox. Goal: publish on the stores. Browsers: Chrome/Chromium and Firefox only; no Safari.

## Claude's calls (owner was told, may still override)

- TypeScript + WXT + `@wppconnect/wa-js` pinned to exactly 4.7.2, bundled in the extension + JSZip.
- Project at `~/dev/wa-export`, its own git repo.
- Only permission requested: `storage` (for the settings page). Download via an `<a download>` Blob link, so no `downloads` permission. If that turns out not to work in Firefox's content script context, create the Blob URL from the MAIN-world script instead, or as a last resort add the `downloads` permission.
- Voice notes are exported as audio files and labeled in `chat.md` with their duration ("voice note, 0:42") so Claude knows what it can't hear.
- No message-count limit. Selected IDs are tracked continuously so messages that scroll out of view stay selected.
- Partial failure still downloads the ZIP with warnings; total failure (can't read messages) shows an error and produces no ZIP.
- The owner appears as "You" in the export.
- **No re-upload requests.** When media has expired on WhatsApp's servers, WhatsApp Web's download path may ask the sender's phone to re-upload it. That is a message reaching another person, which the read-only anti-goal rules out. The builder must check whether `WPP.chat.downloadMedia` can trigger that path. If it can, guard against it (check media state first, or call a lower-level download that doesn't re-request). Such files are reported as "expired on WhatsApp, not re-requested".
- **Export size.** Typical exports are small. v1 keeps JSZip and in-memory assembly. Before downloading media, sum the known sizes. Above 500 MB, warn and ask for confirmation; above 1.5 GB, refuse with a clear message rather than risk the tab crashing. A streaming writer (fflate) is a future upgrade behind the same writer interface.

## How it works

### Architecture

Two content scripts on `https://web.whatsapp.com/*`:

1. **MAIN world, `document_start`:** the bundled WA-JS script (exposes `window.WPP`) plus a small page bridge. WA-JS must load at `document_start` because it hooks WhatsApp's module loader as it initializes.
2. **ISOLATED world, `document_idle`:** selection tracking, the Export button and progress/result UI (in a Shadow DOM so WhatsApp's CSS can't touch it), building the export, and saving the file.

They talk over `window.postMessage` on a namespaced channel with request IDs and timeouts. The bridge offers only read operations:

- `GET_MESSAGES(ids[])`: normalized plain-object records for each ID (via `WPP.chat.getMessageById`, which accepts a list), with sender display names resolved through `WPP.contact.get` (fallbacks: name → pushname → shortName → notifyName → JID). Quoted messages get a resolved sender name too.
- `GET_MEDIA(id)`: the decrypted Blob from `WPP.chat.downloadMedia`, sent back as a transferable ArrayBuffer together with its MIME type.
- `HEALTH`: whether WA-JS is loaded and the functions the extension needs exist. Used to tell "WhatsApp changed, the extension needs an update" apart from per-message failures.

There is no generic "call any WPP function" operation.

All knowledge of WhatsApp's raw model shapes lives in one normalizer on the page side. It handles both `_serialized` and `$1` ID serialization, since WhatsApp renamed it in July 2026. Nothing downstream ever sees raw WhatsApp objects.

### Selection

- Message rows are found by `data-id` (`[data-id^="true_"]`, `[data-id^="false_"]`, `[data-testid^="conv-msg-"][data-id]`). The `data-id` string is passed to WA-JS as-is.
- While native select mode is active, a scoped MutationObserver plus a capture-phase click listener keeps a `Set` of selected IDs up to date. The checked state of each row's checkbox is read by semantics first (`aria-checked`, `input.checked`), then by icon names, then by matching a nearby checkbox on the same vertical position.
- The set clears when select mode exits or the chat changes.
- All selectors live in one file so they're easy to patch when WhatsApp's markup changes.
- This is the most fragile part of the system. The first build milestone must check it against the live WhatsApp Web before anything else is built on top. If native-mode detection proves unworkable, the fallback is the extension's own selection (alt+click toggles a message, shown with an outline). That fallback needs only `data-id`.

### Export button

- Shown only while native select mode is active. It sits next to WhatsApp's Forward button when that can be found (`data-icon`/`data-testid` heuristics, never generated class names). Otherwise it's a small floating button in our Shadow DOM.
- States: idle ("Export N"), working ("Exporting 7/12…"), done (summary), error.

### Export pipeline

The pipeline is three separate stages, so new formats and orderings plug in without touching the rest:

1. **Collect:** selected IDs → normalized message records → media Blobs. Fetch at most 3 media files at a time. Each media failure is recorded on its message instead of aborting the export.
2. **Order:** a pluggable sort function. v1 has one: by message timestamp, oldest first.
3. **Write:** a pluggable output writer that takes the ordered records + media and returns a file Blob plus a filename. v1 has one: ZIP.

The Markdown and JSON renderers are shared by every writer.

### Output: ZIP layout

```
<chat-name>-<YYYY-MM-DD-HHmm>.zip
├── chat.md
├── messages.json
└── media/
    ├── 001-photo.jpg
    ├── 002-design-spec.pdf
    └── 003-voice-note.ogg
```

- Media filenames: a 3-digit index in message order, then the sanitized original filename if the attachment has one (otherwise a type word), then an extension from the MIME type.
- Media is stored uncompressed (STORE); `chat.md` and `messages.json` are DEFLATE-compressed.

### `chat.md`

- A header with the chat name, export time, message count, and, if there were any problems, an **Export problems** section listing each one in plain words.
- One section per message: `## <Sender> — <local date/time>`. The owner shows as "You".
- Quoted reply as a blockquote: "Replying to **Name** — time" plus the quoted text.
- Text: for media messages use `caption`, never `body`. For media messages `body` is not user text: whatsapp-web.js ignores it the same way.
- WhatsApp formatting converted to Markdown: `*bold*` → `**bold**`, `~strike~` → `~~strike~~`, `_italic_` unchanged, monospace and code blocks preserved. Code spans are protected before any emphasis replacements. This is best-effort; the raw text is kept in JSON.
- Images inline as `![](media/001-photo.jpg)`; other files as links with their type and filename; voice notes as "🎤 voice note, 0:42" plus a link.
- Each missing piece is marked where it happened: `⚠️ Image missing: <plain reason>`.
- Times in the browser's local timezone.

### `messages.json`

A versioned (`schemaVersion: 1`), normalized snapshot of each message:

- id, fromMe, type, timestamp, sender {jid, name}, body/caption raw text, quoted {id, sender, timestamp, text}
- media {path, mime, filename, size, source}, or an error {code, message}

Never a raw dump of WhatsApp's model objects.

### Error reporting

Error categories, each with a plain-language message for the UI and `chat.md` and a technical code for JSON:

| Situation | Behavior |
|---|---|
| Nothing selected | Button explains instead of exporting |
| WA-JS not ready / required functions missing | Error: extension can't read WhatsApp, needs an update. No ZIP |
| Message can't be read (`msg_not_found`) | Listed as a problem; if *no* message can be read, treat as total failure |
| Media unavailable (`media_not_found`, timeout) | Listed; ZIP still produced; marked inline |
| View-once media | Skipped on purpose, listed as skipped |
| ZIP creation or save fails | Error shown with the reason |

After every export the UI shows a summary ("Exported 12 messages · 2 problems") that expands to the list. It stays until dismissed.

### Settings page

A WXT options page using `storage`. v1 shows the current (only) format and ordering, wired to the same registry the pipeline uses, so adding TAR/PDF or another ordering means registering a writer or sort function plus one option.

## Store readiness

- **Name and branding:** WhatsApp is Meta's trademark. Don't start the name with it or use its logo; use the form "<Name> for WhatsApp Web". The final name is the owner's call before submission.
- **Fixed Firefox add-on ID** in `browser_specific_settings.gecko.id` from day one, so unlisted and listed builds are the same add-on.
- **Firefox daily use before public listing:** sign the build as *unlisted* on AMO (private, free, automatic review) so it stays installed in regular Firefox across restarts. It's the same pipeline the listed release will use later. The owner needs an AMO account; API keys go in local env vars, never in the repo.
- **AMO source submission:** the bundle is built and minified, so every AMO upload includes a source ZIP plus build instructions (`wxt zip -b firefox` produces both). Builds must be reproducible from the lockfile.
- **Policy basics for both stores:**
  - a single clearly stated purpose
  - minimal permissions (`storage` plus site access to `web.whatsapp.com` only)
  - no remote code
  - a short privacy policy: all processing is local, nothing is collected or sent
- **Third-party notices** for WA-JS (Apache-2.0) and JSZip in the package.
- **Store risk:** Meta could ask a store to remove a WhatsApp-related extension. Many exist on both stores today, so it's acceptable, but it's outside our control.

## Extension points

- `writers`: id → `(records, media) => Promise<{blob, filename}>`. Future: TAR, PDF.
- `orderings`: id → compare function. Future: selection order, by sender.
- Media handling options (future): include/exclude types, transcription.

## Testing

- Unit tests (Vitest) for pure code: WhatsApp→Markdown conversion (including code protection and edge cases), filename sanitization and media naming, ordering, `chat.md` rendering with errors, JSON schema output, and the normalizer against fixture objects in both ID-serialization shapes.
- Live testing is driven by Claude through Playwright in Chromium. Playwright can't load extensions into Firefox, so Firefox checks run through `wxt dev -b firefox` / `web-ext run` with the owner watching, or through screenshots the owner takes. Selection detection must be confirmed live first, before the rest of the pipeline is built on it.
- Manual checklist against live WhatsApp Web in Chrome and Firefox, covering:
  - text with formatting
  - a quoted reply
  - an image with a caption
  - a PDF
  - a voice note
  - a video
  - the owner's own message
  - a selection spanning off-screen scrolling
  - an unavailable media item
  - the "nothing selected" case

## Risks

- **WhatsApp DOM changes** break selection or button placement. Mitigation: all selectors in one file, a floating-button fallback, and the alt+click selection fallback.
- **WhatsApp internal changes** break WA-JS. Mitigation: the health check gives a clear error; upgrade WA-JS deliberately (read the changelog/diff, never auto-update).
- **Account risk:** unofficial client modification breaks WhatsApp's terms. Read-only, user-initiated use keeps the risk low but not zero. The owner has accepted this.
- **Supply chain:** WA-JS has full access to the WhatsApp session. Mitigation: exact version pin, a lockfile, and bundling (never loaded at runtime).

## Left to the builder

- Internal module layout, naming, and UI styling (keep it small, matching WhatsApp's look loosely, readable in light and dark).
- How the WA-JS bundle is copied into the extension output.
- Bridge timeout values and the media concurrency number (3 is a suggestion).
- Exact wording of the error messages, within the plain-language rule.
