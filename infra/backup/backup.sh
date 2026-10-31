#!/bin/sh
#
# Nightly database dump and uploads archive, run in a container beside the
# database. Same approach as the other Gahez services: a loop rather than cron,
# one run on boot, and old files pruned only after a run that worked.
#
# Restoring the database:
#   gunzip -c /srv/backups/live-app-2026-11-01.sql.gz | \
#     docker compose --env-file .env.app -f docker-compose.app.yml exec -T db psql -U live -d live
#
# Restoring uploads (into the app's uploads volume):
#   tar -xzf /srv/backups/live-app-uploads-2026-11-01.tar.gz -C <uploads volume>
#
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
UPLOADS_DIR="${UPLOADS_DIR:-/uploads}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
UPLOADS_KEEP_DAYS="${BACKUP_UPLOADS_KEEP_DAYS:-7}"
PREFIX="${BACKUP_PREFIX:-live-app}"
# Hour of the day, UTC. Cairo is UTC+2 or +3, so this is the quiet part of the night.
RUN_HOUR="${BACKUP_HOUR:-3}"

# These files hold personal data: only the owner may read them.
umask 077

log() { echo "[backup] $(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"; }

dump_database() {
  target="$BACKUP_DIR/$PREFIX-$(date -u '+%Y-%m-%d').sql.gz"
  partial="$target.partial"
  log "dumping to $target"
  # Written to a .partial first: an interrupted dump must not look like a backup.
  if pg_dump --clean --if-exists --no-owner --no-privileges -h "$POSTGRES_HOST" -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip -9 > "$partial"; then
    size=$(wc -c < "$partial")
    # An empty database still dumps a few kilobytes of schema.
    if [ "$size" -lt 1024 ]; then
      log "ERROR dump is only ${size} bytes, keeping the previous one"
      rm -f "$partial"
      return 1
    fi
    mv "$partial" "$target"
    log "database done, ${size} bytes"
  else
    log "ERROR pg_dump failed"
    rm -f "$partial"
    return 1
  fi
  find "$BACKUP_DIR" -name "$PREFIX-20*.sql.gz" -type f -mtime "+$KEEP_DAYS" -delete
}

archive_uploads() {
  target="$BACKUP_DIR/$PREFIX-uploads-$(date -u '+%Y-%m-%d').tar.gz"
  partial="$target.partial"
  log "archiving uploads to $target"
  # .app-assets only holds copies of old app bundles.
  if tar -czf "$partial" -C "$UPLOADS_DIR" --exclude=.app-assets .; then
    mv "$partial" "$target"
    log "uploads done, $(wc -c < "$target") bytes"
  else
    log "ERROR uploads archive failed"
    rm -f "$partial"
    return 1
  fi
  find "$BACKUP_DIR" -name "$PREFIX-uploads-*.tar.gz" -type f -mtime "+$UPLOADS_KEEP_DAYS" -delete
}

run_once() {
  result=0
  dump_database || result=1
  archive_uploads || result=1
  return "$result"
}

seconds_until_run_hour() {
  now_h=$(date -u '+%H')
  now_m=$(date -u '+%M')
  now_s=$(date -u '+%S')
  # Strip leading zeros: 08 and 09 are not valid octal.
  now_h=$((10#$now_h)); now_m=$((10#$now_m)); now_s=$((10#$now_s))
  diff=$((RUN_HOUR * 3600 - (now_h * 3600 + now_m * 60 + now_s)))
  [ "$diff" -le 0 ] && diff=$((diff + 86400))
  echo "$diff"
}

mkdir -p "$BACKUP_DIR"
export PGPASSWORD="$POSTGRES_PASSWORD"

# One on boot, so a broken configuration is obvious immediately.
run_once || log "startup backup failed, will retry at the scheduled hour"

while true; do
  wait_for=$(seconds_until_run_hour)
  log "sleeping ${wait_for}s until the next run"
  sleep "$wait_for"
  run_once || log "scheduled backup failed, will try again tomorrow"
done
