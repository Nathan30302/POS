#!/usr/bin/env bash
# Run a named Cloudflare tunnel to the Vite HTTPS server.
# Create the tunnel once first — see PHONE-SETUP.md (do not use trycloudflare).
set -euo pipefail

TUNNEL_NAME="${NEXORA_TUNNEL_NAME:-nexora-shop}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found."
  echo "Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
  exit 1
fi

echo "Starting named tunnel: $TUNNEL_NAME → https://127.0.0.1:5173"
echo "Set SHOP_PUBLIC_ORIGIN to your tunnel hostname in .env"
exec cloudflared tunnel run "$TUNNEL_NAME"
