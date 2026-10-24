#!/bin/sh
set -eu
umask 077
: "${BACKUP_RECIPIENT:?required}" "${BACKUP_REMOTE:?required}" "${BACKUP_HEARTBEAT_URL:?required}"
last_daily=''
last_weekly=''
run_backup() (
  set -eu
  work=$(mktemp -d /tmp/avs-backup.XXXXXX) || exit 1
  trap 'rm -rf "$work"' EXIT
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  pg_dump --format=custom --no-owner --no-acl --exclude-table-data=public.session --file="$work/database.dump" || exit 1
  age -r "$BACKUP_RECIPIENT" -o "$work/database.dump.age" "$work/database.dump" || exit 1
  rclone copyto "$work/database.dump.age" "$BACKUP_REMOTE/hourly/$stamp.dump.age" || exit 1
  if [ "$backup_day" != "$last_daily" ]; then
    rclone copyto "$work/database.dump.age" "$BACKUP_REMOTE/daily/$stamp.dump.age" || exit 1
  fi
  if [ "$backup_week" != "$last_weekly" ]; then rclone copyto "$work/database.dump.age" "$BACKUP_REMOTE/weekly/$stamp.dump.age" || exit 1; fi
  curl --fail --silent --show-error --max-time 15 "$BACKUP_HEARTBEAT_URL" >/dev/null || exit 1
)
while :; do
  backup_day=$(date +%Y%m%d)
  backup_week=$(date +%G%V)
  if run_backup; then
    last_daily=$backup_day
    last_weekly=$backup_week
  else
    curl --fail --silent --show-error --max-time 15 "$BACKUP_HEARTBEAT_URL/fail" >/dev/null || true
    exit 1
  fi
  sleep 3600
done
