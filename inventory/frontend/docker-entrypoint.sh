#!/bin/sh
set -e

# Create symlink for @tcdona/ui package so it works with volume mounts
echo "Setting up @tcdona/ui symlink..."
mkdir -p /app/node_modules/@tcdona
rm -rf /app/node_modules/@tcdona/ui 2>/dev/null || true
ln -sf /app/packages/ui /app/node_modules/@tcdona/ui
echo "Symlink created: $(ls -la /app/node_modules/@tcdona/ui 2>/dev/null || echo 'FAILED')"

# Ensure react-app-rewired is available (in case volume mount overwrote node_modules)
if [ ! -f /app/node_modules/.bin/react-app-rewired ]; then
  echo "Installing react-app-rewired..."
  npm install react-app-rewired --legacy-peer-deps --no-save || true
fi

# Verify the symlink works
if [ ! -f /app/node_modules/@tcdona/ui/src/index.jsx ]; then
  echo "WARNING: @tcdona/ui symlink may not be working correctly"
  ls -la /app/packages/ui/src/index.jsx 2>/dev/null || echo "Source file doesn't exist"
fi

# Start the application
exec "$@"

