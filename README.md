# NEXORA

**Intelligent Business Management Platform** — *Run Smarter. Grow Faster.*

Multi-tenant sell + inventory + Pulse insights platform. One codebase, many isolated businesses.

## Stack

- Frontend: Vite + React + TypeScript + Tailwind
- Backend: Express + Prisma + SQLite (Postgres-ready schema)
- Auth: JWT with platform vs business memberships

## Quick start

```bash
npm install
npx prisma db push
npm run db:seed
npm run dev
```

- Web: http://localhost:5173 (plain HTTP — no cert warning)  
- API: http://localhost:4000/api/health  

Camera works on **http://localhost** (browsers treat localhost as secure). For phones on Wi‑Fi, see PHONE-SETUP.md (`NEXORA_HTTPS=1` + mkcert).

### Demo logins

| Role | Email | Password |
|------|-------|----------|
| Platform (super admin) | admin@nexora.app | NexoraAdmin1! |
| Business owner | owner@demo.shop | DemoOwner1! |
| Business admin | admin@demo.shop | DemoAdmin1! |
| Cashier | cashier@demo.shop | DemoCash1! |

### Phone Sell (recommended)

Staff sign in on a phone → **Sell** → Live scan / catalogue. No QR pairing.

On this Mac, use **http://localhost:5173**. For real phones on LAN/tunnel HTTPS, see **[PHONE-SETUP.md](./PHONE-SETUP.md)**.

## What’s working now

- Multi-tenant data model + JWT auth
- Platform super admin (register businesses + owner accounts)
- Business Team: create staff logins, roles, permissions, password resets
- Business login / dashboard (live revenue, stock, recent sales)
- Sell / counter checkout — fast scan-to-cart, optimistic stock, O(1) barcode index
- Logged-in phone Sell (primary) + optional PeerJS “phone as gun”
- Customers CRM (profiles, loyalty, credit limits)
- Pulse analytics + ask-your-data intelligence
- Inventory CRUD + receive stock
- Sales history + void (owner roles)
- Insights engine + natural-language Q&A over tenant data
- Onboarding endpoint + wizard page
- Light / dark NEXORA branding

## Payments (next)

Today: Cash + MoMo **agent number** display (Settings → Mobile money).

Recommended next step: **MTN MoMo Collection API sandbox** (Zambia / multi-country) — initiate request-to-pay, poll status, keep agent-number fallback when no API keys. Structure routes as `/api/payments/momo` with `pending | confirmed | failed` and a webhook callback URL for production.

## Roadmap

See `docs/NEXORA_IMPLEMENTATION_CHECKLIST.md` for remaining modules (CRM deep features, procurement UI, offline sync, WhatsApp API hooks, tests, etc.).

## Notes

- Tax is configurable per business (`taxEnabled` defaults false).
- Tenant isolation is enforced server-side via `businessId` on every business query.
- Phone HTTPS / tunnels: see `PHONE-SETUP.md`.
- Full working / not-yet status: see **[CURRENT-STATE.md](./CURRENT-STATE.md)**.
