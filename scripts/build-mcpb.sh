#!/bin/sh
set -eu

VERSION=$(node -p "require('./package.json').version")
STAGING=".mcpb-build"

rm -rf "$STAGING"
mkdir -p "$STAGING"

# Copy manifest with correct version
node -e "
  const m = JSON.parse(require('fs').readFileSync('manifest.json', 'utf8'));
  m.version = '$VERSION';
  require('fs').writeFileSync('$STAGING/manifest.json', JSON.stringify(m, null, 2) + '\n');
"

# Copy compiled server
cp -r dist "$STAGING/dist"

# Copy package files for node_modules resolution
cp package.json package-lock.json "$STAGING/"

# Install production dependencies only
cd "$STAGING"
npm ci --omit=dev --ignore-scripts
cd ..

# Pack
npx @anthropic-ai/mcpb pack "$STAGING"

rm -rf "$STAGING"
echo "Built mountaineers-mcp-${VERSION}.mcpb"
