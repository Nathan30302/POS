# NEXORA

**Shop operating system** — sell, stock, team, Pulse, and integrity in one multi-tenant app.

## Stack

- Frontend: Vite + React 19 + TypeScript + Tailwind
- Backend: Express 5 + Prisma 6
- Database: SQLite locally · PostgreSQL for production
- Auth: httpOnly session cookie (JWT) + optional Bearer for tools

## Quick start

```bash
npm install
npx prisma migrate deploy   # or: npm run db:push
npm run db:seed
npm run dev
```

- Web: http://localhost:5173  
- API: http://localhost:4000/api/health  

Camera works on **http://localhost**. Phones on Wi‑Fi: see [PHONE-SETUP.md](./PHONE-SETUP.md).

### Demo logins (local / DEV only)

Demo chips appear on the login page **only in development builds**. Seeded accounts:

| Role | Email | Password |
|------|-------|----------|
| Platform | admin@nexora.app | NexoraAdmin1! |
| Owner | owner@demo.shop | DemoOwner1! |
| Admin | admin@demo.shop | DemoAdmin1! |
| Cashier | cashier@demo.shop | DemoCash1! |

## Testing

```bash
npm run test           # Vitest unit + API integration
npm run test:smoke     # Functional + security smokes (API up)
npm run test:e2e       # Playwright (starts or reuses dev servers)
npm run test:all       # Vitest + smokes
```

## Production

See **[docs/DEPLOY.md](./docs/DEPLOY.md)** for Postgres, `CORS_ORIGIN`, `MOMO_WEBHOOK_SECRET`, backups, and health checks.

Architecture: **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**  
Quality assessment: **[docs/QUALITY-ASSESSMENT.md](./docs/QUALITY-ASSESSMENT.md)**  
Living product status: **[CURRENT-STATE.md](./CURRENT-STATE.md)**  
Owner guide (PDF): `/docs/NEXORA-Owner-Guide.pdf`

## Notes

- Tenant isolation is enforced server-side via `businessId`.
- Self-serve signup waits for platform **Approve** before login.
- Users in multiple shops can switch under **Settings → Your shops**.
