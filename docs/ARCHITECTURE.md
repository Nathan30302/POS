# NEXORA — Architecture overview

## System shape

NEXORA is a **multi-tenant shop operating system**: one Express API + Prisma database, one React SPA, many isolated businesses.

```
Browser (Vite SPA) ──/api proxy──► Express 5 API ──► Prisma ──► SQLite | PostgreSQL
       │                                │
       └── httpOnly session cookie      ├── JWT verify (cookie or Bearer)
            + credentials: include      ├── RBAC from live Membership
                                        └── businessId tenant scope
```

## Auth model

| Actor | Storage | Access |
|-------|---------|--------|
| Shop user | `User` + `Membership` | JWT `kind: business` with `businessId`, `membershipId`, `role` |
| Platform admin | `PlatformUser` | JWT `kind: platform`; `SUPER_ADMIN` mutates; `SUPPORT` read-only |

- Login sets httpOnly `nexora_session` cookie; SPA does not keep JWT in `localStorage`.
- API tools/smokes may still send `Authorization: Bearer`.
- Cookie mutations require matching `Origin`/`Referer` (`server/csrfOrigin.ts`).
- Users in multiple shops: `GET /api/auth/memberships`, `POST /api/auth/switch-business`.

## Tenancy

Almost all business routes use `requireBusinessMember` and query with `where: { businessId: req.businessId }`. Platform admins may pass `x-business-id` to act on a tenant.

## Modules & plans

- **Industry modules** (`modulesJson`) gate pharmacy/perishables UI and APIs.
- **Plan features** (`requirePlanFeature`) soft-gate Pulse, transfers, purchasing (trial unlocked).

## Key domains

| Area | Routes / notes |
|------|----------------|
| Sell | `/api/sales` — server-side prices, offline `clientSaleId` |
| Inventory | `/api/products`, pharmacy lots `/api/pharmacy` |
| Pulse | `/api/insights` |
| Platform | `/api/platform`, subscription charge/approve |
| Uploads | `/uploads` — static; **auth required in production** |

## Observability

- `GET /api/health`, `GET /api/ready`
- `X-Request-Id` on responses; structured logs in production (`server/logger.ts`)

## Further reading

- Deploy: [DEPLOY.md](./DEPLOY.md)
- Owner guide: [NEXORA-OWNER-GUIDE.md](./NEXORA-OWNER-GUIDE.md)
- Product state: [../CURRENT-STATE.md](../CURRENT-STATE.md)
