# POS — Shop Sample

Internal point-of-sale sample for a stationery shop. Built for a client walkthrough: cashier sells with cash or mobile money; owner sees today’s totals, low stock, and recent sales.

No ZRA / tax gateway. No public storefront. Shop-only.

## Demo logins

| Role    | Email               | Password  |
|---------|---------------------|-----------|
| Owner   | `owner@pos.local`   | `demo1234`|
| Cashier | `cashier@pos.local` | `demo1234`|

## What you can show

1. Open the **landing page** at `/` — full hero demo pitch
2. Go to **Sign in** and pick Owner or Cashier
3. As **cashier** → till: scan/search (`6001234567001`) or tap a product photo
4. Pay with **Cash**, **Airtel**, **MTN**, or **Zamtel**
5. See the on-screen receipt; stock drops automatically
6. As **owner** → dashboard (today’s cash vs mobile money, low stock)
7. Open **Products** to edit price/stock or add items

## Run locally

```bash
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the landing page, then continue to login.

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
