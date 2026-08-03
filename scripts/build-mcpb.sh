#!/bin/sh
set -eu

# Builds a single .mcpb that runs on every supported platform.
#
# The server depends on impit, a native module shipped as per-platform optional
# dependencies. A plain `npm ci` installs only the binding matching the *build
# host*, so a bundle built on CI's Linux runner carried Linux bindings and died
# on every macOS and Windows install with "impit couldn't load native bindings".
#
# `npm ci --os/--cpu` resolves another platform's optional dependencies from a
# single host, so we stage each target in turn and collect every binding into
# one bundle. impit dispatches on process.platform/process.arch at require time,
# so the extra bindings sit unused rather than conflicting — one download that
# is correct everywhere, at the cost of roughly 11 MB extra.

if [ ! -d "dist" ]; then
  echo "Error: dist/ not found. Run 'npm run build' first." >&2
  exit 1
fi

# Claude Desktop runs on macOS and Windows only; Linux users install from npm.
TARGETS="darwin-arm64 darwin-x64 win32-x64 win32-arm64"

VERSION=$(node -p "require('./package.json').version")
STAGING=".mcpb-build"

rm -rf "$STAGING"
mkdir -p "$STAGING"

# Copy manifest with correct version
VERSION="$VERSION" STAGING="$STAGING" node -e "
  const m = JSON.parse(require('fs').readFileSync('manifest.json', 'utf8'));
  m.version = process.env.VERSION;
  require('fs').writeFileSync(process.env.STAGING + '/manifest.json', JSON.stringify(m, null, 2) + '\n');
"

# Copy compiled server
cp -r dist "$STAGING/dist"

# Copy package files for node_modules resolution
cp package.json package-lock.json "$STAGING/"

# Install production dependencies once, then graft in every other platform's
# native binding. The first target also populates the shared (portable) deps.
FIRST=1
for TARGET in $TARGETS; do
  TARGET_OS=${TARGET%-*}
  TARGET_CPU=${TARGET##*-}

  if [ "$FIRST" = 1 ]; then
    (cd "$STAGING" && npm ci --omit=dev --ignore-scripts --os="$TARGET_OS" --cpu="$TARGET_CPU")
    FIRST=0
  else
    SIDE=$(mktemp -d)
    cp package.json package-lock.json "$SIDE/"
    (cd "$SIDE" && npm ci --omit=dev --ignore-scripts --os="$TARGET_OS" --cpu="$TARGET_CPU")
    cp -R "$SIDE"/node_modules/impit-"$TARGET_OS"-"$TARGET_CPU"* "$STAGING/node_modules/"
    rm -rf "$SIDE"
  fi

  # Guard: a silent resolution miss here is exactly the bug this script exists
  # to prevent, so refuse to ship a bundle missing any platform's binding.
  if ! ls "$STAGING"/node_modules/impit-"$TARGET_OS"-"$TARGET_CPU"* >/dev/null 2>&1; then
    echo "Error: no impit binding for ${TARGET} in the staged bundle." >&2
    echo "Installed:" >&2
    ls "$STAGING"/node_modules | grep '^impit' >&2 || echo "  (none)" >&2
    exit 1
  fi
done

# Pack (mcpb names output after the directory, so rename it)
OUTFILE="mountaineers-mcp-${VERSION}.mcpb"
npx @anthropic-ai/mcpb pack "$STAGING"
mv "${STAGING}.mcpb" "$OUTFILE"

rm -rf "$STAGING"
echo "Built ${OUTFILE} for: ${TARGETS}"
