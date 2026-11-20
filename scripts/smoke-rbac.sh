#!/usr/bin/env bash
set -euo pipefail
API="${API:-http://127.0.0.1:4000/api}"
echo "Health: $(curl -s "$API/health")"
CASH=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"cashier@demo.shop","password":"DemoCash1!"}')
CT=$(echo "$CASH" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo -n "cashier products: "; curl -s -o /dev/null -w "%{http_code}\n" "$API/products" -H "Authorization: Bearer $CT"
echo -n "cashier sales list (want 403): "; curl -s -o /dev/null -w "%{http_code}\n" "$API/sales" -H "Authorization: Bearer $CT"
echo -n "cashier discount (want 403): "; curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API/sales" \
  -H "Authorization: Bearer $CT" -H 'Content-Type: application/json' \
  -d '{"discount":9,"paymentMethod":"CASH","lines":[{"productId":"x","quantity":1}]}'
OWN=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"owner@demo.shop","password":"DemoOwner1!"}')
OT=$(echo "$OWN" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo -n "owner audit: "; curl -s -o /dev/null -w "%{http_code}\n" "$API/audit" -H "Authorization: Bearer $OT"
echo -n "owner briefing: "; curl -s -o /dev/null -w "%{http_code}\n" "$API/insights/briefing/today" -H "Authorization: Bearer $OT"
echo done
