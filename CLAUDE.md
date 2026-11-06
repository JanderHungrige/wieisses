# Wie isses? — Project Rules

Tablet survey for primary-school children: coloured topic tabs, every question as picture + text +
read aloud, a self-chosen picture sign instead of a name, one answer per topic and day. Staff see
charts over time in a password-protected admin panel and edit the questions there.
Node 24 + TypeScript (run directly, type stripping), built-in `node:sqlite`, Preact + Vite.

## Workflow
- MDD: feature docs live in `.mdd/docs/` and are the source of truth. Update the doc first.
- Always branch — never commit to `main`. Merging to `main` IS a production deploy.

## Code rules
- TypeScript strict, no `any`. Switches on string unions end with
  `default: throw new Error(\`unhandled: ${x satisfies never}\`)`.
- No file > 300 lines, no function > 50 lines.
- Server is three layers: `server/server.ts` + `server/admin-routes.ts` (routes only) →
  `server/handlers/` (rules, orchestration) → `server/adapters/` (the only code that touches SQLite
  or the file system). Pure logic lives in `server/domain/` with a Vitest test in `tests/unit/`.
- One Zod schema per entity in `shared/schema.ts`, used by server validation and admin forms.
- Server code must stay erasable TypeScript (`erasableSyntaxOnly`): no enums, no parameter
  properties, `.ts` extensions on imports.
- All routes under `/api/v1/`. Every write needs the `X-Wieisses: 1` header (CSRF check).
- Children's data: no names, no IPs in the database, no code ids in exports or logs, no request to
  any other domain (no CDN, no web fonts, no analytics). The admin sees aggregates only.

## Commands
- Node 24 is required: `nvm use` (the Homebrew node on this Mac is 23).
- `npm test` — Vitest (unit + API tests against the real server, in-memory SQLite)
- `npm run typecheck` — web + server
- `npm run dev:server` — API on http://localhost:8092 (dev password `dev-password-123`, data in `.data/`)
- `npm run dev` — Vite on http://localhost:5173, proxies the API
- `DATA_DIR=.data node dev/demo-answers.ts` — eight weeks of demo answers for the dashboard
- `ADMIN_PASSWORD=… docker compose up --build` — app + Thorsten voice on http://localhost:8082
- Voice alone for dev: `docker build -t wieisses-voice:local voice/ && docker run --rm -p 127.0.0.1:5050:5000 wieisses-voice:local`,
  then start the API with `VOICE_URL=http://127.0.0.1:5050`

## Voice (Thorsten)
- Everything the kiosk speaks is a Thorsten clip keyed by voice + speed + normalised text
  (`server/domain/voice-texts.ts`). Fixed kiosk sentences live in `shared/phrases.ts` — never
  write a spoken string inline in a screen or a child-facing server message, or it has no clip.
- Sentences with a variable part are spoken as fixed parts (`sayParts`), never as one string.
- Voicing runs only on "Speichern & vertonen", "Fehlende/Alle vertonen", a changed speech rate
  and server start — never on an individual save (the user's explicit wish).

## Deployment
- Live: https://wieisses.w3rth.de/ — push to `main` → GHCR image → host cron rolls it
  (`deploy/SERVER-SETUP.md`). Port bound to `172.17.0.1:8082` only (Nginx Proxy Manager in front).
- Verify the image locally before relying on CI: `docker build` and a run against a fresh empty volume.
