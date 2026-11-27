#!/usr/bin/env bash
# Backup Postgres NEXORA database (pg_dump).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="${DATABASE_URL:-}"
if [[ -z "$URL" || "$URL" != postgresql* ]]; then
  echo "Set DATABASE_URL to a postgresql://… connection string" >&2
  exit 1
fi
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST_DIR="${NEXORA_BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$DEST_DIR"
DEST="$DEST_DIR/nexora-pg-$STAMP.dump"
pg_dump --format=custom --file="$DEST" "$URL"
echo "Postgres backup: $DEST"
ls -lh "$DEST"
