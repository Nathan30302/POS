# NEXORA — Implementation Checklist

## Architecture (decided)

- **Frontend:** Vite + React + TypeScript + Tailwind (existing app, evolved)
- **Backend:** Express + Prisma + SQLite (local/dev) — schema is Postgres-ready for production
- **Auth:** JWT + role permissions, tenant (`businessId`) on every business row
- **Isolation:** All business queries scoped by `businessId`; platform admin has separate scope

## Phase A — Foundation

- [x] Prisma multi-tenant schema
- [x] Express API with auth middleware
- [x] Platform seed (super admin + demo business)
- [x] NEXORA brand system (light/dark)
- [x] Login + session
- [x] Master admin shell
- [x] Business owner shell

## Phase B — Onboarding & config

- [x] Business registration / onboarding wizard (API + UI)
- [x] Industry templates + module toggles (JSON modules)
- [x] Branches (model + main branch on create)
- [ ] CSV product import

## Phase C — Core modules

- [x] Sell / Counter (checkout, payments, receipts, stock decrement)
- [x] Customers CRM (profiles, loyalty, credit)
- [x] Pulse analytics + ask-your-data
- [x] Team: owner/admin create staff accounts, roles, permissions, password reset
- [x] Live cinematic landing + ambient interior motion
- [x] Inventory (products, categories, receive stock, low stock)
- [x] Sales history + void
- [x] Employees + RBAC (membership roles; custom role UI pending)
- [ ] Customers (CRM basic UI)
- [ ] Suppliers + purchase orders (basic)
- [ ] Expenses + financial summaries

## Phase D — Intelligence

- [x] Rule-based recommendations (reorder, dead stock, risk flags)
- [x] Owner Q&A assistant over real tenant data
- [ ] Scenario simulator (pricing / expense what-if)
- [ ] Daily summary notifications

## Phase E — Premium

- [ ] WhatsApp/SMS receipt hooks (config + docs, no fake sends)
- [ ] Offline queue sync
- [ ] Multi-branch comparison
- [ ] Audit log UI
- [ ] Tests for critical workflows
- [ ] Deployment docs

## Demo credentials (after seed)

- Platform: `admin@nexora.app` / `NexoraAdmin1!`
- Demo shop owner: `owner@demo.shop` / `DemoOwner1!`
- Demo cashier: `cashier@demo.shop` / `DemoCash1!`
