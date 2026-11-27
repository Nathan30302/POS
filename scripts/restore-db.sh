#!/usr/bin/env bash
# Restore SQLite backup created by backup-db.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-}"
if [[ -z "$SRC" || ! -f "$SRC" ]]; then
  echo "Usage: $0 backups/nexora-YYYYMMDD-HHMMSS.db" >&2
  exit 1
fi
DEST_URL="${DATABASE_URL:-file:$ROOT/prisma/dev.db}"
DEST_PATH="${DEST_URL#file:}"
DEST_PATH="${DEST_PATH#file:}"
if [[ "$DEST_PATH" != /* ]]; then
  DEST_PATH="$ROOT/${DEST_PATH#./}"
fi
mkdir -p "$(dirname "$DEST_PATH")"
cp "$SRC" "$DEST_PATH"
echo "Restored $SRC → $DEST_PATH"
echo "Restart the API process."
