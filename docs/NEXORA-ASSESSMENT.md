# NEXORA — Repository Assessment

**Date:** 20 Nov 2026  
**Scope:** `/Users/mac/POS` (NEXORA Shop OS v0.1.0)  
**Rule:** Do not rebuild. Extend existing Trust / Audit / Money leaks / void-reason foundations. No tax module. No restaurant features.

---

## 1. Existing functionality (accurate)

| Area | Status | Notes |
|------|--------|--------|
| **Auth & tenancy** | Working | JWT login (business + platform); `requireBusinessMember` refreshes role from DB; suspended-shop gate; membership permissions |
| **RBAC** | Working | Permissions: sell, inventory, ledger, customers, pulse, labels, team, void_sales, receive_stock, discounts |
| **Sell / Checkout** | Strong | Catalogue, hold-+5, virtualization, barcode/USB, live camera ROI scan, phone PeerJS scanner, F2/F3/F4, sticky Complete, cash tender chips, loyalty chip, offline queue |
| **Large discount reason** | Working | ≥20% or ≥ZMW 50 requires `discountReason`; audited on `sale.create` |
| **Void with reason** | Working | `POST /sales/:id/void` requires reason; restores stock; `RETURN` stock movement; `sale.void` audit |
| **Trust signals** | Working | `server/trust.ts` cashier + branch flags (void rate, discount share); Command + Pulse panels |
| **Money leaks** | Working | Discounts, slow movers, hot stockout, cooling, void spike, stock shrink, thin margins |
| **Audit log** | Working | Append-only writes via `writeAudit`; `GET /api/audit` (manager); `/app/audit` UI |
| **Stock movements** | Partial backend | `StockMovement` model; written on sale / void / receive / manual adjust; `GET /products/:id/movements` exists — **no product history UI** |
| **Notifications model** | Schema only | `Notification` + types exist; no create-on-event path or owner inbox UI |
| **Branches** | Partial | Model + switcher + sale `branchId` tagging; Settings CRUD |
| **Offline sales** | Working | IndexedDB queue + sync + `clientSaleId` idempotency + stock conflict records/UI |
| **Payments abstraction** | Stub-ready | Initiate → pending → confirm; MoMo agent fallback; live keys not wired |
| **Barcode batches** | Working | Pre-print EAN-13 pools, claim on product |
| **Themes** | Working | Light / Dark / Live Floor (+ more), density, ambient |
| **Team** | Working | Invite/create staff, roles, password reset |
| **Pulse / Command** | Working | Dashboard metrics, briefing, scenario simulator, ask-your-data, Trust + Money leaks |
| **Customers** | Strong | List/create, phone lookup on Sell, loyalty, credit limits/balances/payments/overdue |
| **Suppliers / POs** | Working | CRUD suppliers, preferred supplier on products, PO draft→receive + cost |
| **Expenses** | Working | Record/filter/approve large, CSV, Command summary |

---

## 2. Incomplete functionality

- Product stock **history UI** (API already returns movements)
- **Cashier shift / cash drawer** open–close with expected vs declared (not started)
- Audit **hash chaining** / integrity verify (not started; routes are read-only today)
- **Suspicious void** heuristics beyond aggregate void rate (e.g. void minutes after sale)
- **In-app owner alerts** inbox (model unused)
- **Manager PIN** for large voids/discounts (reason-only today)
- ~~Suppliers / purchase orders~~ → Phase 3 done
- ~~Expenses module~~ → Phase 3 done
- CSV product import
- Loyalty auto-earn / campaigns
- Branch transfers & consolidated multi-branch reports
- Live MoMo collection credentials
- Production Postgres + deploy runbook + E2E suite

---

## 3. Security weaknesses

| Risk | Detail |
|------|--------|
| Audit mutability | No PUT/DELETE routes today (good), but **no cryptographic chain** — DB file edit could alter history undetected |
| Manager override | Large voids/discounts need reason + permission, but **no secondary PIN** — stolen cashier session with `void_sales`/`discounts` is enough |
| Shift cash | No till accountability — cash sales not reconciled to a drawer session |
| SQLite file | Local `prisma/dev.db` is a single file; theft or corruption = full tenant data |
| Rate limits | Login limited; PIN/approval endpoints need the same pattern when added |
| JWT secrets | Relies on env; production secret rotation / short TTL not documented |
| Platform `x-business-id` | Platform admins can act as any business — intentional, but must stay locked to platform tokens only |
| Offline queue | Client can enqueue sales; server idempotent — still vulnerable to stale stock races (mitigated by conflict records) |

