# NEXORA — Subscription / SaaS (Phase 6)

## Plans

| Plan | Branches | Users | Monthly (ZMW list) |
|------|----------|-------|--------------------|
| Starter | 1 | 5 | 199 |
| Growth | 2 | 15 | 449 |
| Business | 8 | 50 | 899 |
| Enterprise | 100 | 500 | Custom |

Entitlements enforce **branch** and **user** caps. Feature flags are informational for now (no fake UI locks).

## Lifecycle

1. Platform creates business → default **TRIAL** (14 days) + chosen plan.
2. Trial end → **grace** (7 days) → auto **SUSPENDED** if not renewed.
3. Platform **Record month/year pay** → status **ACTIVE**, `subscriptionEndsAt` extended.
4. Paid period end → grace → suspend.
5. Suspended / cancelled shops cannot log in or call business APIs.

## Billing providers

Abstraction in `server/billing/providers.ts`:

- `manual` — confirm immediately (cash / agent / bank)
- `mtn_momo` — pending until Collection API keys exist
- `airtel_money` — pending stub
- `stripe_stub` — pending stub

Core subscription state never hardcodes a PSP.

## APIs

- `GET /api/subscription/plans`
- `GET /api/subscription/current` (shop)
- `GET /api/platform/businesses?page=&pageSize=&q=&status=&plan=` — paginated lean directory (default 50, max 100)
- `PATCH /api/subscription/platform/businesses/:id`
- `POST /api/subscription/platform/businesses/:id/charge`
- `POST /api/subscription/platform/businesses/:id/start-trial`

Scale helpers: `node scripts/stress-businesses.mjs [count]` then `CLEANUP=1 node scripts/stress-businesses.mjs`.

## UI

- Platform console: plan catalog, create with trial, charge, suspend/reactivate
- Settings → Subscription: plan status + billing history for owners
