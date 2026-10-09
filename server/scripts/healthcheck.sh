#!/usr/bin/env bash
# Pings the community server's /api/health and logs a line either way.
# Run from cron every few minutes; point SYSLOG=1 at it to also forward
# failures to the system log, which most mail-on-cron-error setups pick up.
set -euo pipefail

URL="${KINETIK_HEALTH_URL:-http://localhost:8787/api/health}"
LOG_FILE="${LOG_FILE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/healthcheck.log}"

stamp="$(date -Iseconds)"
if response="$(curl -fsS --max-time 5 "$URL" 2>&1)"; then
  echo "$stamp OK $response" >>"$LOG_FILE"
else
  echo "$stamp DOWN $response" >>"$LOG_FILE"
  if [ "${SYSLOG:-0}" = "1" ]; then
    logger -t kinetik-server "health check failed: $response"
  fi
  exit 1
fi
