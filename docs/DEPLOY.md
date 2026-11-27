# NEXORA — Production deploy runbook

**Goal:** Move from LAN/demo (SQLite) to a maintainable production shape without rebuilding the app.

## Environments

| Env | Database | JWT | CORS | UI |
|-----|----------|-----|------|-----|
| Local demo | `file:./prisma/dev.db` | any in `.env` | open | Vite `:5173` |
| Production | PostgreSQL | ≥32 char secret | `CORS_ORIGIN` locked | API serves `dist/` or reverse-proxy |

Copy `.env.example` → `.env` and fill secrets.

## 1. PostgreSQL (required for paying tenants)

SQLite is fine for local demo only. Production should use Postgres.

```bash
# Start Postgres
docker compose up -d db

# Point Prisma at Postgres
npm run db:use-postgres
# Ensure .env has:
# DATABASE_URL=postgresql://nexora:PASSWORD@127.0.0.1:5432/nexora
# JWT_SECRET=<long random ≥32 chars>
# NODE_ENV=production
# CORS_ORIGIN=https://your.domain
# MOMO_WEBHOOK_SECRET=<long random>

npx prisma generate

# Schema apply (preferred):
npm run db:migrate
# Bootstrap / emergency only:
# npm run db:push

# Demo seed — skip for real shops
# npm run db:seed
```

**Migrations:** a SQLite baseline lives in `prisma/migrations/`. New environments should use `npm run db:migrate` (`prisma migrate deploy`). Existing local DBs created with `db push` can mark the baseline applied once:

```bash
npx prisma migrate resolve --applied 20261123120000_init
```

For Postgres, switch provider first (`npm run db:use-postgres`), generate a Postgres migration (or re-diff), then `migrate deploy`.

**Sessions:** login sets an httpOnly `nexora_session` cookie (JWT). The SPA uses `credentials: 'include'` and does not keep the JWT in `localStorage`. Bearer tokens still work for smoke scripts and API tools. Cookie-authenticated mutations require a matching `Origin`/`Referer` (CSRF mitigation); Bearer clients are exempt.

**Uploads:** `/uploads` is static with no directory index; non-image files are forced as attachments with `nosniff`.

**Rate limiting:** uses Redis when `REDIS_URL` is set; otherwise in-memory (single-node). For multi-instance production, set Redis (or terminate rate limits at the edge).

**Tests before promote:**

```bash
npm run test          # Vitest unit + API integration
npm run test:smoke    # functional + security smokes (API up)
npm run test:e2e      # Playwright login→Sell (dev servers or webServer)
```

Switch back to SQLite anytime: `npm run db:use-sqlite` then restore `DATABASE_URL=file:./prisma/dev.db`.

## 2. Build & run API (+ static UI)

```bash
npm ci
npm run build
NODE_ENV=production node --import tsx server/index.ts
```

In production the API serves `dist/` when present. Put Nginx/Caddy in front for TLS.

## 3. Backups

**SQLite**

```bash
./scripts/backup-db.sh
./scripts/restore-db.sh backups/nexora-YYYYMMDD-HHMMSS.db
```

**Postgres**

```bash
export DATABASE_URL=postgresql://…
./scripts/backup-pg.sh
# restore: pg_restore --clean --if-exists -d "$DATABASE_URL" backups/nexora-pg-….dump
```

Test a restore on a staging DB before you need it.

## 4. Health & monitoring

- `GET /api/health` — includes `dbOk`, `uptimeSec`, `dbProvider` (503 if DB down)
- `GET /api/ready` — k8s-style readiness
- Wire uptime checks (UptimeRobot / Better Stack) to `/api/health`
- Ship logs to your host logger; API already prints errors to stderr

## 5. Security checklist before first paid shop

- [ ] Strong `JWT_SECRET` (≥32, not a placeholder)
- [ ] `CORS_ORIGIN` set to real shop origins only (required to boot in production)
- [ ] `MOMO_WEBHOOK_SECRET` set (required to boot in production)
- [ ] HTTPS (named Cloudflare tunnel or reverse proxy)
- [ ] Demo seed skipped / demo passwords not used in prod
- [ ] `npm run test:smoke` (or `security:smoke` + `smoke:functional`) passes against staging
- [ ] Backups scheduled + restore drill done
- [ ] Uploads disk monitored (`uploads/`)
- [ ] Behind reverse proxy: `trust proxy` is enabled when `NODE_ENV=production`

## 6. Docker image (optional)

```bash
docker compose up -d db
docker build -t nexora-api .
docker run --env-file .env -p 4000:4000 nexora-api
```

## Rollback

1. Stop API.
2. Restore previous DB backup.
3. Redeploy previous git tag / image.
4. Confirm `/api/health` → `dbOk: true`.
