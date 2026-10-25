# WA Export for WhatsApp Web

![WA Export: an ASCII-shaded green chat bubble with an export arrow, next to the title](docs/images/banner.png)

[![CI](https://github.com/sivefunc/wa-export/actions/workflows/ci.yml/badge.svg)](https://github.com/sivefunc/wa-export/actions/workflows/ci.yml)

Select messages in WhatsApp Web the way you would to forward them, click **Export**, and get a ZIP with the conversation and every file. Made for dragging into Claude Code. Or get a single HTML page that looks like WhatsApp, to read, share or save as PDF.

Chrome/Chromium 111+ and Firefox 128+. Everything runs locally; see [PRIVACY.md](PRIVACY.md).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/whatsapp-menu-dark.png">
  <img alt="WhatsApp Web in Select messages mode, with four messages ticked, the Export 4 button next to Forward, and its settings menu open on Format: ZIP or HTML" src="docs/images/whatsapp-menu-light.png">
</picture>

<sub>A fictional chat, made for this screenshot. See [docs/demo](docs/demo/README.md).</sub>

## Use it

1. Open a chat in WhatsApp Web → ⋮ → **Select messages**.
2. Tick the messages you want. Scrolling is fine; ticks out of view are kept.
3. Click **Export N**, next to Forward in the selection toolbar. The ⚙ beside it opens a menu, styled like WhatsApp's own, to pick the format (ZIP or HTML) and the message order; it's the same setting as the extension's options page.
4. Drag the downloaded ZIP into Claude Code.

## What's in the ZIP

```
<chat>-<YYYY-MM-DD-HHmm>.zip
├── chat.md        conversation in date order: sender, time, replies, formatting as Markdown,
│                  files linked where they were sent, problems marked where they happened
├── messages.json  the same data, structured (schemaVersion 1)
└── media/         original files: photos, videos, voice notes, PDFs, documents
```

Albums export every photo. A reply to a file keeps the reply text plus a mention such as `_(Video)_`; the quoted file itself is only included if you select it too.

## HTML (WhatsApp look)

Click ⚙ next to **Export** (or open the extension's options) and set **Export format** to **HTML (WhatsApp look)**. Export then downloads one `.html` file that opens in any browser and shows the selected messages as WhatsApp Web does: bubbles, profile pictures, sender names, replies, formatting, day separators, light and dark themes. Photos and stickers are shown inline, voice notes and videos play, and documents download from their card. Everything is inside the file; it loads nothing from the network.

Profile pictures are the small ones WhatsApp shows in chat lists: the chat's in the header and, in groups, each sender's beside their messages. People without a picture, or who hide it from you, get their initial, as in WhatsApp.

**Save as PDF** in the page's header opens the print dialog; choose "Save as PDF" there.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/html-export-dark.png">
    <img width="600" alt="The HTML export of a fictional group chat: bubbles, profile pictures, a photo, a sticker, a reply, a voice note, a PDF, a video and formatted text" src="docs/images/html-export-light.png">
  </picture>
</p>

Download [docs/demo/bamboo-team.html](docs/demo/bamboo-team.html) and open it to try one.

Files are embedded as base64, so the page is about a third larger than the media. Exports over 200 MB ask first, and over 500 MB use ZIP instead.

## Install

- **Chrome:** `pnpm build`, then `chrome://extensions` → Developer mode → **Load unpacked** → `.output/chrome-mv3`.
- **Firefox (temporary, until restart):** `pnpm build`, then `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → `.output/firefox-mv3/manifest.json`.
- **Firefox (permanent):** `pnpm sign:firefox` signs the build privately on AMO's unlisted channel. It needs AMO API keys in `.env.local`, as described in the script. Drag the resulting `.xpi` from `web-ext-artifacts/` onto Firefox.

## Known limitations

- **Expired files** (older media WhatsApp's servers no longer have) are reported as "expired on WhatsApp, not re-requested". The extension blocks WhatsApp's automatic re-upload request, because that would ask the sender's phone to upload the file again.
- **View-once media** is skipped on purpose.
- **Voice notes** are exported as audio but not transcribed.
- **WhatsApp updates can break it.** Everything WhatsApp-specific lives in two places:
  - `src/dom/selectors.ts`: page markup
  - `src/page/`: WhatsApp internals through WA-JS

  `docs/live-checklist.md` records what was verified and on which WhatsApp version.
- Using an unofficial extension with WhatsApp is against its terms of service. This one only reads, and only when you click Export, but the risk isn't zero.

## Develop

```sh
pnpm install
pnpm build && pnpm zip && pnpm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the architecture, live testing against WhatsApp Web, the Firefox checks, and the rules every change must keep.

### Updating WA-JS

WA-JS runs inside your WhatsApp session with full access, so treat upgrades as a review:

1. Read the release notes at https://github.com/wppconnect-team/wa-js/releases.
2. Diff the old and new `dist/wppconnect-wa.js`.
3. Bump the **exact** version in `package.json` (no `^`), run `pnpm install`, then run the live checklist.

### Store submission

The manifest name is a placeholder: WhatsApp is Meta's trademark, so the public name must not start with "WhatsApp" and must not use its logo. Pick the final name before submitting. Firefox submissions need the sources ZIP that `pnpm zip` creates.

## License

[MIT](LICENSE). Bundled third-party code keeps its own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
