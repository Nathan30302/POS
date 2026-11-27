#!/usr/bin/env bash
# Tenant isolation + RBAC smoke (requires running API + seeded demo).
set -euo pipefail
API="${API:-http://127.0.0.1:4000/api}"

echo "== health =="
curl -sf "$API/health" | head -c 400
echo

login() {
  curl -sf -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])"
}

echo "== cashier cannot list sales (403) =="
CT=$(login cashier@demo.shop DemoCash1!)
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/sales" -H "Authorization: Bearer $CT")
[[ "$CODE" == "403" ]] && echo "ok $CODE" || { echo "FAIL got $CODE"; exit 1; }

echo "== owner can audit (200) =="
OT=$(login owner@demo.shop DemoOwner1!)
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/audit" -H "Authorization: Bearer $OT")
[[ "$CODE" == "200" ]] && echo "ok $CODE" || { echo "FAIL got $CODE"; exit 1; }

echo "== invalid token rejected =="
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/products" -H "Authorization: Bearer not-a-token")
[[ "$CODE" == "401" ]] && echo "ok $CODE" || { echo "FAIL got $CODE"; exit 1; }

echo "== ready =="
curl -sf "$API/ready" >/dev/null && echo ok

echo "security-smoke passed"
