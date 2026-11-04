# POS — Shop Sample

Internal point-of-sale sample for a stationery shop. Built for a client walkthrough: cashier sells with cash or mobile money; owner sees today’s totals, low stock, and recent sales.

No ZRA / tax gateway. No public storefront. Shop-only.

## Demo logins

| Role    | Email               | Password  |
|---------|---------------------|-----------|
| Owner   | `owner@pos.local`   | `demo1234`|
| Cashier | `cashier@pos.local` | `demo1234`|

## What you can show

1. Sign in as **cashier** → open the till
2. Scan/search a barcode (try `6001234567001`) or tap a product photo
3. Pay with **Cash**, **Airtel**, **MTN**, or **Zamtel**
4. See the on-screen receipt; stock drops automatically
5. Sign in as **owner** → dashboard (today’s cash vs mobile money, low stock)
6. Open **Products** to edit price/stock or add items

## Run locally

```bash
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Prisma + SQLite (easy local demo; can move to Postgres later)
- Session cookies (owner / cashier roles)

## Ask the client next

- How many shops, and is stock shared or per shop?
- Real product / barcode list and prices (ZMW)
- Who works the till, and do they split cash + MoMo on one sale?
- Receipt needs (print / SMS / paper only)

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run db:setup` | Create DB + seed demo data |
| `npm run db:seed` | Re-seed demo data |
| `npm run build` | Production build |
