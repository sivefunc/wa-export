# WA Export for WhatsApp Web

Select messages in WhatsApp Web the way you would to forward them, click **Export**, and get a ZIP with the conversation and every file. Made for dragging into Claude Code.

Chrome/Chromium 111+ and Firefox 128+. Everything runs locally; see [PRIVACY.md](PRIVACY.md).

## Use it

1. Open a chat in WhatsApp Web → ⋮ → **Select messages**.
2. Tick the messages you want. Scrolling is fine; ticks out of view are kept.
3. Click **Export N**, next to Forward in the selection toolbar.
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
pnpm build && pnpm zip && pnpm test   # manifest and package tests read the build output
pnpm typecheck
pnpm dev            # Chromium with hot reload
pnpm dev:firefox
```

Live testing against a real WhatsApp session: `node scripts/live/launch.mjs .output/chrome-mv3-dev` opens Chromium with the extension and a persistent profile in `.live/` (gitignored, never uploaded). `scripts/live/probe.mjs` runs snippets in that page over CDP.

### Updating WA-JS

WA-JS runs inside your WhatsApp session with full access, so treat upgrades as a review:

1. Read the release notes at https://github.com/wppconnect-team/wa-js/releases.
2. Diff the old and new `dist/wppconnect-wa.js`.
3. Bump the **exact** version in `package.json` (no `^`), run `pnpm install`, then run the live checklist.

### Store submission

The manifest name is a placeholder: WhatsApp is Meta's trademark, so the public name must not start with "WhatsApp" and must not use its logo. Pick the final name before submitting. Firefox submissions need the sources ZIP that `pnpm zip` creates.
