# Website design

A one-page site for WA Export, for people deciding whether to install it and for LLMs/coding agents
reading about it. Approved from the browser mockup (v2) on 2026-11-14.

## Intent

The add-on is public on Firefox Add-ons (AMO) and not yet on the Chrome Web Store. The page gets people to
**Add to Firefox**, with **GitHub** as the second path. It's "just an add-on", so the page stays minimal: the
product in the centre, a short scroll, nothing to sign up for.

- **Goals:** show the Export button working in WhatsApp Web; show what the files look like; say plainly that
  it's read-only and local; read well for an LLM (`llms.txt`, a Markdown copy, semantic HTML that works
  without JavaScript).
- **Non-goals:** docs site, blog, multiple languages, store-style reviews.
- **Anti-goals:** anything that contradicts the extension's promises — no analytics, no third-party fonts,
  scripts or embeds; nothing that looks like WhatsApp's or Meta's own branding (no WhatsApp logo, a
  "not affiliated" line in the footer).

## Approaches

1. **Hand-written static page in `site/`** (picked). One HTML file, one CSS file, one small script. A
   dependency-free Node script copies it plus the existing screenshots and demo export into
   `.output/site`. Nothing new to install or keep updated.
2. A static site generator (Astro etc.): easy to grow, but pinned dependencies and a build for one page.
3. A separate repo or `gh-pages` branch: wording and images drift from the README.

## The page

Dark, grid background, system fonts, the icon's green (`#1DAA61`) as the accent. Top to bottom:

1. **Nav:** icon + "WA Export"; How it works, Formats, For agents, Privacy; GitHub ↗.
2. **Hero:** "Save WhatsApp Web chats as files." The lede names ZIP for agents and HTML/PDF/image for people.
   Primary **Add to Firefox** (AMO listing), **Read the source on GitHub ↗**, then
   "Firefox 140+ · Firefox for Android 142+ · Chrome soon". Six file icons float around it (`chat.md`,
   `messages.json`, `chat.pdf`, a ZIP, `chat.png`, `chat.html`) with format-coloured labels.
3. **Product:** the fictional WhatsApp Web screenshot in a browser frame that flattens as you scroll to it.
   A cursor clicks the real Export button, files fly out, and a "saved" notice appears, on a 7 s loop.
4. **How it works:** Select, Export, Keep it.
5. **Formats:** the real `bamboo-team.html` demo export, live and scrollable in a sandboxed frame, next to
   the four formats.
6. **For coding agents:** the ZIP tree and the start of `chat.md`, taken from the demo chat's real export.
7. **Privacy:** read-only, local, view-once skipped, open source.
8. **Final call to action** and a footer (not affiliated with WhatsApp or Meta; privacy; llms.txt; MIT).

Motion: blur-in headline, pop-in and bobbing files that drift from the pointer, scroll reveals, a line-by-line
ZIP tree, the format list cycling. All of it stops under `prefers-reduced-motion`, and content is visible when
JavaScript is off (hidden states only apply under a `.js` class the script adds).

## Calls made while building

- **Hosting:** a static-assets Cloudflare Worker (`wrangler.jsonc`) deployed by Workers Builds on each push
  to `main`, at `https://wa-export.joan.engineer`. Build command
  `node scripts/site/build.mjs`, output `.output/site`, no dependency install. Setup in `docs/website.md`.
- **Security headers** in `site/_headers`: a strict CSP for the page (`'self'` only, no inline script or
  style), a looser one only for the demo export, which needs its own inline script.
- **Tests** (`tests/site.test.ts`): the build output, no remote loads, no inline script/style, alt text,
  the agents sample matches the real demo export, `index.md` covers every section, one canonical URL.
- `site/` is left out of the Firefox sources ZIP; AMO doesn't need it.

## Left for later

- The WhatsApp screenshot's Format menu predates PDF and image; re-capturing it needs a live session.
- The README banner says "ZIP or HTML"; regenerate with `pnpm demo:banner` after editing its text.
- A light theme, an Open Graph image made for sharing, the Chrome Web Store link once it's listed.
