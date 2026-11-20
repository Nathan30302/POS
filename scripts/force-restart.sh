#!/usr/bin/env bash
# Kill stuck API/Vite and bring NEXORA back on plain HTTP.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "Stopping listeners on 4000 / 5173…"
lsof -ti:4000,5173 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1
export WEB_PROTOCOL=http
export TMPDIR="${TMPDIR:-$PWD/.tmp}"
mkdir -p "$TMPDIR"
echo "Pushing Prisma schema…"
npx prisma generate
npx prisma db push
echo "Starting http://localhost:5173 …"
exec npm run dev
