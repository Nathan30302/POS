# NEXORA — Offline & sync recovery

## How offline sales work

1. On Sell, if the device is offline (or the network drops mid-sale), the ticket is stored in **IndexedDB** on that device (`nexora-offline-v1`).
2. Each sale has a unique `clientSaleId` (UUID). Replaying the same id on the server is **idempotent** — you never get a double ledger row.
3. When the device comes online, queued sales sync automatically. You can also tap **Sync now**.
4. Original `createdAt` (when the cashier sold) is sent as `occurredAt` and kept in notes/audit — sync time is separate.

## Stock conflicts (multi-device)

If two devices sell the same SKU offline and the server no longer has enough stock:

1. Sync **fails** with status `conflict` and an open row appears under **Conflicts**.
2. Manager options:
   - **Accept shortfall** on Sell / Conflicts queue → retries with `allowStockConflict` (sale completes; stock may go negative; conflict stays for review).
   - **Dismiss / Mark adjusted / Accept shortfall** on the Conflicts list for the inventory record.
3. Owner gets an inbox alert when a shortfall sync is accepted.

Never silently discard a queued sale. Use **Drop** only after intentional discard (failed ≥2 attempts).

## Recovery checklist

| Symptom | Action |
|---------|--------|
| Sales stuck “pending” | Confirm Wi‑Fi / tunnel; tap **Sync now**; check API `:4000` |
| “Stock conflict” | Open Conflicts; accept shortfall or adjust stock then retry |
| Device wiped | Queued sales on that device are gone — cannot recover without Export |
| Need support dump | Sell/Conflicts → **Export** offline queue JSON |
| DB disaster | Restore from `scripts/backup-db.sh` copy |

## Backup (SQLite demo)

```bash
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh
# files land in ./backups/nexora-YYYYMMDD-HHMMSS.db
```

Schedule via cron for shops still on SQLite. Production should move to PostgreSQL + managed backups (Phase 5+).

## Multi-device soak (manual)

1. Two phones/laptops, same business, same branch.
2. Airplane mode both → sell overlapping SKUs → reconnect one then the other.
3. Confirm: one syncs cleanly; shortfall creates Conflicts; ledger has no duplicate `clientSaleId`.
4. Export queue mid-flight; confirm JSON has device ids and timestamps.
