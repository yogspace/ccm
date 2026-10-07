#!/usr/bin/env bash
# The production database to the local one (`pnpm payload:db:sync`) – over
# SSH, the database itself is not reachable from outside.
#
# Dumps into a temp file first, so a failed or aborted remote dump shows in
# the exit code, and restores only a plausible dump – otherwise the local
# database stays untouched. A streaming `ssh … | mongorestore --drop` would
# swallow the dump's exit code and could drop the local data half-way.
#
# Needs: the SSH alias (DB_SYNC_REMOTE, default portfolio-server) and the
# local MongoDB from docker-compose.dev.yml running.
set -euo pipefail

REMOTE="${DB_SYNC_REMOTE:-portfolio-server}"
DEV_COMPOSE="${DB_SYNC_DEV_COMPOSE:-docker-compose.dev.yml}"

tmp="$(mktemp -t ccm-dump.XXXXXX)"
trap 'rm -f "$tmp"' EXIT

echo "→ Dumping the production database …"
ssh "$REMOTE" 'cd /opt/apps/ccm && docker compose exec -T mongo mongodump --archive --gzip --db ccm' > "$tmp"

size=$(wc -c < "$tmp")
if [ "$size" -lt 1000 ]; then
  echo "✗ Dump empty or too small (${size} B) – remote error? Stopped, local database untouched." >&2
  exit 1
fi

echo "→ Dump OK (${size} B). Restoring into the local database (--drop) …"
docker compose -f "$DEV_COMPOSE" exec -T mongo mongorestore --archive --gzip --drop < "$tmp"

# The running dev server cached the old content – expire it (no error if it
# is not running).
echo "→ Revalidating …"
pnpm payload:db:revalidate

echo "✓ Database synced."