---

## 4. Database limitations

- **Provider:** SQLite via Prisma (`DATABASE_URL`)
- Fine for single-shop / LAN demo; **not** for multi-instance production (file locking, no horizontal scale)
- Float money fields (not integer minor units) — rounding edge cases
- `Branch` has no per-branch stock; stock is business-global on `Product`
- `StockMovement` lacks `branchId` / actor userId (lean ledger only)
- `Notification` unused; no unread badge plumbing
- Schema enums already include transfer types unused by workflows
- Postgres migration path: schema is mostly portable; need `db push`/migrate strategy + connection pooling later

---

## 5. Missing workflows vs master prompt

| Master-prompt area | Gap vs codebase |
|--------------------|-----------------|
| Cash drawer / shifts | Missing entirely |
| Tamper-evident audit | Missing hash chain + verify |
| Suspicious activity alerts | Partial (void_spike leak + trust flags); no inbox |
| Stock movement ledger UX | Backend yes, owner UI no |
| Manager PIN approval | Missing |
| HQ multi-branch dashboard | Command is single-tenant; no cross-branch HQ rollup product |
| Inter-branch transfers | Enum only |
| Stripe / card processors | Abstraction stubs; not Stripe |
| Postgres production | Still SQLite |
| Tax module | **Out of scope** (fields exist `taxEnabled`/`taxRate` — leave alone) |
| Restaurant / tables / KDS | **Out of scope** |

---

## 6. Offline architecture risks

- Queue stores sales in IndexedDB; sync on reconnect (`useOfflineSalesSync`)
- Idempotency via `clientSaleId` prevents double ledger rows
- Stock conflicts when offline oversell — managers resolve in `/app/conflicts`
- Risks: multi-device concurrent offline sales on same SKU; partial sync failures; discountReason/manager PIN not in offline payload path; no offline void; queue does not track opening float / shift context
- Phone scanner depends on network (PeerJS) — not a true offline sell path

---

## 7. Multi-branch gaps

- Sales tagged with `branchId` from `x-branch-id` / membership
- Trust branch health compares void/discount outliers
- **No** per-branch inventory quantities
- **No** transfer workflow (`TRANSFER_IN` / `TRANSFER_OUT` unused)
- **No** consolidated HQ report across businesses (platform home is admin ops, not retail HQ)
- Branch manager role exists but pulse/team perms thinner than owner

---

## 8. Production deployment risks

- SQLite single-file DB; backups = copy file while consistent
- No Docker/compose/runbook; certs + LAN HTTPS optional and fragile
- Payment webhooks stub only
- In-memory rate limiter (not multi-node safe)
- Uploads on local disk
- Demo credentials in docs — must rotate for any real shop
- No automated E2E in CI
- CORS open; fine for LAN, tighten for public internet

---

## 9. Recommended implementation order (phases 1–7)

### Phase 1 — Security & Integrity *(this pass)*
1. Cashier shift / cash drawer (open float → cash sales → close declared vs expected + discrepancy reason + audit)
2. Stronger audit (hash chaining on new rows + owner verify endpoint; keep append-only)
3. Suspicious void detection (soon-after-sale + rate) on Trust / Integrity
4. Stock movement history UI for owners (extend existing ledger)
5. In-app owner alerts for void spike / cash shortage / stock shrink
6. Manager PIN for large voids/discounts (hashed on membership, rate-limited)

### Phase 2 — Operational reliability
Deepen offline soak tests; conflict UX; shift-aware offline; backup scripts

### Phase 3 — Payments
Live MoMo / Airtel credentials; harden confirm path; webhook polling

### Phase 4 — Business intelligence
Predictive reorder; deepen Ask Your Business; daily alert digests

### Phase 5 — Multi-branch growth
Per-branch stock or transfers; consolidated reports; HQ views

### Phase 6 — Platform hardening
Postgres migrate, deploy runbook, E2E suite, secret rotation

### Phase 7 — Growth polish
Loyalty campaigns, WhatsApp receipt hooks (real config only), CSV import

**Explicitly deferred this pass:** HQ dashboard productization, transfers, Stripe, Postgres migrate, tax, restaurant.

