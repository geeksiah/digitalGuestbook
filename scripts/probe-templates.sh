#!/usr/bin/env bash
set -euo pipefail

# Probe backend public template endpoints and print ISO timestamps.
# Usage: ./probe-templates.sh [event-slug]

API_BASE="${API_BASE:-https://digitalguestbook.onrender.com}"
EVENT_SLUG="${1:-huggel-and-bridget}"
ENDPOINTS=(invitation guestbook "guestbook/video" rsvp "booth/photo" thanks live ended)

for ep in "${ENDPOINTS[@]}"; do
  TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  URL="$API_BASE/api/public/event/$EVENT_SLUG/$ep"
  echo "[$TS] GET $URL"
  # print headers and up to 1200 bytes of body for quick inspection
  curl -sS -i "$URL" | head -c 1200
  echo -e "\n---\n"
  sleep 0.5
done
