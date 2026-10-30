#!/usr/bin/env bash
# PREVIEW ONLY. Packs HEAD for the Vercel MCP preview upload (never production, never a push, no project settings).
# Writes /tmp/dep/*.b64 plus /tmp/dep/manifest.txt (path, sha1, size). Then upload each with the Vercel MCP
# upload_file (team adamtpangs-projects) and call create_deployment with NO target (= preview) for project
# prj_oqzMKMJM31miclOjFxODEL6tv8le, files frontend/.deploy/src.tgz.b64, frontend/.deploy/unpack.mjs,
# frontend/package.json, frontend/package-lock.json; then patch_url_protection_bypass for the share link.
set -euo pipefail
cd "$(dirname "$0")/.."
D=/tmp/dep; mkdir -p $D/.deploy
[ -f $D/package.json ] && [ -f $D/.deploy/unpack.mjs ] || { echo "need $D/package.json and $D/.deploy/unpack.mjs from the first preview"; exit 1; }
git archive --format=tar HEAD -- . ':!package.json' ':!package-lock.json' | gzip -9 > $D/src.tgz
base64 -w0 $D/src.tgz > $D/.deploy/src.tgz.b64
cp package-lock.json $D/
: > $D/manifest.txt
for f in .deploy/src.tgz.b64 .deploy/unpack.mjs package.json package-lock.json; do
  echo "frontend/$f $(sha1sum $D/$f | cut -d' ' -f1) $(stat -c%s $D/$f)" >> $D/manifest.txt
  base64 -w0 $D/$f > "$D/$(echo $f | tr / _).b64"
done
echo "preview payload for $(git rev-parse --short HEAD) ready:"; cat $D/manifest.txt
