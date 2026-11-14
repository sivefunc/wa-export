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

The site follows the extension's promises: no analytics, no web fonts, no third-party scripts or embeds.
Use fictional chats only (the "Bamboo team" and "Bao the Panda" ones). Don't use WhatsApp's logo, and keep
the "not affiliated" line in the footer.

## Hosting on Cloudflare (one-time setup)

The site is a Cloudflare Worker that only serves static files, deployed by **Workers Builds** on every push
to `main`. `wrangler.jsonc` names the Worker (`wa-export-site`),
points it at `.output/site` and declares the custom domain, so Cloudflare creates the DNS record and the
certificate. `site/_headers` sets the security headers.

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository** → GitHub →
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
5. Optional: **Settings → Build → Build watch paths**, include `site/*`, `scripts/site/*`, `docs/images/*`,
   `docs/demo/*`, `assets/*` and `wrangler.jsonc`, so extension-only commits don't redeploy the site.

Don't run `wrangler deploy` by hand; push to `main`. Keep Web Analytics off. Check a deploy with
`npx wrangler@4.92.0 deploy --dry-run` after `pnpm site:build`.

The address is set once, in `SITE_URL` in `scripts/site/build.mjs`, and as the route in `wrangler.jsonc`;
a test fails if they differ.
