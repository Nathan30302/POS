#!/bin/sh
set -eu
# Persist SQLite + uploads on host volume at /data (Fly [[mounts]] / Railway Volume).
mkdir -p /data/uploads
if [ ! -e /app/uploads ] || [ -L /app/uploads ]; then
  rm -rf /app/uploads 2>/dev/null || true
  ln -sfn /data/uploads /app/uploads
fi

export DATABASE_URL="${DATABASE_URL:-file:/data/nexora.db}"
export SERVE_SPA="${SERVE_SPA:-1}"
export NODE_ENV="${NODE_ENV:-production}"
# Railway injects PORT; default 4000 for local/Fly. Server binds 0.0.0.0.

cd /app
npx prisma db push --skip-generate
if [ "${SEED_ON_BOOT:-1}" = "1" ]; then
  # Idempotent seed (upserts demo users)
  npx tsx server/seed.ts || true
fi

exec node --import tsx server/index.ts
