#!/bin/sh
set -eu

if [ ! -d "dist" ]; then
  echo "Error: dist/ not found. Run 'npm run build' first." >&2
  exit 1
fi

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

# Install production dependencies only
cd "$STAGING"
npm ci --omit=dev --ignore-scripts
cd ..

# Pack (mcpb names output after the directory, so rename it)
OUTFILE="mountaineers-mcp-${VERSION}.mcpb"
npx @anthropic-ai/mcpb pack "$STAGING"
mv "${STAGING}.mcpb" "$OUTFILE"

rm -rf "$STAGING"
echo "Built ${OUTFILE}"
