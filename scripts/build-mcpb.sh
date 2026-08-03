#!/bin/sh
set -eu

# Builds one .mcpb per target platform.
#
# The server depends on impit, a native module shipped as per-platform optional
# dependencies. A plain `npm ci` installs only the binding matching the *build
# host*, so a bundle built on CI's Linux runner carries Linux bindings and dies
# on every macOS and Windows install with "impit couldn't load native bindings".
# `npm ci --os/--cpu` overrides that resolution, letting a single host produce a
# correct bundle for every target.
#
# Usage: build-mcpb.sh [os-cpu ...]   (default: every supported target)

if [ ! -d "dist" ]; then
  echo "Error: dist/ not found. Run 'npm run build' first." >&2
  exit 1
fi

# Claude Desktop runs on macOS and Windows only; Linux users install from npm.
DEFAULT_TARGETS="darwin-arm64 darwin-x64 win32-x64 win32-arm64"
TARGETS=${*:-$DEFAULT_TARGETS}

VERSION=$(node -p "require('./package.json').version")
STAGING=".mcpb-build"

for TARGET in $TARGETS; do
  TARGET_OS=${TARGET%-*}
  TARGET_CPU=${TARGET##*-}

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

  # Install production dependencies for the *target* platform, not the host
  (cd "$STAGING" && npm ci --omit=dev --ignore-scripts --os="$TARGET_OS" --cpu="$TARGET_CPU")

  # Guard: a silent resolution miss here is exactly the bug this script exists to
  # prevent, so refuse to ship a bundle without a matching native binding.
  if ! ls "$STAGING"/node_modules/impit-"$TARGET_OS"-"$TARGET_CPU"* >/dev/null 2>&1; then
    echo "Error: no impit binding for ${TARGET} in the staged bundle." >&2
    echo "Installed:" >&2
    ls "$STAGING"/node_modules | grep '^impit' >&2 || echo "  (none)" >&2
    exit 1
  fi

  # Pack (mcpb names output after the directory, so rename it)
  OUTFILE="mountaineers-mcp-${VERSION}-${TARGET}.mcpb"
  npx @anthropic-ai/mcpb pack "$STAGING"
  mv "${STAGING}.mcpb" "$OUTFILE"

  rm -rf "$STAGING"
  echo "Built ${OUTFILE}"
done
