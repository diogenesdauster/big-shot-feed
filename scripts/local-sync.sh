#!/bin/bash
# Trigger a manual sync against local or production feed
# Usage: ./scripts/local-sync.sh [local|prod]

set -e

TARGET="${1:-local}"

if [[ "$TARGET" == "local" ]]; then
  HOST="http://localhost:3001"
  API_KEY="local_dev_key_at_least_16_chars"
elif [[ "$TARGET" == "prod" ]]; then
  HOST="https://feed.bigshot.arcadia.dauster.xyz"
  API_KEY="${BIGSHOT_FEED_ADMIN_KEY:-}"
  if [[ -z "$API_KEY" ]]; then
    echo "Set BIGSHOT_FEED_ADMIN_KEY env var for prod"
    exit 1
  fi
else
  echo "Usage: $0 [local|prod]"
  exit 1
fi

echo "🔄 Triggering sync on $TARGET ($HOST)..."
curl -sk -X POST \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  "$HOST/v1/admin/sync" \
  -d '{}' | python3 -m json.tool
