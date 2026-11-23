#!/bin/sh
# Downloads a free DB-IP database (CC BY 4.0, attribution required) for the
# analytics' `TRACKING.origin` on a self-hosted server: "IP to Country Lite"
# by default – the IP is only looked up in it, never stored (stats/geoip.ts).
# Pass `city` as the second argument for "IP to City Lite" (region and city
# too – larger, and more telling per row).
#
# DB-IP publishes monthly; early in the month the new one may still be
# missing, then last month's is used. Never fails: without a database the
# locations stay empty and everything else keeps running. POSIX sh, so it
# also runs in an Alpine image (Dockerfile, runner stage).
#
#   sh scripts/geoip-download.sh [target] [country|city]
#   (default: ./geoip/dbip-country-lite.mmdb)
set -eu

edition="${2:-country}"
case "$edition" in
  country | city) ;;
  *)
    echo "GeoIP: unknown edition \"$edition\" – use country or city." >&2
    exit 0
    ;;
esac
target="${1:-./geoip/dbip-$edition-lite.mmdb}"
mkdir -p "$(dirname "$target")"

this_month="$(date -u +%Y-%m)"
# The month before without GNU date: step year and month back by hand.
year="$(date -u +%Y)"
month="$(date -u +%m | sed 's/^0//')"
if [ "$month" -eq 1 ]; then
  last_month="$((year - 1))-12"
else
  last_month="$(printf '%s-%02d' "$year" "$((month - 1))")"
fi

for m in "$this_month" "$last_month"; do
  url="https://download.db-ip.com/free/dbip-$edition-lite-$m.mmdb.gz"
  if wget -q -O "$target.gz" "$url" 2>/dev/null || curl -fsSL -o "$target.gz" "$url" 2>/dev/null; then
    # A broken download must not fail the build either.
    if gunzip -f "$target.gz" 2>/dev/null; then
      echo "GeoIP: $edition $m → $target"
      exit 0
    fi
  fi
done

rm -f "$target.gz"
echo "GeoIP: no database downloaded – locations stay empty, analytics keep running." >&2
exit 0
