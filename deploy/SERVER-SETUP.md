# wieisses — host setup

One-time steps on the host (159.195.148.193). After this, every push to `main` is live within
about a minute with no manual action — the same mechanism as TopRun and NinaNatur.

| | |
|---|---|
| Domain | `wieisses.w3rth.de` (Nginx Proxy Manager, already pointing at `http://172.17.0.1:8082`) |
| Image | `ghcr.io/janderhungrige/wieisses:main`, built by `.github/workflows/deploy.yml` |
| Checkout | `/opt/wieisses` |
| Env file | `deploy/.env.prod` (gitignored, holds the admin password) |
| Cron | root, offset `:23` |
| Data | named volume `wieisses-prod_wieisses-data` → `/data` |

## 1. Clone and configure

```bash
sudo git clone https://github.com/JanderHungrige/wieisses.git /opt/wieisses
sudo chown -R "$USER":"$(id -gn)" /opt/wieisses
cd /opt/wieisses
cp deploy/.env.prod.example deploy/.env.prod
chmod 600 deploy/.env.prod
nano deploy/.env.prod        # set ADMIN_PASSWORD (≥ 10 characters)
```

## 2. GHCR access

The workflow pushes `ghcr.io/janderhungrige/wieisses`. Check once that the host can pull it
without logging in:

```bash
docker logout ghcr.io
docker pull ghcr.io/janderhungrige/wieisses:main
```

If this answers `denied` / `unauthorized`, the package is private: make it public under
`github.com/users/JanderHungrige/packages/container/wieisses/settings`, or log the host in once.
A private package with no login makes the cron fail **silently every minute** while the site
simply never updates.

## 3. First start

```bash
cd /opt/wieisses
docker compose --env-file deploy/.env.prod -f deploy/compose.app.yml up -d
curl -i --max-time 5 http://172.17.0.1:8082/healthz     # {"status":"ok","environment":"prod"}
```

A fresh volume migrates itself and seeds the four starter topics; the log says so:

```bash
docker logs wieisses-prod-app-1 | head -3   # database migrated … starter content seeded … listening
```

## 4. Cron

```bash
sudo deploy/install-cron.sh          # or paste the line from deploy/crontab.example
tail -f /var/log/wieisses-deploy.log
```

One line for all environments; `deploy/roll-all.sh` skips an env file that does not exist. The
leading `sleep 23` keeps this deploy off the minutes the others use (:00, :08, :15, :30, :45).

## 5. Backups

Nightly from the operator's crontab (docker works without sudo there):

```bash
mkdir -p ~/backups/wieisses
( crontab -l 2>/dev/null; echo '41 3 * * * /opt/wieisses/deploy/backup.sh >> $HOME/backups/wieisses/backup.log 2>&1' ) | crontab -
```

Each night keeps a checked copy inside the volume (`/data/backups`, 14) and one on the host
(`~/backups/wieisses/prod`, 30). Pull `~/backups/wieisses` to another machine for the case of
losing the host.

**Restore** — always look at a copy first:

```bash
docker exec wieisses-prod-app-1 node server/ops/backup.ts verify /data/backups/<file>.sqlite.gz
cd /opt/wieisses
docker compose --env-file deploy/.env.prod -f deploy/compose.app.yml stop app
docker compose --env-file deploy/.env.prod -f deploy/compose.app.yml run --rm --no-deps app \
  node server/ops/backup.ts restore /data/backups/<file>.sqlite.gz /data/wieisses.sqlite --replace
docker compose --env-file deploy/.env.prod -f deploy/compose.app.yml start app
```

A copy that exists only on the host goes back into the volume first:
`docker cp ~/backups/wieisses/prod/<file>.sqlite.gz wieisses-prod-app-1:/data/backups/`.

## 6. Tablets

1. On each tablet open `https://wieisses.w3rth.de/admin/`, log in, **Tablets → Dieses Gerät
   freischalten**, give it a name.
2. Open `https://wieisses.w3rth.de/` and add it to the home screen.
3. iPad: turn on *Guided Access* (Bedienungshilfen → Geführter Zugriff) so the children stay in
   the survey. Android: *screen pinning*.
4. Read-aloud uses the tablet's German voice — iPads have one; on Android install the Google
   speech service's German voice. Questions can also get their own recording in the editor.

A lost tablet: **Tablets → Sperren**. Its browser can no longer vote.

## Rollouts

`deploy/auto-deploy.sh` tags the running image `:main-previous` before starting a new one, gives
it 120 s to report healthy, and otherwise rolls back and remembers the bad image in
`deploy/.state/prod.bad` so it is not retried every minute. Every roll is in
`deploy/.state/deploy.log`.

```bash
tail deploy/.state/deploy.log
sudo rm deploy/.state/prod.bad        # try a build marked bad once more
```

A compose change does **not** reach the host by itself — the cron pulls images, never git.
After merging a change under `deploy/`, run `cd /opt/wieisses && git pull`.

## Troubleshooting

Never diagnose with `curl -s` alone — on a refused connection it prints nothing. Use `curl -i`.

| Symptom | Likely cause |
|---|---|
| 502 from NPM | container down, or NPM forwards to the wrong port |
| Site never updates, cron log empty | crontab not installed |
| `denied` / `unauthorized` in the log | GHCR package private, host not logged in (step 2) |
| Container restarts at once | `ADMIN_PASSWORD` missing or shorter than 10 characters — `docker logs` says so |
| Kiosk says "nicht freigeschaltet" | that browser was never registered, or was revoked (step 6) |
| Answers vanish after a deploy | the named volume is not mounted — check `volumes:` in `deploy/compose.app.yml` |

**Do not** `docker compose … down -v` — it deletes the volume and every answer with it.