---

## Extension points (for Phase 1 implementers)

| Concern | Path |
|---------|------|
| Audit write | `server/middleware.ts` → `writeAudit` |
| Audit API | `server/routes/audit.ts` |
| Sales / void / discount | `server/routes/sales.ts` |
| Stock movements | `server/routes/products.ts` |
| Trust compute | `server/trust.ts` |
| Money leaks | `server/moneyLeaks.ts` |
| Command UI | `src/pages/OwnerDashboardPage.tsx` |
| Pulse UI | `src/pages/InsightsPage.tsx` |
| Trust panel | `src/components/growth/TrustPanel.tsx` |
| Sell | `src/pages/checkout/CheckoutPage.tsx` |
| Schema | `prisma/schema.prisma` |

---

## Phase 1 shipped (20 Nov 2026)

| Item | Status |
|------|--------|
| Cashier shift / cash drawer | Done — `CashShift` model, `/api/shifts`, Sell drawer panel, Command shifts card |
| Audit hash chain + verify | Done — `prevHash`/`entryHash` on new rows; `GET /api/audit/verify`; append-only |
| Suspicious void detection | Done — quick void ≤5 min + high void rate → Trust flags + owner alerts |
| Stock movement history UI | Done — Inventory card **History** → movements modal |
| In-app owner alerts | Done — inbox bell in shell; events for quick void, void spike, cash shortage, stock shrink |
| Manager PIN | Done — Settings set/clear; large discount/void require PIN when configured; rate-limited |

**Deferred (Phase 3–7):** Stripe, Postgres migrate, tax, restaurant, pharmacy batches.

---

## Phase 2 shipped (20 Nov 2026) — Multi-branch intelligence

| Item | Status |
|------|--------|
| Head Office / org view | Done — BranchSwitcher **All branches · HO**; `X-Branch-Id: __all__`; Command + Pulse scope |
| Consolidated reporting | Done — Command HO strip, range today/7d/30d, branch comparison cards (revenue, tickets, void/discount, low stock, stock value) |
| Inter-branch transfers | Done — `StockTransfer` + items; request → approve/reject → dispatch → receive (partial); `TRANSFER_OUT`/`TRANSFER_IN`; discrepancy flag; audit; perms `transfer_request` / `transfer_approve` / `transfer_receive` |
| Per-branch stock | Done — `BranchStock` + movements `branchId`; Product.stockQuantity = sum; seed from main on first use |
| Central purchasing MVP | Done — `/app/purchasing`: create PO (+ supplier), receive into branch, PURCHASE movements |
| UI | Done — Transfers + Purchasing nav; Command HO strip |

**Still deferred (at time of Phase 2):** Stripe, Postgres migrate, pharmacy batches, full supplier CRM, Phase 3–7 items.

---

## Phase 3 shipped (20 Nov 2026) — Inventory and financial management

| Item | Status |
|------|--------|
| Suppliers CRUD | Done — `/app/suppliers` + `/api/purchasing/suppliers` GET/POST/PATCH/DELETE; product preferred supplier; PO link |
| Purchase orders | Done — draft/ordered/partial/received/cancelled; submit/cancel; receive into branch; weighted-avg cost update; audit; create=`inventory`, receive=`receive_stock` |
| Expenses | Done — `/app/expenses` + `/api/expenses`; category/amount/payment/branch/notes/recorder; filter; large (≥ZMW 5k) approval; Command + Ledger links; CSV export; no tax |
| Stock valuation | Done — cost + selling on Command, Pulse, Inventory; HO vs branch scope on Command |
| Reorder recommendations | Done — Pulse (and Inventory link): below threshold + suggested qty from 14d velocity; disclaimer not guarantees |
| Customer credit | Done — `CREDIT` payment; limit enforced on Sell; `credit_sales` permission; balance + payments + history; overdue alerts on Customers/Command; credit issuance audited |

**Still deferred:** Stripe, Postgres migrate, pharmacy batches, tax module, Phase 4–7 (payments live, BI deepen, multi-branch growth polish, platform harden, loyalty campaigns).

---

## Phase 4 shipped (20 Nov 2026) — Offline reliability

