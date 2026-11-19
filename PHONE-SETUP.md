# Phone Sell setup (HTTPS + LAN)

Live barcode scanning needs a **secure context** (HTTPS or localhost). Phones on your shop Wi‑Fi cannot use `http://192.168.x.x` for the camera.

**Recommended path:** staff sign in on a phone → open **Sell** → Live scan / catalogue. No PeerJS QR pairing required.

---

## 1. Everyday shop Wi‑Fi (trusted LAN cert)

### One-time: install mkcert

```bash
# macOS
brew install mkcert
mkcert -install

# Linux (example)
# sudo apt install libnss3-tools
# then install mkcert from https://github.com/FiloSottile/mkcert
```

### Generate certs for this machine

```bash
chmod +x scripts/setup-lan-https.sh
./scripts/setup-lan-https.sh
```

This writes `certs/dev-key.pem` + `certs/dev-cert.pem` covering `localhost` and your LAN IPs, and prints the HTTPS URL for phones.

Restart the app (`npm run dev`). Open the printed `https://…:5173` URL on the phone, trust the local CA if prompted once, then log in as cashier/owner and use **Sell**.

Set a stable public origin for QR / phone links (optional):

```bash
# .env
SHOP_PUBLIC_ORIGIN=https://192.168.1.20:5173
```

---

## 2. Stable Cloudflare tunnel (named — not trycloudflare)

Disposable `*.trycloudflare.com` links die and cause NXDOMAIN. Prefer a **named** tunnel.

```bash
# Install once: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
cloudflared tunnel login
cloudflared tunnel create nexora-shop
cloudflared tunnel route dns nexora-shop sell.yourdomain.com
```

Config (`~/.cloudflared/config.yml` example):

```yaml
tunnel: nexora-shop
credentials-file: /Users/YOU/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: sell.yourdomain.com
    service: https://127.0.0.1:5173
    originRequest:
      noTLSVerify: true
  - service: http_status:404
```

Run:

```bash
cloudflared tunnel run nexora-shop
# or: ./scripts/named-tunnel.sh
```

Then in `.env`:

```bash
SHOP_PUBLIC_ORIGIN=https://sell.yourdomain.com
```

---

## 3. Dev convenience (self-signed Vite SSL)

`vite.config.ts` already enables `@vitejs/plugin-basic-ssl`. That works for quick tests but browsers show **“Not private”** until you trust the cert. Prefer **mkcert** (section 1) for daily phone use.

---

## 4. Checklist on the phone

1. Open the **HTTPS** shop URL (LAN or named tunnel).
2. Log in (demo: `cashier@demo.shop` / `DemoCash1!`).
3. Go to **Sell** → **Live scan** or tap catalogue tiles.
4. Allow camera when prompted.
5. Complete sale — ledger updates for the whole shop.

Optional advanced: desktop Sell → “Phone as barcode gun” QR (PeerJS). Use only when the counter stays on a laptop and the phone is a gun only.

---

## 5. Payment keys (next step)

Agent numbers in **Settings → Mobile money** remain the fallback. For initiated MoMo payments you’ll add provider credentials (sandbox first), e.g.:

```bash
# future
MOMO_PROVIDER=mtn_zambia_sandbox
MOMO_API_USER=
MOMO_API_KEY=
MOMO_SUBSCRIPTION_KEY=
MOMO_CALLBACK_URL=https://sell.yourdomain.com/api/payments/momo/callback
```

See README “Payments” for the recommended integration order.
