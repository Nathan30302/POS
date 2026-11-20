# NEXORA development checklist

Legend: `[x]` done · `[~]` partial · `[ ]` pending · `[!]` blocked

---

## PHASE 1 — Security and reliability

- [x] Architectural inspection
- [x] DB-backed `requireBusinessMember` + suspended shop check
- [x] `requirePermission` / `requireAnyPermission` / `requireManager`
- [x] Gates: sell, discounts, void, ledger, inventory, receive_stock, customers, pulse
- [x] Audit writes + `GET /api/audit` + `/app/audit` UI
- [x] Login rate limiting
- [x] Sale Zod tightened + `clientSaleId` idempotency
- [~] Password-reset hardening
- [~] Automated RBAC (`scripts/smoke-rbac.sh` — run after restart)
- [ ] Production Postgres strategy (SQLite kept for local)

## PHASE 2 — Operational reliability

- [x] IndexedDB offline sale queue (`src/lib/offlineQueue.ts`)
- [x] Auto-sync on reconnect + manual Sync (`useOfflineSalesSync`)
- [x] Online / queued indicator in shell + Sell banner
- [x] Idempotent `POST /sales` via `clientSaleId` (no duplicate ledger rows)
- [x] Stock conflict records + manager resolve API
- [x] Conflict resolution UI (`/app/conflicts`)
- [x] Catalogue virtualization for huge inventories (`useVirtualGrid` on Sell)

## PHASE 3 — Payments

- [x] Provider abstraction (`server/payments/*`)
- [x] Lifecycle: initiate → pending → confirm (+ webhook stub)
- [x] Cash / card / bank / MoMo manual / MTN sandbox stub
- [x] `GET/POST /api/payments/*` (sell-gated)
- [!] Real MTN Collection API — needs `MOMO_SUBSCRIPTION_KEY`, `MOMO_API_USER`, `MOMO_API_KEY`
- [!] Airtel live API credentials
- [~] Agent-number remains labelled manual fallback (not auto-confirmed)

## PHASE 4 — Business intelligence

- [x] Daily briefing API + Pulse UI card (`/insights/briefing/today`)
- [x] Recommendation status field + PATCH status
- [~] Ask Your Business (exists; deepen explanations)
- [ ] Full predictive inventory / PO generation UI
- [x] Financial scenario simulator (Pulse)

## PHASE 5 — Growth & enterprise

- [x] Customer phone lookup on Sell (sell|customers)
- [ ] Loyalty auto-apply / campaigns
- [~] Multi-branch list/switch + sale `branchId` tagging (`/api/branches`, Settings + sidebar)
- [ ] Multi-branch transfers & consolidated reports
- [ ] Market intelligence module

## PHASE 6 — Polish

- [x] Themes: Light / Dark / Live Floor
- [x] Sell speed: hold +5 tiles, hold-repeat qty, cash Exact chips, F2/F3/F4
- [x] Live scan ROI + detector warm-up (sub-second; `/scan-bench`)
- [x] Sell customer debounce + loyalty discount chip
- [~] Offline badge / skeletons on audit
- [ ] Full E2E suite
- [ ] Production deploy runbook

---

## How to run after this pass

```bash
./scripts/force-restart.sh
# then open http://localhost:5173
./scripts/smoke-rbac.sh
```

If port 4000 is stuck on an old process, use `PORT=4001 npm run dev:api` (Vite reads `API_PORT`) or run `./scripts/kill-zombie.sh` if present.

Demo: `cashier@demo.shop` / `DemoCash1!` · `owner@demo.shop` / `DemoOwner1!`
