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

- Web: http://localhost:5173  
- API: http://localhost:4000/api/health  

### Demo logins

| Role | Email | Password |
|------|-------|----------|
| Platform (super admin) | admin@nexora.app | NexoraAdmin1! |
| Business owner | owner@demo.shop | DemoOwner1! |
| Business admin | admin@demo.shop | DemoAdmin1! |
| Cashier | cashier@demo.shop | DemoCash1! |

## What’s working now

- Multi-tenant data model + JWT auth
- Platform super admin (register businesses + owner accounts)
- Business Team: create staff logins, roles, permissions, password resets
- Business login / dashboard (live revenue, stock, recent sales)
- Sell / counter checkout against API (stock decrement)
- Customers CRM (profiles, loyalty, credit limits)
- Pulse analytics + ask-your-data intelligence
- Inventory CRUD + receive stock
- Sales history + void (owner roles)
- Insights engine + natural-language Q&A over tenant data
- Onboarding endpoint + wizard page
- Light / dark NEXORA branding

## Roadmap

See `docs/NEXORA_IMPLEMENTATION_CHECKLIST.md` for remaining modules (CRM deep features, procurement UI, offline sync, WhatsApp API hooks, tests, etc.).

## Notes

- Tax is configurable per business (`taxEnabled` defaults false).
- Tenant isolation is enforced server-side via `businessId` on every business query.
