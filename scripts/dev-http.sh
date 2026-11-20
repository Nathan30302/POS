#!/usr/bin/env bash
# Plain HTTP localhost — no certificate warnings.
set -euo pipefail
cd "$(dirname "$0")/.."
export WEB_PROTOCOL=http
# Clear any stuck HTTPS listeners
lsof -ti:4000,5173 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1
echo "Starting NEXORA on http://localhost:5173 …"
exec npm run dev