| Item | Status |
|------|--------|
| Enriched offline queue | Done — branchId, deviceId, discountReason, occurredAt, conflict status; IndexedDB v2 |
| Smarter sync | Done — backoff, branch-scoped API header, idempotent clientSaleId, `allowStockConflict` retry |
| Conflict UX | Done — Conflicts page + Sell **OfflineQueuePanel**; Accept shortfall / Drop / Export JSON |
| Server shortfall path | Done — `allowStockConflict` completes sale + OPEN conflict + owner alert |
| Recovery docs | Done — `docs/OFFLINE-RECOVERY.md` |
| SQLite backup script | Done — `scripts/backup-db.sh` |

**Still deferred:** live MoMo, Postgres migrate, Stripe, pharmacy batches, tax.

---

## Phase 5 shipped (20 Nov 2026) — Production readiness

| Item | Status |
|------|--------|
| Env validation | Done — `server/env.ts`; prod refuses weak JWT / missing DATABASE_URL |
| Health / ready | Done — `/api/health` pings DB; `/api/ready`; phase `p5-production-readiness` |
| CORS lock | Done — `CORS_ORIGIN` comma list in production |
| Static serve | Done — prod API serves Vite `dist/` when present |
| Postgres path | Done — `docker-compose.yml` Postgres 16; `npm run db:use-postgres` / `db:use-sqlite` |
| Docker image | Done — `Dockerfile` for API |
| Backups | Done — SQLite backup/restore; `backup-pg.sh` for Postgres |
| Security smoke | Done — `npm run security:smoke` |
| Deploy runbook | Done — `docs/DEPLOY.md` + `.env.example` |

**Still deferred (Phase 6–7):** Stripe/MoMo SaaS billing, pharmacy batches, tax, loyalty campaigns.

---

## Phase 6 shipped (20 Nov 2026) — SaaS commercialization

| Item | Status |
|------|--------|
| Plan catalog | Done — starter / growth / business / enterprise (`server/plans.ts`) |
| Trial + grace | Done — 14d trial, 7d grace, auto-suspend; login + API gates |
| Billing fields | Done — subscriptionEndsAt, graceEndsAt, billingProvider, lastPayment* |
| SubscriptionEvent history | Done — append-only payment/trial events |
| Provider abstraction | Done — manual / MoMo / Airtel / Stripe stub |
| Platform UI | Done — create w/ plan+trial, record pay, suspend, change plan |
| Owner Settings panel | Done — Subscription status + history |
| Entitlement caps | Done — max branches / users on create |
| Docs | Done — `docs/SUBSCRIPTION.md` |

**Still deferred (Phase 7):** predictive BI deepen, live MoMo Collection wire, pharmacy batches, tax, loyalty campaigns.

---

## Phase 7 shipped (20 Nov 2026) — Growth polish + payments + BI

| Item | Status |
|------|--------|
| 7-day revenue forecast | Done — weighted MA on Pulse (`server/forecast.ts`) |
| Buyer cohorts | Done — repeat rate / new vs returning on Pulse |
| Ask Your Business | Done — forecast + repeat prompts |
| MoMo Collection wire | Done — request-to-pay + poll + webhook (`server/payments/momoCollection.ts`) |
| Payment poll API | Done — `POST /api/payments/:id/poll` |
| Loyalty auto-earn | Done — on sale with customer; Settings rates |
| Loyalty campaigns | Done — multiplier + endsAt in `settingsJson.loyalty` |
| Loyalty redeem | Done — Sell apply + `loyaltyPtsRedeemed` on sale |
| CSV product import | Done — Inventory dry-run + upsert by barcode |
| Docs | Done — `docs/PAYMENTS.md` |

**Still deferred:** tax module, live Airtel Collection, WhatsApp receipt provider keys, Stripe card processor.

---

## Pharmacy shipped (21 Nov 2026)

| Item | Status |
|------|--------|
| ProductBatch lots | Done — lot #, expiry, qty, FEFO |
| FEFO sell + void restore | Done — `batchAllocJson` on SaleItem |
| Rx flag + dispense note | Done — Sell gate + sale notes |
| Pharmacy page | Done — `/app/pharmacy` expiry board |
| Receive with lot | Done — Inventory receive + `/api/pharmacy/receive` |
| Industry / enable | Done — pharmacy/chemist/clinic + settings flag |
| Pulse expiry count | Done — `expiringLots90` |
| Docs | Done — `docs/PHARMACY.md` |
