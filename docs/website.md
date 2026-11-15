# Website

The one-page site at <https://wa-export.joan.engineer> lives in `site/`. `scripts/site/build.mjs` copies it
to `.output/site`, adds the screenshot, the demo export and the icon from the rest of the repo, and fills in
`%SITE_URL%`. It has no dependencies.

```sh
pnpm site          # build and serve on http://localhost:4173
pnpm site:build    # build only
```

`tests/site.test.ts` checks the build: nothing loaded from other sites, no inline script or style (the CSP
forbids them), content visible without JavaScript, the coding-agent sample matching the demo chat's real
export, and `index.md` covering every section. When you change a section, change `site/index.md` with it.

## Rules

The site follows the extension's promises: no web fonts, no third-party scripts or embeds in its own code.
The one exception is Cloudflare Web Analytics (cookie-free visit counts), which Cloudflare adds at the edge;
`_headers` allows exactly its script and endpoint, and the footer says the website uses it. The add-on itself
collects nothing, and every "no analytics" line on the page is about the add-on.
Use fictional chats only (the "Bamboo team" and "Bao the Panda" ones). Don't use WhatsApp's logo, and keep
the "not affiliated" line in the footer.

## Hosting on Cloudflare (one-time setup)

The site is a Cloudflare Worker that only serves static files, deployed by **Workers Builds** on every push
to `main`. `wrangler.jsonc` names the Worker (`wa-export-site`),
points it at `.output/site` and declares the custom domain, so Cloudflare creates the DNS record and the
certificate. `site/_headers` sets the security headers.

1. On GitHub, give Cloudflare's app access to the repo: **Settings → Applications → Installed GitHub Apps →
   Cloudflare Workers and Pages → Configure → Repository access**, add `sivefunc/wa-export`. Without it the
   dashboard can still import the repo, but pushes never reach Cloudflare and nothing builds on its own.
   Then Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository** → GitHub →
   `sivefunc/wa-export`.
2. Settings:
   - Project name: `wa-export-site` (it must match `name` in `wrangler.jsonc`)
   - Production branch: `main`
   - Build command: `node scripts/site/build.mjs`
   - Deploy command: `npx wrangler@4.92.0 deploy`
   - Root directory: `/`
3. **Advanced settings → Build variables:** `SKIP_DEPENDENCY_INSTALL` = `1`. The build needs only Node,
   not the extension's dependencies. Node comes from `.nvmrc`.
4. **Save and Deploy.** The first deploy attaches `wa-export.joan.engineer`; it can take a few minutes to
   get its certificate.
5. **Settings → Build → Build watch paths** is `*`: every push to `main` rebuilds the site, which takes well
   under a minute. A merge that builds nothing at all, not even a skipped build, means the GitHub app has lost
   access to the repo (step 1).

`cf builds list --external-script-id <worker id>` shows the build history, and
`cf builds create <trigger uuid> --body '{"branch":"main"}'` starts a build of `main` by hand.

Don't run `wrangler deploy` by hand; push to `main`. Check a deploy with
`npx wrangler@4.92.0 deploy --dry-run` after `pnpm site:build`.

The address is set once, in `SITE_URL` in `scripts/site/build.mjs`, and as the route in `wrangler.jsonc`;
a test fails if they differ.
