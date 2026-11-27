#!/usr/bin/env bash
# NEXORA SQLite backup — copy while stopping writes briefly is ideal;
# for demo/LAN shops this hot-copy is usually enough.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${DATABASE_URL:-file:$ROOT/prisma/dev.db}"
# strip file: prefix
SRC_PATH="${SRC#file:}"
SRC_PATH="${SRC_PATH#file:}"
if [[ "$SRC_PATH" != /* ]]; then
  SRC_PATH="$ROOT/${SRC_PATH#./}"
fi
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST_DIR="${NEXORA_BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$DEST_DIR"
DEST="$DEST_DIR/nexora-$STAMP.db"
if [[ ! -f "$SRC_PATH" ]]; then
  echo "Database not found: $SRC_PATH" >&2
  exit 1
fi
cp "$SRC_PATH" "$DEST"
# Keep last 14 backups
ls -1t "$DEST_DIR"/nexora-*.db 2>/dev/null | tail -n +15 | xargs -r rm -f 2>/dev/null || true
echo "Backup written: $DEST"
ls -lh "$DEST"
