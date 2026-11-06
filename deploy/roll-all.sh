#!/usr/bin/env bash
# Roll every configured environment, in order, from one cron tick:
#   deploy/roll-all.sh
# An environment whose env file is absent is skipped in silence, so adding deploy/.env.dev
# later needs no cron change. One cron line for all environments — two lines with the same
# offset would race auto-deploy.sh's global lock (`flock -n` makes the loser exit).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENVIRONMENTS=("$@")
[ "$#" -gt 0 ] || ENVIRONMENTS=(prod dev)

for name in "${ENVIRONMENTS[@]}"; do
  file="deploy/.env.$name"
  [ -f "$file" ] || continue
  if ! /usr/bin/env bash deploy/auto-deploy.sh "$file"; then
    echo "roll-all: $name failed — stopping, the rest will be tried next tick" >&2
    exit 1
  fi
done
