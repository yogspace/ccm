#!/usr/bin/env bash
# The uploads (gallery pictures, template SVGs) from production to the local
# media/ folder (`pnpm payload:media:sync`) – incremental, only new or changed
# files.
#
# They live in a Docker named volume on the server, not on a host path. So
# the REMOTE rsync runs in a throwaway container that mounts the volume
# read-only, reached via --rsync-path (the same helper image as the
# portfolio's sync).
set -euo pipefail

REMOTE="${MEDIA_SYNC_REMOTE:-portfolio-server}"
VOLUME="${MEDIA_SYNC_VOLUME:-ccm_media}"
DEST="${MEDIA_SYNC_DEST:-./media}"
IMAGE="media-rsync:local"

mkdir -p "$DEST"

# A tiny helper image (alpine + rsync), built once on the server. With
# --entrypoint rsync the --rsync-path needs no shell and no quotes.
ssh "$REMOTE" "docker image inspect $IMAGE >/dev/null 2>&1 || \
  printf 'FROM alpine\nRUN apk add --no-cache rsync\n' | docker build -t $IMAGE -"

# -rt: recursive with times (enough for a size/mtime diff). No -z: pictures
# are compressed already. No --delete: local uploads stay (MEDIA_SYNC_DELETE=1
# for a true mirror). --stats/--progress so macOS's old rsync joins in.
delete_flag=""
[ "${MEDIA_SYNC_DELETE:-0}" = "1" ] && delete_flag="--delete"

rsync -rt $delete_flag --stats --progress \
  -e ssh \
  --rsync-path="docker run --rm -i -v ${VOLUME}:/data/media:ro --entrypoint rsync $IMAGE" \
  "${REMOTE}:/data/media/" "$DEST/"

echo "✓ Media synced → $DEST"
