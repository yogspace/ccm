#!/usr/bin/env bash
# Installs the server-side cron job for the statistics report
# (/next/cron/stats-digest): once a day; the route itself decides from the
# interval set in the admin whether a report is due, and prunes old rows.
#
# Runs ON THE HETZNER SERVER (not locally) – by the deploy pipeline after
# every deploy, or by hand:
#   cd /opt/apps/ccm && bash scripts/setup-cron.sh
#
# The app has no port on the host – it is only reachable in the Docker network
# (the proxy forwards ccm.mxwr.de to ccm:3000). So the cron calls the route
# INSIDE the ccm container, where localhost:3000 is the app itself – with node,
# which is there anyway (no curl in the image).
#
# Idempotent: replaces a block set earlier by this script (by its markers) and
# leaves other crontab entries alone.
set -euo pipefail

APP_DIR="/opt/apps/ccm"
ENV_FILE="${APP_DIR}/.env"
MARKER="# >>> ccm cron (setup-cron.sh) >>>"
MARKER_END="# <<< ccm cron (setup-cron.sh) <<<"

if [ ! -f "$ENV_FILE" ]; then
  echo "✗ ${ENV_FILE} not found – are you on the server in the app directory?" >&2
  exit 1
fi

# Only CRON_SECRET from the .env, without sourcing the file.
CRON_SECRET="$(grep -E '^CRON_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
if [ -z "${CRON_SECRET}" ]; then
  echo "✗ CRON_SECRET is not set in ${ENV_FILE}." >&2
  exit 1
fi

# The node one-liner follows no redirects and fails on a status other than
# 2xx, so cron and logger see it. Output goes to syslog: journalctl -t ccm-cron
URL="http://localhost:3000/next/cron/stats-digest?secret=${CRON_SECRET}"
STATS_CMD="$(printf 'cd %s && docker compose exec -T ccm node -e '\''const u=process.argv[1];require("http").get(u,r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>{console.log(r.statusCode,d.slice(0,200));process.exit(r.statusCode>=200&&r.statusCode<300?0:1)})}).on("error",e=>{console.error(e.message);process.exit(1)})'\'' %q 2>&1 | logger -t ccm-cron' "$APP_DIR" "$URL")"

# The current crontab WITHOUT our old block.
CURRENT="$(crontab -l 2>/dev/null | sed "/${MARKER}/,/${MARKER_END}/d" || true)"

{
  printf '%s\n' "$CURRENT"
  printf '%s\n' "$MARKER"
  # Daily at 06:15 UTC.
  printf '15 6 * * * %s\n' "$STATS_CMD"
  printf '%s\n' "$MARKER_END"
} | crontab -

echo "✓ Cron installed:"
crontab -l | sed -n "/${MARKER}/,/${MARKER_END}/p"
