# NEXORA — Payments / MoMo Collection (Phase 7)

## Providers

Abstraction in `server/payments/providers.ts`:

| Id | Behaviour |
|----|-----------|
| `cash` | Confirmed at counter |
| `mtn_momo` | Live Collection when `MOMO_*` keys set; else agent/manual pending |
| `mtn_momo_sandbox` | Forced when `MOMO_USE_SANDBOX=1` |
| `airtel_money` | Manual pending (Collection wire TBD) |
| `card` / `bank_transfer` | Manual confirm |

## MTN Collection env

```bash
MOMO_SUBSCRIPTION_KEY=...
MOMO_API_USER=...
MOMO_API_KEY=...
MOMO_TARGET_ENV=sandbox          # or production
MOMO_BASE_URL=                   # optional override
MOMO_CALLBACK_HOST=https://your.public.host
MOMO_WEBHOOK_SECRET=optional-shared-secret
MOMO_FORCE_MANUAL=1              # skip Collection even if keys exist
MOMO_USE_SANDBOX=1               # map MTN_MOMO sales to sandbox provider id
```

Without keys, Sell stays on agent-number fallback — payment attempts remain `PENDING` until `POST /api/payments/:id/confirm`.

## APIs

- `GET /api/payments/providers` — catalog + `momoLive` flag
- `POST /api/payments/initiate` — start attempt (deduped by `clientRef`)
- `POST /api/payments/:id/poll` — refresh status from Collection API
- `POST /api/payments/:id/confirm` — cashier/manual confirm
- `POST /api/payments/webhooks/:provider` — MoMo callback (optional secret)

## Sell path

1. Cashier collects MSISDN when using MoMo.
2. Client may call `/initiate` with `phone` + `clientRef`.
3. Poll until `CONFIRMED` or fall back to agent + `/confirm`.
