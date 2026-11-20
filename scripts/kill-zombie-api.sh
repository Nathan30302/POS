#!/usr/bin/env bash
# Run this in Terminal.app (not the agent sandbox) to free stuck ports.
set -euo pipefail
echo "Killing anything on 4000 / 4001 / 5173…"
lsof -ti:4000,4001,5173 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1
lsof -nP -iTCP:4000 -sTCP:LISTEN 2>/dev/null || echo "4000 free"
lsof -nP -iTCP:5173 -sTCP:LISTEN 2>/dev/null || echo "5173 free"
