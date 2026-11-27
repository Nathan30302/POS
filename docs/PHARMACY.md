# NEXORA — Pharmacy support

Retail and pharmacy share the same Sell / Inventory stack. Pharmacy adds **lots, expiry, FEFO, and Rx notes**.

## Enable

- Platform create shop with industry `pharmacy` / `chemist` / `clinic`, **or**
- Open **Pharmacy** in the nav → **Turn on pharmacy** (sets industry + `settings.pharmacy.enabled`)

## Lots & FEFO

1. Inventory → Receive stock → enter **lot #** + **expiry**, **or** Pharmacy → Receive lot
2. Sell deducts **soonest-expiring non-expired** lots first (`server/pharmacy.ts`)
3. Void restores recorded lot allocations on each sale line
4. Expired lots are not sellable when batches exist

## Prescription items

- Mark product **Requires prescription (Rx)**
- Sell requires a short **Rx / dispense note** before complete
- Note is stored on the sale (`Rx: …`) and audited

## APIs

- `GET /api/pharmacy/meta`
- `GET /api/pharmacy/expiring?days=90`
- `POST /api/pharmacy/receive`
- `POST /api/pharmacy/scan-alerts`
- `GET /api/products/:id/batches`

## UI

- `/app/pharmacy` — expiry board + receive
- Inventory product form — track expiry, Rx flag, pharmacy categories
- Sell — Rx note when cart has prescription items
- Pulse — `expiringLots90` count

Tax / full regulatory e-prescription networks are out of scope.
