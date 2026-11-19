#!/usr/bin/env bash
# MoneyTrack installer for macOS and Linux (including Raspberry Pi).
#
#   ./scripts/install.sh            # install dependencies, create DB, build
#   ./scripts/install.sh --seed     # also load the demo user + 90 days of data
#   ./scripts/install.sh --no-build # skip the production bundle
set -euo pipefail

cd "$(dirname "$0")/.."

SEED=0
BUILD=1
for arg in "$@"; do
  case "$arg" in
    --seed) SEED=1 ;;
    --no-build) BUILD=0 ;;
    -h|--help)
      sed -n '2,8p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

say() { printf '\033[1;32m›\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31m✗\033[0m %s\n' "$1" >&2; exit 1; }

command -v node >/dev/null 2>&1 || fail "Node.js is not installed. Install Node 20+ from https://nodejs.org"
command -v npm  >/dev/null 2>&1 || fail "npm is not available next to node."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node 20+ is required (found $(node -v))."
fi
say "Node $(node -v) detected"

say "Installing npm dependencies (this can take a few minutes on a Pi)…"
npm install --no-audit --no-fund

say "Creating / syncing the SQLite database…"
npm run db:push

if [ "$SEED" -eq 1 ]; then
  say "Loading demo user and 90 days of transactions…"
  npm run db:seed
else
  warn "Skipped demo data. Run 'npm run db:seed' for demo/demo123."
fi

if [ "$BUILD" -eq 1 ]; then
  say "Building the production bundle…"
  npm run build
fi

chmod +x scripts/moneytrack.sh 2>/dev/null || true

cat <<'EOF'

✔ Installation complete.

Start the app:
  ./scripts/moneytrack.sh start
  ./scripts/moneytrack.sh status
  ./scripts/moneytrack.sh stop

Then open http://localhost:4000

The first account you create becomes the administrator.
Demo credentials (if seeded): demo / demo123
EOF
