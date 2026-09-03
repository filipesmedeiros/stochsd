#!/bin/bash
# Deploys the built editor to ssd.systemika.org.
#
# Same target and layout as the pre-Vite deploy script (the site root is the
# editor itself) — the only change is that it uploads the built output instead
# of the raw source tree.
set -eu

REMOTE="uberspace_filipe1:~/www/ssd.systemika.org"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -e "import('$ROOT/vite.config.mjs').then(m => console.log(m.stochsdVersion()))")"
BUILD="$ROOT/distribute/output/web/$VERSION/OpenSystemDynamics/src"

if ! test -d "$BUILD"; then
	echo "No build at $BUILD — run 'npm run build:web' first." >&2
	exit 1
fi

echo "Deploying StochSD $VERSION from $BUILD"
rsync -a "$BUILD"/* "$REMOTE"
