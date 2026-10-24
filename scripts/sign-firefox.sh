#!/usr/bin/env bash
# Sign the Firefox build on AMO's *unlisted* channel (private, not published) so it
# stays installed in regular Firefox. Keys: https://addons.mozilla.org/developers/addon/api/key/
# Put them in .env.local (gitignored):
#   AMO_JWT_ISSUER=user:12345:678
#   AMO_JWT_SECRET=...
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env.local ]]; then set -a; source .env.local; set +a; fi
if [[ -z "${AMO_JWT_ISSUER:-}" || -z "${AMO_JWT_SECRET:-}" ]]; then
  echo "Missing AMO_JWT_ISSUER / AMO_JWT_SECRET. Create an AMO API key and put both in .env.local." >&2
  exit 1
fi

pnpm wxt build -b firefox
pnpm wxt zip -b firefox
sources=$(ls -t .output/*-sources.zip | head -1)

pnpm exec web-ext sign \
  --channel unlisted \
  --source-dir .output/firefox-mv3 \
  --artifacts-dir web-ext-artifacts \
  --upload-source-code "$sources" \
  --api-key "$AMO_JWT_ISSUER" \
  --api-secret "$AMO_JWT_SECRET"

echo "Signed .xpi in web-ext-artifacts/. Install it by dragging it onto a Firefox window."
