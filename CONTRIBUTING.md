# Contributing

Thanks for helping. Most contributions are one of two things: fixing the extension after a WhatsApp Web update, or adding an export format or ordering. This guide covers both.

## Setup

Requirements:
- Node 22.12+ (`.nvmrc`)
- pnpm via Corepack (`corepack enable`)
- Chrome/Chromium 111+ and/or Firefox 128+

```sh
pnpm install
pnpm build          # Chrome + Firefox builds in .output/
pnpm zip            # store packages + the Firefox sources zip
pnpm test           # unit tests; the manifest/package tests read the build output, so build + zip first
pnpm typecheck
pnpm test:firefox   # headless Firefox checks that unit tests can't do (needs Firefox installed)
pnpm dev            # Chromium with hot reload; pnpm dev:firefox for Firefox
```

CI runs the same commands on Node 22, 24 and 26, plus `test:firefox`.

## How it's built

```
entrypoints/wa-main.content.ts    MAIN world: WA-JS + read-only RPC server
entrypoints/wa-export.content.ts  ISOLATED world: selection tracker, UI, export pipeline
src/page/      ← WhatsApp internals (through WA-JS). Volatile.
src/dom/       ← WhatsApp page markup (all selectors in selectors.ts). Volatile.
src/bridge/    postMessage RPC between the two worlds
src/export/    collect → order → write; Markdown/JSON/HTML renderers; writers
src/ui/        Export button, states, controller
```

Everything outside `src/page/` and `src/dom/` is plain code and shouldn't need changes when WhatsApp updates.

## When WhatsApp breaks it

1. Reproduce it on **your own test chat**, ideally "Message yourself" or a test group.
2. Find which side broke:
   - **The Export button doesn't appear, or ticks aren't counted:** the markup changed. Fix `src/dom/selectors.ts` and update the "Live markup facts" comment at its top with the date and WhatsApp version.
   - **"Can't read WhatsApp's messages":** WA-JS no longer matches WhatsApp. Check for a newer WA-JS release (see "Updating WA-JS" in the README) or fix `src/page/`.
3. Add a test that reproduces the new markup or model shape: jsdom fixtures in `tests/selection-tracker.test.ts`, raw models in `tests/fixtures/raw-messages.ts`.
4. Re-run the relevant rows of `docs/live-checklist.md` and update them.

### Live testing

`node scripts/live/launch.mjs .output/chrome-mv3-dev` opens Chromium with the dev build and a persistent profile, so you scan the QR once. `scripts/live/probe.mjs` runs a snippet in the page over CDP.

Settings are environment variables:
- `WA_EXPORT_CDP_PORT` (default 9333)
- `WA_EXPORT_PROFILE_DIR` (default `.live/profile`)
- `WA_EXPORT_DOWNLOADS_DIR`

## Rules that keep users safe

These are hard requirements. A PR that breaks one won't be merged.

- **Read-only.** Never send, forward, delete, react to, or mark messages read. Never scroll or load history on the user's behalf.
- **No re-upload requests.** Expired media must stay expired. The guard in `src/page/handlers.ts` blocks WhatsApp's automatic request; don't bypass it.
- **View-once stays view-once.**
- **No network, no remote code.** Everything is bundled. Never fetch scripts, never add analytics. The only permission is `storage`.
- **Never silent.** Every per-message or per-file failure has to reach the UI summary, `chat.md` and `messages.json`.

## Privacy in the repo

The repository is public. Never commit:
- exports or real message contents
- phone numbers, WhatsApp IDs (`…@c.us`, `…@lid`), or names from real chats
- the `.live/` profile, which is a logged-in WhatsApp session
- `.env*` files

Use fictitious values in tests and docs, such as `+1 555-0100` and `123@c.us`. `.gitignore` and the sources-zip test guard the profile and secrets, but they can't catch data you paste into a file.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
- Keep one logical change per commit, with tests in the same commit as the code.
- Write the failing test first. Bugs found in a real browser get a regression test, or a `test:firefox` check if they're Firefox-specific.
- Before opening a PR, run `pnpm typecheck && pnpm build && pnpm zip && pnpm test`, plus `pnpm test:firefox` if you touched the bridge, writers or saving.

## Adding an export format or ordering

- **Formats:** implement `Writer` (`src/export/writers/index.ts`) and register it in `writers`. The settings page lists it automatically.
- **Orderings:** add an `Ordering` to `orderings` in `src/export/orderings.ts`.
- Declare `fileType` (shown as "Creating ZIP…") and `limits` (when to ask, when to refuse). `exportFilename(name, at, ext)` names the file.
- Reuse `renderChatMd` / `renderMessagesJson` / `renderChatHtml` and `problemLines`, so every format reports the same problems. Inside Firefox content scripts, copy page bytes with `structuredClone` before giving them to a library; see the comment in `writers/zip.ts`.
