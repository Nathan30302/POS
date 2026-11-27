# NEXORA Shop OS — current state (v0.1.0)

Last updated: 23 Nov 2026

Progress tracker: **[DEVELOPMENT-CHECKLIST.md](./DEVELOPMENT-CHECKLIST.md)**.

**Latest engineering pass (gap closure after Waves 1–5):** Multi-shop `GET /auth/memberships` + `POST /auth/switch-business` (Settings → Your shops), production `/uploads` behind `requireAuth`, Settings theme card + shop switcher extracted, `docs/ARCHITECTURE.md` + `docs/QUALITY-ASSESSMENT.md`, README testing section, Playwright in CI. Waves 1–5 remain shipped.

NEXORA is a multi-tenant **shop operating system** (Sell, inventory, ledger, customers, Pulse, team, settings) — not a single-register toy POS. Stack: React 19 + Vite 8 + Tailwind 4 + Express 5 + Prisma 6 + SQLite.

**Local test URL (no cert warning):** http://localhost:5173  
**API:** http://localhost:4000/api/health (or `:4001` if 4000 is stuck — set `API_PORT`)  

Demo logins (unchanged):

| Role | Email | Password |
|------|-------|----------|
| Cashier | cashier@demo.shop | DemoCash1! |
| Owner | owner@demo.shop | DemoOwner1! |
| Admin | admin@demo.shop | DemoAdmin1! |
| Platform | admin@nexora.app | NexoraAdmin1! |

---

## What works well today

### Auth & tenancy
- JWT login for platform vs business users
- Role + permission model in UI (`sell`, `inventory`, `ledger`, `customers`, `pulse`, `labels`, `team`, `discounts`, …)
- Demo seed data and isolated business context
- Platform home can register businesses / owners

### Sell / Checkout (highest priority area)
- Catalogue tap-to-add, **hold tile for +5**, virtualized grid, “Last sale” strip
- Search / USB-gun style barcode entry · **F2** search · **F3** scan · **F4** complete
- Live camera scan on **http://localhost** (secure context) and HTTPS when configured
- Scan path tuned for **sub-second adds**: preferred camera constraints first, continuous AF, **center ROI** detect, detector **warm-up** before live, ZXing ROI canvas fallback (Safari)
- Cooldown ~180 ms same-code · `requestVideoFrameCallback` when available
- Bench: `/scan-bench` (warm decode ~60ms in Chrome)
- O(1) in-memory barcode / SKU index
- Optimistic stock after sale + silent background refresh (no full catalogue flash)
- Beep + short haptic on successful add
- Sticky **Complete** bar on phones (total · payment · discount)
- Payment method tiles: Cash, MTN, Airtel, Card, Other
- Cash tender chips (Exact / round-up notes) + change on receipt
- Customer phone debounce lookup + **loyalty apply** (10 pts → K1, cap 20%)
- Receipt panel: print / PDF / share hooks
- **Same as last** cart repeat
- Qty +/- with **hold-to-repeat**; minus to 0 removes line
- Phone-first banner (“best path”)
- Optional QR “phone as barcode gun” (PeerJS) — advanced, not primary

### Phone / HTTPS tooling
- Default local web is **plain HTTP** (`http://localhost:5173`) so Mac testing isn’t blocked by “Not private”
- Optional `NEXORA_HTTPS=1` + mkcert scripts (`scripts/setup-lan-https.sh`, `PHONE-SETUP.md`)
- Named Cloudflare tunnel script (stable hostname preferred over trycloudflare)

### Inventory & products
- Product CRUD, categories, stock, low-stock threshold
- Voice-assisted fill on product form (dictation / digits helpers)
- Barcode labels page

### Ledger / sales history
- Sales list, void (owner-like roles)
- Receipts tied to shop profile

### Customers
- Basic CRM: create / list profiles, loyalty / credit fields present

### Pulse / insights
- Dashboard-style metrics + natural-language ask-your-data endpoint
- Daily briefing + stock-conflict counts
- Financial scenario simulator (price / volume / cost / discount sliders)
- Command dashboard for owners (revenue, stock, recent activity)

### Team & settings
- Invite/create staff, roles, permissions, password reset flows
- Shop profile for receipts
- MoMo **agent number / code** display (MTN / Airtel) — fallback, not API-initiated pay
- Look & feel: **Light**, **Dark**, **Live Floor** (motion skin), density, atmosphere orbs
- Branch switcher (sidebar + Settings); sales tagged with `branchId`

### Shell / UX chrome
- Responsive layout, phone bottom nav
- Online / offline queue indicator
- Conflicts nav (managers)
- Ambient orbs (optional; forced on for Live Floor)
- Light/dark/live cycle from header / Settings

---

## Rough / not good yet

### Phone on real Wi‑Fi
- Live camera on a **phone over LAN IP** still needs trusted HTTPS (or a named tunnel). Plain `http://192.168.x.x` will block the camera.
- Disposable trycloudflare links are flaky (NXDOMAIN / expire) — not the recommended path.
- Homebrew/mkcert install on this machine can be painful (permissions); use `tools/mkcert` + Terminal password for trust, or stick to localhost for Mac testing.

### Payments
- Provider lifecycle exists (initiate → pending → confirm); **live** MTN/Airtel still need credentials
- Agent numbers remain labelled manual fallback
- Webhook stub only — not production polling

### Offline / conflicts
- IndexedDB queue + sync + conflict records/UI are in; edge cases (partial sync, multi-device stock) still need soak testing

### Sell UX still to raise
- Voice commands (“complete sale”, “clear cart”) not fully reliable
- Full loyalty campaigns / earn-on-sale ledger not built (manual apply chip only)
- Branch transfers & consolidated multi-branch reports not built

### Themes
- Light / Dark / **Live Floor** (distinct palette + moving sheen, stronger orbs, pulse accents)

### Other polish gaps
- Full E2E suite and production Postgres / deploy runbook still open
- Dead paths / unused libs (e.g. html5-qrcode) may remain
- Insights / Command not yet “Square Dashboard” polished

---

## Themes — how to try Live Floor

1. Open http://localhost:5173 → login  
2. **Settings → Look & feel → Live Floor**  
   Or tap the theme control (cycles Light → Dark → Live Floor)  
3. Expect: deeper blue/teal skin, card sheen, stronger floating dust/orbs, pulse accents  

Atmosphere toggle is locked on while Live Floor is selected.

---

## Suggested next builds (impact order)

1. Trusted phone HTTPS path that “just works” on shop Wi‑Fi (mkcert one-shot or named tunnel)  
2. MTN MoMo Collection sandbox keys + live confirm path  
3. Branch transfers + consolidated reports  
4. Loyalty campaigns / auto-apply on Sell  
5. Production Postgres + deploy runbook + E2E suite  

---

## Quick run

```bash
cd /Users/mac/POS
./scripts/dev-http.sh
# or: npm run dev
# open http://localhost:5173/login
```

Phone HTTPS (optional): see `PHONE-SETUP.md`.
