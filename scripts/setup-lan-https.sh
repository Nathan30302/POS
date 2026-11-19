#!/usr/bin/env bash
# Generate trusted local HTTPS certs for phone Sell on shop Wi‑Fi.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="$ROOT/certs"
mkdir -p "$CERT_DIR"

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert is not installed."
  echo "  macOS: brew install mkcert && mkcert -install"
  echo "  Docs:  https://github.com/FiloSottile/mkcert"
  exit 1
fi

IPS=()
if command -v ipconfig >/dev/null 2>&1; then
  for iface in en0 en1 en2; do
    ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
    [[ -n "${ip:-}" ]] && IPS+=("$ip")
  done
fi
if command -v hostname >/dev/null 2>&1; then
  while read -r ip; do
    [[ -n "$ip" ]] && IPS+=("$ip")
  done < <(hostname -I 2>/dev/null || true)
fi

# unique
UNIQ_IPS=()
for ip in "${IPS[@]+"${IPS[@]}"}"; do
  skip=
  for u in "${UNIQ_IPS[@]+"${UNIQ_IPS[@]}"}"; do
    [[ "$u" == "$ip" ]] && skip=1 && break
  done
  [[ -n "$skip" ]] || UNIQ_IPS+=("$ip")
done

HOSTS=(localhost 127.0.0.1 ::1)
HOSTS+=("${UNIQ_IPS[@]+"${UNIQ_IPS[@]}"}")

echo "Generating certs for: ${HOSTS[*]}"
mkcert -cert-file "$CERT_DIR/dev-cert.pem" -key-file "$CERT_DIR/dev-key.pem" "${HOSTS[@]}"

echo ""
echo "Wrote:"
echo "  $CERT_DIR/dev-cert.pem"
echo "  $CERT_DIR/dev-key.pem"
echo ""
echo "Restart: npm run dev"
if [[ ${#UNIQ_IPS[@]} -gt 0 ]]; then
  echo "On your phone open:  https://${UNIQ_IPS[0]}:5173"
  echo "Optional .env:       SHOP_PUBLIC_ORIGIN=https://${UNIQ_IPS[0]}:5173"
else
  echo "On this machine:     https://localhost:5173"
fi
echo "Full guide: PHONE-SETUP.md"
