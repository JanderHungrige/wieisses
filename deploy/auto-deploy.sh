#!/usr/bin/env bash
# Poll GHCR and roll out the newest images for one environment. Run from cron through
# deploy/roll-all.sh:
#   deploy/auto-deploy.sh deploy/.env.prod   # prod (172.17.0.1:8082)
#
# Same mechanism as the other projects on this host (TopRun, NinaNatur), per service
# (voice = Thorsten-Voice, app = the survey), each rolled and rolled back on its own:
#   - the image a service runs is kept as :<tag>-previous before a new one starts;
#   - a new image has HEALTH_WAIT_TRIES x HEALTH_WAIT_SLEEP seconds to report healthy;
#   - one that does not is rolled back and remembered in deploy/.state/<env>[.<service>].bad, so
#     the next tick does not roll it forward again (prod would otherwise flap once a minute);
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
# The voice first: the app talks to it, and works without it while it rolls.
SERVICES=(voice app)

# Host-wide lock shared with the other projects on this box (3dmap2, pdf2audiobook): they all use
# one containerd, and a pull racing another project's `docker image prune` loses layers
# mid-extraction ("failed to Lchown … no such file or directory"). That kept the 700 MB Kokoro
# voice image unpullable for 20 minutes on 2026-11-07. WAIT for the lock instead of skipping, so
# a busy minute queues rather than starves. The file is root-owned 0644: open it read-only.
LOCK="${WIEISSES_DEPLOY_LOCK:-/tmp/docker-image-deploy.lock}"
[ -e "$LOCK" ] || : >"$LOCK"
exec 9<"$LOCK"
if ! flock -w 90 9; then
  echo "auto-deploy: shared lock busy for 90s — skipping this tick"
  exit 0
fi

COMPOSE=(docker compose --env-file "$ENV_FILE" -f deploy/compose.app.yml)
mkdir -p "$STATE"

say() {
  local line
  line="$(date -u +%FT%TZ) [$NAME] $*"
  echo "$line"
  echo "$line" >> "$STATE/deploy.log"
}

# The app keeps its original state file name, so an existing <env>.bad still counts.
bad_file() {
  if [ "$1" = app ]; then echo "$STATE/$NAME.bad"; else echo "$STATE/$NAME.$1.bad"; fi
}

container() {
  "${COMPOSE[@]}" ps -q "$1" 2>/dev/null || true
}

running_image() {
  local id
  id="$(container "$1")"
  if [ -n "$id" ]; then docker inspect --format '{{.Image}}' "$id"; fi
}

health() {
  local id
  id="$(container "$1")"
  if [ -z "$id" ]; then echo missing; return; fi
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id" \
    2>/dev/null || echo missing
}

wait_healthy() {
  local i
  for ((i = 0; i < TRIES; i++)); do
    case "$(health "$1")" in
      healthy) return 0 ;;
      unhealthy) return 1 ;;
    esac
    sleep "$PAUSE"
  done
  return 1
}

# Rolls one service; returns non-zero when it ends up unhealthy.
roll() {
  local svc="$1" image tag previous new current bad badf
  image="$("${COMPOSE[@]}" config --images "$svc" | head -n 1)"
  tag="${image##*:}"
  previous="${image%:*}:${tag}-previous"
  badf="$(bad_file "$svc")"

  # Called as `roll … || status=1`, so `set -e` does not apply in here: check each step.
  "${COMPOSE[@]}" pull --quiet "$svc" || { say "✖ $svc: pull of $image failed"; return 1; }
  new="$(docker image inspect --format '{{.Id}}' "$image")" || return 1
  current="$(running_image "$svc")"
  bad="$(cat "$badf" 2>/dev/null || true)"

  if [ "$new" = "$bad" ]; then
    # Failed its health check here already: stay on what runs.
    IMAGE_TAG="${tag}-previous" "${COMPOSE[@]}" up -d "$svc"
    return 0
  fi

  if [ "$new" = "$current" ]; then
    # Nothing new. `up -d` creates a missing service and recreates only when the compose file changed.
    "${COMPOSE[@]}" up -d "$svc"
    return 0
  fi

  if [ -n "$current" ]; then
    docker tag "$current" "$previous"
  fi
  "${COMPOSE[@]}" up -d "$svc"

  if wait_healthy "$svc"; then
    rm -f "$badf"
    say "live $svc: $(docker image inspect --format '{{index .RepoDigests 0}}' "$image")"
    return 0
  fi

  echo "$new" > "$badf"
  if [ -z "$current" ]; then
    say "✖ $svc $new did not become healthy, and there is nothing to go back to"
    return 1
  fi
  say "✖ $svc $new did not become healthy — rolling back to $current"
  IMAGE_TAG="${tag}-previous" "${COMPOSE[@]}" up -d "$svc"
  wait_healthy "$svc" || say "✖ the $svc rollback is not healthy either — this host needs a person"
  return 1
}

status=0
for svc in "${SERVICES[@]}"; do
  roll "$svc" || status=1
done
# Never prune fresh layers: something mid-extraction for another project is untagged too.
docker image prune -f --filter "until=24h" >/dev/null 2>&1 || true
exit "$status"
