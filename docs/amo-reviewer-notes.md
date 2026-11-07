# Notes for Firefox Add-ons reviewers

Paste the section below into **Notes to Reviewer** when submitting a version on AMO. Update the
version numbers when WA-JS or fflate change.

---

**What it does.** In WhatsApp Web's own "Select messages" mode, the add-on adds an Export button. It
reads only the selected messages and their files and saves them as one file: a ZIP, an HTML page, a
PDF or an image. Everything runs locally. It has no background script and no analytics, and its only
permission is `storage` (export settings). Selected media that WhatsApp Web hasn't cached yet is
downloaded by WhatsApp Web's own code (through WA-JS), as when you open it. The add-on's only request
of its own: for the HTML, PDF, PNG and JPEG
formats (not ZIP), the page-world code fetches the small profile pictures of the chat and of the
selected messages' senders, the ones WhatsApp Web shows in its chat list. `src/page/handlers.ts`
(`GET_AVATARS`) only fetches `https://` URLs on `whatsapp.net` or its subdomains, without cookies or
referrer, with a 10-second timeout and a 1 MB limit per picture. Source:
https://github.com/sivefunc/wa-export

**Build from the attached sources** (Node 22.12+, pnpm 10.29.2 through `corepack enable`):

    pnpm install --frozen-lockfile
    pnpm exec wxt build -b firefox

The output is `.output/firefox-mv3/`, which matches the uploaded package.

**Third-party code**, unmodified:

- `vendor/wppconnect-wa.js` is `dist/wppconnect-wa.js` from npm `@wppconnect/wa-js` 4.7.2
  (Apache-2.0, https://github.com/wppconnect-team/wa-js), copied by `wxt.config.ts`. It runs in the
  page (MAIN world) because it reads WhatsApp Web's internal message store, which is the only way to
  get the selected messages and their media without scraping or re-downloading them. Our page-world
  code (`src/page/`) answers read-only requests from the content script and blocks WhatsApp's request
  to re-upload expired media.
- `fflate` 0.8.3 (MIT) builds the ZIP files.

**Validator warnings:**

- *eval can be harmful* in `vendor/wppconnect-wa.js`: WA-JS's file-type detection includes a helper
  for Node.js streams that calls `eval("require")("stream")`. It only runs when given a Node stream,
  which never happens in a browser. The file is unmodified, so we can't remove it.
- *Unsafe assignment to innerHTML* (2) in `content-scripts/wa-export.js`, from
  `src/export/raster/dom.ts`. The PNG/PDF export lays the chat out from the same renderer as the
  HTML export (`src/export/render-chat-html.ts`), which escapes all message text
  (`src/export/wa-html.ts`, tested in `tests/wa-html.test.ts`) and emits no scripts or event
  handlers. The first assignment fills a closed, offscreen shadow root so the layout can be measured.
  WhatsApp's CSP has no `'unsafe-inline'` in `script-src`. The second fills a detached
  `document.implementation.createHTMLDocument()` document, which runs nothing and loads nothing,
  before serializing it into an SVG `<foreignObject>`. The Export button and settings page build
  their DOM without parsing HTML.

**Testing.** WhatsApp Web needs a WhatsApp account on a phone, so we can't provide test credentials.
With any account: open https://web.whatsapp.com, open a chat, choose ⋮ → Select messages, tick a few
messages, and click Export next to Forward. The ⚙ button next to it picks the format. Without an
account, `pnpm test:firefox` runs the writers inside a Firefox content script on a fictional demo chat.
