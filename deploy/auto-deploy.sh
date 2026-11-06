#!/usr/bin/env bash
# Poll GHCR and roll out the newest image for one environment. Run from cron through
# deploy/roll-all.sh:
#   deploy/auto-deploy.sh deploy/.env.prod   # prod (172.17.0.1:8082)
#
# Same mechanism as the other projects on this host (TopRun, NinaNatur):
#   - the image that runs is kept as :<tag>-previous before a new one starts;
#   - a new image has HEALTH_WAIT_TRIES x HEALTH_WAIT_SLEEP seconds to report healthy;
#   - one that does not is rolled back and remembered in deploy/.state/<env>.bad, so the next
#     tick does not roll it forward again (prod would otherwise flap once a minute);
#   - every roll is written, with its digest, to deploy/.state/deploy.log.
# Uses the HOST docker (no Watchtower) so there is never a client-version mismatch.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${1:?usage: auto-deploy.sh <env-file> (e.g. deploy/.env.prod)}"
[ -f "$ENV_FILE" ] || { echo "✖ no such env-file: $ENV_FILE" >&2; exit 1; }
NAME="$(basename "$ENV_FILE")"
NAME="${NAME#.env.}"
STATE="${WIEISSES_DEPLOY_STATE:-$ROOT/deploy/.state}"
TRIES="${HEALTH_WAIT_TRIES:-24}"
PAUSE="${HEALTH_WAIT_SLEEP:-5}"
SVC=app

# Two overlapping runs racing the same image pull corrupt the containerd content store.
exec 9>"${WIEISSES_DEPLOY_LOCK:-/tmp/wieisses-auto-deploy.lock}"
if ! flock -n 9; then
  echo "auto-deploy: another run holds the lock — skipping this tick"
  exit 0
fi

COMPOSE=(docker compose --env-file "$ENV_FILE" -f deploy/compose.app.yml)
mkdir -p "$STATE"
BAD="$STATE/$NAME.bad"

say() {
  local line
  line="$(date -u +%FT%TZ) [$NAME] $*"
  echo "$line"
  echo "$line" >> "$STATE/deploy.log"
}

container() {
  "${COMPOSE[@]}" ps -q "$SVC" 2>/dev/null || true
}

running_image() {
  local id
  id="$(container)"
  if [ -n "$id" ]; then docker inspect --format '{{.Image}}' "$id"; fi
}

health() {
  local id
  id="$(container)"
  if [ -z "$id" ]; then echo missing; return; fi
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id" \
    2>/dev/null || echo missing
}

wait_healthy() {
  local i
  for ((i = 0; i < TRIES; i++)); do
    case "$(health)" in
      healthy) return 0 ;;
      unhealthy) return 1 ;;
    esac
    sleep "$PAUSE"
  done
  return 1
}

IMAGE="$("${COMPOSE[@]}" config --images "$SVC" | head -n 1)"
TAG="${IMAGE##*:}"
PREVIOUS="${IMAGE%:*}:${TAG}-previous"

"${COMPOSE[@]}" pull --quiet "$SVC" || { say "✖ pull of $IMAGE failed"; exit 1; }
NEW="$(docker image inspect --format '{{.Id}}' "$IMAGE")"
CURRENT="$(running_image)"
KNOWN_BAD="$(cat "$BAD" 2>/dev/null || true)"

if [ "$NEW" = "$KNOWN_BAD" ]; then
  # Failed its health check here already: stay on what runs.
  IMAGE_TAG="${TAG}-previous" "${COMPOSE[@]}" up -d "$SVC"
  exit 0
fi

if [ "$NEW" = "$CURRENT" ]; then
  # Nothing new. `up -d` creates a missing service and recreates only when the compose file changed.
  "${COMPOSE[@]}" up -d "$SVC"
  exit 0
fi

if [ -n "$CURRENT" ]; then
  docker tag "$CURRENT" "$PREVIOUS"
fi
"${COMPOSE[@]}" up -d "$SVC"

if wait_healthy; then
  rm -f "$BAD"
  say "live: $(docker image inspect --format '{{index .RepoDigests 0}}' "$IMAGE")"
  docker image prune -f >/dev/null 2>&1 || true
  exit 0
fi

echo "$NEW" > "$BAD"
if [ -z "$CURRENT" ]; then
  say "✖ $NEW did not become healthy, and there is nothing to go back to"
  exit 1
fi
say "✖ $NEW did not become healthy — rolling back to $CURRENT"
IMAGE_TAG="${TAG}-previous" "${COMPOSE[@]}" up -d "$SVC"
wait_healthy || say "✖ the rollback is not healthy either — this host needs a person"
exit 1
