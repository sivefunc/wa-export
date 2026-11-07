# Releasing

`.github/workflows/release.yml` publishes to Firefox Add-ons (AMO) and, once it's set up, the Chrome Web
Store. Pushing a `v*` tag does four things:

1. Runs every CI check (`ci.yml`): typecheck, build, unit tests on Node 22/24/26, Firefox and Chromium.
2. Checks that the tag matches `version` in `package.json`.
3. Uploads the Firefox zip and the Firefox sources zip with `wxt submit`, plus the Chrome zip if the
   `CHROME_EXTENSION_ID` variable is set, and sends them for review.
4. Creates a GitHub Release with the same three zips attached.

## Release a version

```sh
pnpm version patch -m "chore: release v%s"   # or minor / major: bumps package.json, commits, tags vX.Y.Z
git push --follow-tags
```

Then approve the run in the `stores` environment (Actions → the run → Review deployments). Store
review takes from hours to a few days; the stores email you the result.

## One-time setup

You can start with Firefox only and skip every Chrome step below. Until `CHROME_EXTENSION_ID` is set,
releases skip the Chrome Web Store with a notice; the Chrome zip is still attached to each GitHub
Release. To add Chrome later, do its steps and set that variable.

### 1. Submit the first version by hand

Neither store lets you create a new listing through the API, so the first version is uploaded manually.
Run `pnpm build && pnpm zip`, then:

- **Chrome:** in the [developer dashboard](https://chrome.google.com/webstore/devconsole) (US$5
  one-time registration), add an item, upload `.output/wa-export-<version>-chrome.zip`, and fill in the
  listing and Privacy tabs. Copy the 32-letter item ID.
- **Firefox:** at [AMO](https://addons.mozilla.org/developers/), submit a new add-on on the **listed**
  channel. Upload `.output/wa-export-<version>-firefox.zip`, then the sources zip when asked, with the
  notes from [amo-reviewer-notes.md](amo-reviewer-notes.md) in **Notes to Reviewer**. For screenshots,
  use the fictional ones in `docs/images/` (`whatsapp-menu-*.png`, `html-export-*.png`). The add-on ID is the
  gecko `id` in `wxt.config.ts`.

### 2. Get API keys

- **Chrome:** run `pnpm exec wxt submit init` and pick Chrome. It walks through creating a Google
  Cloud OAuth client and gets the refresh token. You end up with a client ID, a client secret and a
  refresh token.
- **Firefox:** create a key at https://addons.mozilla.org/developers/addon/api/key/. The JWT issuer
  looks like `user:12345:678`. The same key works for `pnpm sign:firefox`.

### 3. Store them on GitHub

Settings → Environments → **New environment** `stores`:

- **Required reviewers:** add yourself, so a pushed tag waits for your approval before uploading.
- **Deployment branches and tags:** "Selected branches and tags", rule `v*` (tags only).
- **Environment variables** (IDs are not secret): `CHROME_EXTENSION_ID`, `FIREFOX_EXTENSION_ID`.
- **Environment secrets:** `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`,
  `FIREFOX_JWT_ISSUER`, `FIREFOX_JWT_SECRET`.

### 4. Check the keys

Actions → **Release** → **Run workflow** on `main`. A manual run is always a dry run: it builds and
checks that the keys work, but uploads nothing and creates no release. Add `main` to the environment's
deployment rule while you test this, or the run can't read the keys.

## If something fails

- **Tag doesn't match package.json:** delete the tag (`git push --delete origin vX.Y.Z`,
  `git tag -d vX.Y.Z`), fix the version, and tag again.
- **A store rejects the upload:** the other store may already have the new version, and no GitHub
  Release is created. Fix the problem and release a new patch version, because both stores refuse
  the same version twice.
- **Chrome refresh token expired:** an OAuth app left in "Testing" mode gets tokens that expire after
  7 days. Set the OAuth consent screen to "In production", then run `pnpm exec wxt submit init`
  again.
