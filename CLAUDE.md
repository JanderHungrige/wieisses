# Wie isses? — Project Rules

Tablet survey for primary-school children: coloured topic tabs, every question as picture + text +
read aloud, a self-chosen picture sign instead of a name, one answer per topic and day. Springy —
the logo with googly eyes — guides the children over a picture-book meadow. Staff see
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
- `DATA_DIR=.data node server/ops/demo.ts add` — eight weeks of removable demo answers for the dashboard
  (`remove` takes them out again; doc 04)
- `DATA_DIR=.data node server/ops/questions.ts export` / `apply [--yes]` — the question tool (doc 04); live it
  runs over SSH: `ssh jan@159.195.148.193 'docker exec -i wieisses-prod-app-1 node server/ops/questions.ts …'`
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
- From the topic page on, every child-facing button has its own 🔊 (`SpeakButton` in
  `web/kiosk/Prompt.tsx`); tapping the button itself never speaks, it only calls `stopSpeech()`
  (the user's explicit wish). Exceptions: the picture-code screens still speak each pick, and
  "Tschüss" says "Tschüss!" — never cut off by the restart that follows.
- The voice is Thorsten-Voice/Kokoro, exported to ONNX in the image's build stage
  (`voice/export.py`). PyTorch never goes into the runtime stage, and onnxruntime's memory
  arena stays off (with the `MALLOC_*` env in `voice/Dockerfile`) — with the arena the service
  grows past its 768 MB limit within a few texts.
- Pronunciation fixes go only into `spokenText()` (`server/domain/voice-texts.ts`): the voice service
  gets the spoken form, the clip key and the screen keep the shown text (Springy → "s Pringy").
- A change to the voice service's audio bumps `CLIP_FORMAT` in `server/domain/voice-texts.ts`
  and rolls out voice first: push the `voice/**` commit alone, wait for the host to roll it,
  then push the app (doc 01, Deployment).

## Kiosk look (doc 02)
- A screen's heading goes through `Prompt` (`web/kiosk/Prompt.tsx`): Springy + speech bubble + 🔊.
  Springy is decoration (`aria-hidden`, no tap target), its mood comes from the phase
  (`springyMood`), and its mouth moves only while the speech queue speaks — it never starts speech.
- Buttons use the NinaNatur "Draft Sketch" tokens in `web/kiosk/kiosk.css` (`--line`, `--edge`,
  `--lift`, `--wash`, `--wash-deep`); a picked state is never colour alone.
- A 🔊 is always `SpeakButton` (`web/kiosk/Prompt.tsx`, styles in `web/kiosk/speak.css`): the drawn
  loudspeaker without a circle, never the 🔊 emoji; its waves pulse while its text is read.
- Animations move only `transform`/`opacity`; `prefers-reduced-motion` stills every one.
- Everything is bundled (font, meadow, logo); AI-made pictures are listed in `THIRD_PARTY.md`.

## Deployment
- Tablets pick up a new build by reloading themselves between two children (`restart` in
  `web/kiosk/useKiosk.ts`, `web/lib/app-version.ts`). Never reload during a child's session.
- Live: https://wieisses.w3rth.de/ — push to `main` → GHCR image → host cron rolls it
  (`deploy/SERVER-SETUP.md`). Port bound to `172.17.0.1:8082` only (Nginx Proxy Manager in front).
- Verify the image locally before relying on CI: `docker build` and a run against a fresh empty volume.
