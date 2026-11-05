# Stationery POS

Fully working local demo POS for a stationery shop. **No cloud setup** — data stays in the browser (`localStorage`).

## Run

```bash
npm install
npm run dev
```

Open **http://localhost:5173**

## What’s included

| Area | Features |
|------|----------|
| **Checkout** | Search / barcode / camera, cart, clear cart, discount, cash + change, payment, beeps, print + WhatsApp receipt, F2/F4 shortcuts |
| **Products** | Search, filter, add/edit/delete, receive stock, low-stock badges |
| **Barcodes** | Printable barcode sheet for demo products |
| **Dashboard** | Today’s totals, avg ticket, payment bars, low stock, recent sales (Owner) |
| **Sales** | Search, date/payment filters, sale details, void (restores stock), CSV export (Owner) |
| **Roles** | Owner vs Staff switch in the sidebar |
| **PWA** | Installable from the browser (Add to Home Screen / Install app) |

## Roles

- **Owner** — cost prices, dashboard, sales reports, product edit/delete
- **Staff** — checkout, product list (sell prices), receive stock

## Barcode tips

1. **Fastest (recommended):** Checkout → **Phone** → scan the QR with your phone (same Wi‑Fi). Phone camera feeds the till live.  
2. Open the POS on your laptop via Wi‑Fi IP (not `localhost`), e.g. `http://192.168.x.x:5173`, so the phone can open the QR link.  
3. USB barcode gun into the Checkout box also works instantly.  
4. Type demo code `6001234567001` (black pen) to hear the ting.  
5. Laptop **Webcam** is a backup — usually slower than a phone.  

## Reset

Products → **Reset demo** (Owner) restores the sample catalogue and clears sales.
