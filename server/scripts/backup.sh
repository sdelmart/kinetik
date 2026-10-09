#!/usr/bin/env bash
# Backs up the community server's data/ directory (levels, scores, profiles,
# reports — the only state that isn't reproducible from the repo) to timestamped
# tarballs, and prunes old ones. Meant to run from cron on the Ubuntu host; see
# ../README.md for the crontab line.
set -euo pipefail

SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${DATA_DIR:-$SERVER_DIR/data}"
BACKUP_DIR="${BACKUP_DIR:-$SERVER_DIR/backups}"
KEEP="${KEEP:-14}"

if [ ! -d "$DATA_DIR" ]; then
  echo "[kinetik-backup] $DATA_DIR does not exist, nothing to back up" >&2
  exit 0
fi

mkdir -p "$BACKUP_DIR"
stamp="$(date +%Y%m%d-%H%M%S)"
archive="$BACKUP_DIR/kinetik-data-$stamp.tar.gz"

tar -czf "$archive" -C "$SERVER_DIR" data
echo "[kinetik-backup] wrote $archive"

# Keep only the $KEEP most recent archives.
ls -1t "$BACKUP_DIR"/kinetik-data-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm --
