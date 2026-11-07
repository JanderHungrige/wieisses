---
id: 01-schul-umfrage
title: Schul-Umfrage — tablet survey for primary school children with admin panel
edition: wieisses
depends_on: []
relates: []
source_files:
  - shared/catalog.ts
  - shared/phrases.ts
  - shared/schema.ts
  - server/domain/voice-texts.ts
  - server/adapters/voice-store.ts
  - server/adapters/voice-client.ts
  - server/handlers/voice-queue.ts
  - server/handlers/voice.ts
  - web/admin/drafts.ts
  - web/admin/pages/TopicEditor.tsx
  - web/admin/pages/VoicePanel.tsx
  - voice/server.py
  - voice/audio.py
  - voice/kokoro_voice.py
  - voice/export.py
  - voice/requirements-export.txt
  - voice/Dockerfile
  - voice/requirements.txt
  - voice/THIRD_PARTY.md
  - .github/workflows/voice.yml
  - server/main.ts
  - server/config.ts
  - server/context.ts
  - server/log.ts
  - server/server.ts
  - server/admin-routes.ts
  - server/seed.ts
  - server/http/dispatch.ts
  - server/http/reply.ts
  - server/http/request.ts
  - server/http/router.ts
  - server/http/static.ts
  - server/domain/answers.ts
  - server/domain/csv.ts
  - server/domain/day.ts
  - server/domain/media-type.ts
  - server/domain/rate-limit.ts
  - server/domain/secrets.ts
  - server/domain/sessions.ts
  - server/domain/stats.ts
  - server/handlers/access.ts
  - server/handlers/admin-auth.ts
  - server/handlers/content.ts
  - server/handlers/health.ts
  - server/handlers/kiosk.ts
  - server/handlers/media.ts
  - server/handlers/results.ts
  - server/adapters/db.ts
  - server/adapters/access-store.ts
  - server/adapters/content-store.ts
  - server/adapters/content-write.ts
  - server/adapters/media-store.ts
  - server/adapters/results-store.ts
  - server/adapters/settings-store.ts
  - server/adapters/submission-store.ts
  - server/ops/backup.ts
  - web/lib/api.ts
  - web/lib/speech.ts
  - web/lib/clip-cache.ts
  - web/index.html
  - web/kiosk/main.tsx
  - web/kiosk/Kiosk.tsx
  - web/kiosk/useKiosk.ts
  - web/kiosk/useIdle.ts
  - web/kiosk/CodePicker.tsx
  - web/kiosk/QuestionFlow.tsx
  - web/kiosk/Prompt.tsx
  - web/kiosk/screens.tsx
  - web/kiosk/kiosk.css
  - web/admin/index.html
  - web/admin/main.tsx
  - web/admin/App.tsx
  - web/admin/adminApi.ts
  - web/admin/charts.tsx
  - web/admin/colours.ts
  - web/admin/fields.tsx
  - web/admin/format.ts
  - web/admin/admin.css
  - web/admin/pages/Codes.tsx
  - web/admin/pages/Content.tsx
  - web/admin/pages/Dashboard.tsx
  - web/admin/pages/Devices.tsx
  - web/admin/pages/Filters.tsx
  - web/admin/pages/QuestionEditor.tsx
  - web/admin/pages/Settings.tsx
  - web/admin/pages/TopicResults.tsx
  - dev/demo-answers.ts
  - Dockerfile
  - docker-compose.yml
  - deploy/compose.app.yml
  - deploy/auto-deploy.sh
  - deploy/roll-all.sh
  - deploy/install-cron.sh
  - deploy/backup.sh
  - deploy/SERVER-SETUP.md
  - .github/workflows/deploy.yml
  - .github/workflows/healthz.yml
routes:
  - GET /healthz
  - GET /api/v1/kiosk/config
  - POST /api/v1/kiosk/codes
  - POST /api/v1/kiosk/session
  - POST /api/v1/kiosk/submissions
  - POST /api/v1/admin/login
  - POST /api/v1/admin/logout
  - GET /api/v1/admin/me
  - GET|POST /api/v1/admin/topics
  - PATCH|DELETE /api/v1/admin/topics/:id
  - POST /api/v1/admin/topics/:id/questions
  - PATCH|DELETE /api/v1/admin/questions/:id
  - POST /api/v1/admin/questions/:id/options
  - PATCH|DELETE /api/v1/admin/options/:id
  - POST /api/v1/admin/media
  - GET /api/v1/admin/codes
  - PATCH /api/v1/admin/codes/:id
  - GET|POST /api/v1/admin/devices
  - PATCH /api/v1/admin/devices/:id
  - GET|PUT /api/v1/admin/settings
  - GET /api/v1/admin/results/summary
  - GET /api/v1/admin/results/questions/:id
  - GET /api/v1/admin/results/export.csv
  - GET /api/v1/admin/voice
  - POST /api/v1/admin/voice/generate
  - POST /api/v1/admin/voice/clip
  - GET /media/:file
  - "voice service (internal): GET /healthz, POST /synthesize"
models:
  - topic
  - question
  - answer_option
  - child_code
  - submission
  - answer
  - device
  - admin_session
  - setting
  - voice_clip
test_files:
  - tests/unit/day.test.ts
  - tests/unit/codes.test.ts
  - tests/unit/answers.test.ts
  - tests/unit/stats.test.ts
  - tests/api/kiosk.test.ts
  - tests/api/admin.test.ts
  - tests/api/results.test.ts
  - tests/api/harness.ts
  - tests/unit/voice-texts.test.ts
  - tests/api/voice.test.ts
  - tests/api/fake-voice.ts
  - tests/unit/clip-cache.test.ts
  - voice/test_audio.py
  - voice/test_kokoro_voice.py
data_flow: greenfield
last_synced: 2026-11-07
status: in_progress
phase: all
mdd_version: 11
tags: [survey, kiosk, tablet, primary-school, accessibility, speech-synthesis, thorsten-voice, kokoro, onnx, read-aloud-buttons, admin-panel, sqlite]
path: Umfrage
integration_contracts: []
satisfies_contracts: []
known_issues: []
security_read_sites: []
sister_projects: [~/Code/TopRun, ~/Code/NinaNatur]
---

# 01 — Schul-Umfrage

## Purpose

Children of a primary school (grades 1–4, ages 6–10) give their opinion on everyday
topics — lunch, homework supervision, the carers, the activities on offer — on shared
tablets, daily or whenever they like. Every question is shown as a **picture, as text and
read aloud**, so a child who cannot read yet can answer alone. Staff see the results over
time, as charts, in a password-protected admin panel, and maintain the topics and questions
there. Everything the kiosk says is spoken in one voice — **Thorsten-Voice** (Kokoro, the
StyleTTS2 model fine-tuned on Thorsten's recordings; until 2026-11-07 Piper "high"),
generated on the server when the admin saves their changes.

Live at `https://wieisses.w3rth.de` (Nginx Proxy Manager → `172.17.0.1:8082`).

## Architecture

```
tablet (kiosk SPA, /)          admin browser (admin SPA, /admin/)
        │  device cookie                │  admin session cookie
        ▼                               ▼
┌────────────────────────── Node 24 container :8080 ──────────────────────────┐
│ server/main.ts      process lifecycle (listen, SIGTERM drain, crash = exit 1)│
│ server/server.ts    routes only: request in → handler → response out         │
│ server/handlers/    kiosk, admin-auth, content, access (codes, devices,      │
│                     settings), results, media — orchestration, owns rules    │
│ server/domain/      pure functions: Berlin day, code alphabet, answer        │
│                     validation, statistics, secrets, rate limits             │
│ server/adapters/    node:sqlite (DatabaseSync) + media files on /data        │
│ shared/             Zod schemas + answer/code catalogue + fixed kiosk phrases│
└──────────────────────────────── /data volume ───────────────────────────────┘
        │ http://voice:5000 (compose network only)   wieisses.sqlite, media/, backups/
        ▼
┌──── voice container (Python 3.12 + onnxruntime + Thorsten-Voice/Kokoro as ONNX) ────┐
│ voice/server.py        POST /synthesize {text, lengthScale} → audio/mpeg (via lame) │
│ voice/kokoro_voice.py  German G2P (misaki + espeak-ng) → tokens → ONNX → 24 kHz PCM │
│                        one at a time, ≤ 1 CPU, model released after 120 s idle      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

- **Runtime:** Node 24 runs the TypeScript directly (type stripping, like TopRun's ladder
  service). Only runtime dependency: `zod`. Database: built-in `node:sqlite`.
- **Frontend:** Vite multi-page build, Preact + TSX. Two entry points: the kiosk (`/`) and
  the admin panel (`/admin/`). Charts with Chart.js. Font: Andika (SIL OFL, designed for
  beginning readers), self-hosted. **No request ever leaves the site** (no CDN, no web
  fonts, no analytics) — a school's data-protection requirement.
- **Schemas:** one Zod schema per entity in `shared/schema.ts`; server validation, admin
  forms and the TypeScript types all derive from it.
- **Static files** (built SPA + `/media/*` uploads and voice clips) are served by the same
  Node process.
- **Voice:** a second container turns text into Thorsten speech. The app keeps a queue, asks
  the voice service one text at a time, and stores the MP3 as a clip; the kiosk only ever
  downloads finished clips from `/media`. Without `VOICE_URL` (tests, plain dev) the voice
  feature is off and the kiosk falls back to the tablet's own voice.

## Data Model

SQLite, one file `/data/wieisses.sqlite`, schema created and migrated at startup
(`PRAGMA user_version`), WAL mode, `foreign_keys = ON`.

| Table | Columns | Notes |
|---|---|---|
| `topic` | id, name, color (`#rrggbb`), icon (emoji), image_url?, sort, active, created_at | one tab each |
| `question` | id, topic_id → topic, kind (`scale5`\|`scale3`\|`yesno`\|`choice`), multi (bool, choice only), text, icon (emoji), image_url?, audio_url?, frequency (`core`\|`extended`), sort, active, created_at | |
| `answer_option` | id, question_id → question, label, icon, image_url?, sort, active | only for `choice` |
| `child_code` | id, animal, color, fruit, grade (int), device_id → device, active, created_at | UNIQUE(animal, color, fruit); chosen by the child |
| `submission` | id, code_id → child_code, topic_id → topic, day (`YYYY-MM-DD`, Europe/Berlin), extended (bool), created_at | UNIQUE(code_id, topic_id, day) |
| `answer` | id, submission_id → submission, question_id → question, value INTEGER?, option_id → answer_option? | one row per answered question; a multi-choice answer is one row per picked option |
| `device` | id, label, token_hash (sha256), created_at, last_seen_at, revoked | registered tablets |
| `admin_session` | token_hash (PK), created_at, expires_at | |
| `setting` | key (PK), value (JSON) | see Settings |
| `voice_clip` | key (PK, sha256 hex of `thorsten-kokoro|v2|<lengthScale>|<text>`; `v2` = clip format, see Voice), text, url, created_at | one MP3 per distinct spoken text; file `/data/media/<key[0..32]>.mp3` |

Indexes: `submission(day)`, `submission(topic_id, day)`, `answer(question_id)`,
`answer(submission_id)`.

Questions, options and topics are **never hard-deleted once answered** — `DELETE` is refused
with 409 and the admin deactivates instead, so history keeps its meaning.

### Answer catalogue (`shared/catalog.ts`)

| kind | answers (value, face, spoken label) |
|---|---|
| `scale5` | 5 😄 Super · 4 🙂 Gut · 3 😐 Geht so · 2 🙁 Nicht so gut · 1 😢 Schlecht |
| `scale3` | 3 😄 Gut · 2 😐 Geht so · 1 🙁 Nicht gut |
| `yesno` | 1 👍 Ja · 0 👎 Nein |
| `choice` | the question's own options (picture + label), single or multiple |

### Picture code alphabet (`shared/catalog.ts`)

12 animals × 8 colours × 8 fruits = **768 codes**.
Animals 🦊 Fuchs 🐶 Hund 🐱 Katze 🐰 Hase 🐻 Bär 🐼 Panda 🐸 Frosch 🦁 Löwe 🐵 Affe 🐧 Pinguin
🐢 Schildkröte 🦉 Eule · Colours Rot Blau Grün Gelb Lila Orange Rosa Braun · Fruits 🍎 Apfel
🍌 Banane 🍓 Erdbeere 🍇 Trauben 🍐 Birne 🍒 Kirschen 🍋 Zitrone 🍉 Melone.

### Fixed kiosk phrases (`shared/phrases.ts`)

Every sentence the kiosk speaks that is not admin content: prompts of each screen, the names of
all animals, colours and fruits, the face labels, "Klasse 1" … "Klasse 6", "Überspringen",
"Fertig", "Danke!", "Tschüss!", the kind refusals ("Das hast du heute schon gemacht. Morgen
wieder!", "Dieses Zeichen hat schon jemand …", "Kurze Pause! …"). The kiosk screens and the
server's child-facing messages use these constants, so the spoken text and its clip always
match character for character. Sentences with a variable part are spoken as a sequence of
fixed parts — e.g. *"Das ist jetzt dein Geheimzeichen:"* · *Fuchs* · *Blau* · *Apfel* ·
*"Merk es dir gut!"* — so no clip is ever needed for one of the 768 combinations.

### Settings (`setting` table, defaults)

| key | default | meaning |
|---|---|---|
| `title` | `"Wie isses?"` | start-screen title |
| `extendedWeekdays` | `[5]` | ISO weekdays (1 = Mon … 7 = Sun) on which `extended` questions are added |
| `autoRead` | `true` | read each question aloud when it appears |
| `speechRate` | `0.9` | 0.6–1.3; tablet voice rate, and the clips' `lengthScale = round(1 / speechRate, 2)`, which the voice service turns into Kokoro's speed `round((1 / 0.9) / lengthScale, 2)` — so the default 0.9 speaks at Kokoro's own pace (speed 1.0, chosen by ear on 2026-11-07); changing it re-voices everything |
| `idleSeconds` | `90` | kiosk returns to the start screen after this much inactivity (20–600) |
| `grades` | `[1, 2, 3, 4]` | grades a new child can pick (1–6; Berlin/Brandenburg primary schools run to 6) |

### Starter content (seeded only into an empty database; afterwards it belongs to the admin)

| Tab | Colour | Core questions | Extended questions |
|---|---|---|---|
| 🍽️ Essen | orange | Wie hat dir das Essen heute geschmeckt? (scale5) · Bist du satt geworden? (yesno) | Was isst du am liebsten? (choice, multi) · Hattest du genug Zeit zum Essen? (yesno) · Wie laut war es beim Essen? (choice: leise/mittel/laut) |
| 📚 Hausaufgaben | blue | Wie gut konntest du heute deine Hausaufgaben machen? (scale5) · Hat dir jemand geholfen, wenn du Hilfe gebraucht hast? (choice: ja/nein/brauchte keine) | War es ruhig genug zum Arbeiten? (scale3) · Hattest du genug Zeit? (yesno) |
| 🤝 Miteinander | green | Hast du dich heute wohlgefühlt? (scale5) · Haben dir die Erwachsenen heute zugehört? (scale5) | Kannst du zu einem Erwachsenen gehen, wenn du traurig bist? (yesno) · Werden Streits fair gelöst? (scale3) · Hat dich heute jemand gelobt? (yesno) |
| 🎨 Spielen & Basteln | purple | Wie hat dir heute gefallen, was du gemacht hast? (scale5) · Was hast du heute gemacht? (choice, multi: draußen, basteln, malen, lesen, bauen, Brettspiele, Musik, ausruhen) | Was möchtest du öfter machen? (choice, multi) · Gibt es genug Spielsachen und Material? (scale3) |

## API Endpoints

All JSON. Errors: `{ "error": "<code>", "message": "<German, adult-facing>" }`.
Mutating requests (`POST`/`PUT`/`PATCH`/`DELETE`) must carry the header `X-Wieisses: 1`
(else 403 `csrf`) — a custom header cannot be sent cross-site without a CORS preflight,
which the server never grants.

### Health
- `GET /healthz` → 200 `{ status: "ok", environment: "<APP_ENV>" }` (DB reachable), 503 otherwise.

### Kiosk (tablet) — require a registered device (`wi_device` cookie)
- `GET /api/v1/kiosk/config` → 200 `{ title, today, extendedToday, settings: {autoRead, speechRate, idleSeconds, grades}, topics: [{ id, name, color, icon, imageUrl, questions: [{ id, kind, multi, text, icon, imageUrl, audioUrl, options: [...] }] }], voice: { "<text>": "/media/<key>.mp3", … } }` — only active topics/questions/options; `extended` questions only when `extendedToday`; `voice` holds a clip for every fixed phrase and every topic name, question text and option label of this config that has been voiced (missing ones are simply absent). 403 `device_not_registered`.
- `POST /api/v1/kiosk/codes` `{ animal, color, fruit, grade }` (a new child picks a sign) → 201 `{ token, expiresInSeconds, doneTopicIds: [] }`. 409 `code_taken`, 429 `too_many_new_codes` (> 10 new codes per device in 10 min), 400 `validation` (incl. a grade not in `grades`), 403 `device_not_registered`.
- `POST /api/v1/kiosk/session` `{ animal, color, fruit }` → 200 `{ token, expiresInSeconds, doneTopicIds }`. 404 `unknown_code` (also for an inactive code), 429 `too_many_attempts` (> 20 failed attempts per device in 10 min), 400 `validation`, 403 `device_not_registered`.
- `POST /api/v1/kiosk/submissions` (`Authorization: Bearer <token>`) `{ topicId, answers: [{ questionId, value? , optionIds? }] }` → 201 `{ doneTopicIds }`. 409 `already_answered`, 401 `session_expired`, 400 `validation` (see Business Rules), 403 `device_not_registered`.

### Admin — require the admin session cookie (`wi_admin`), except login
- `POST /api/v1/admin/login` `{ password }` → 204 + cookie. 401 `wrong_password`, 429 `too_many_attempts` (10 failures / 15 min / client IP).
- `POST /api/v1/admin/logout` → 204. `GET /api/v1/admin/me` → 200 `{ ok: true }` | 401 `not_logged_in`.
- Topics: `GET /api/v1/admin/topics` → all topics (incl. inactive) with questions and options and per-item `answerCount` and `voiceUrl` (the current Thorsten clip of the name/text/label, or `null`). `POST /api/v1/admin/topics` → 201 topic. `PATCH /api/v1/admin/topics/:id` (name, color, icon, imageUrl, sort, active) → 200. `DELETE` → 204 | 409 `in_use`.
- Questions: `POST /api/v1/admin/topics/:id/questions` → 201. `PATCH /api/v1/admin/questions/:id` (text, icon, imageUrl, audioUrl, frequency, sort, active, multi) → 200; `kind` is immutable once answered (409 `in_use`). `DELETE` → 204 | 409 `in_use`.
- Options: `POST /api/v1/admin/questions/:id/options` (choice questions only, else 400) → 201. `PATCH /api/v1/admin/options/:id` → 200. `DELETE` → 204 | 409 `in_use`.
- `POST /api/v1/admin/media` raw body with `Content-Type: image/png|image/jpeg|image/webp|audio/mpeg|audio/mp4|audio/ogg|audio/wav` → 201 `{ url: "/media/<random>.<ext>" }`. 415 `unsupported_type` (content type AND magic bytes must match), 413 `too_large` (image 2 MB, audio 5 MB).
- Codes: `GET /api/v1/admin/codes?grade=&active=` → list `{ id, animal, color, fruit, grade, deviceLabel, active, createdAt }` plus `newPerDay` for the last 14 days. `PATCH /api/v1/admin/codes/:id` `{ active?, grade? }` → 200.
- Devices: `GET /api/v1/admin/devices` → list (no tokens). `POST /api/v1/admin/devices` `{ label }` → 201 and sets the `wi_device` cookie **on the calling browser** (the admin registers the tablet from the tablet itself). `PATCH /api/v1/admin/devices/:id` `{ revoked?, label? }` → 200.
- Settings: `GET /api/v1/admin/settings` → 200 settings. `PUT /api/v1/admin/settings` (full object) → 200 | 400. A changed `speechRate` starts re-voicing everything.
- Voice:
  - `GET /api/v1/admin/voice` → `{ configured, reachable, voice: "Thorsten (Kokoro)", lengthScale, total, ready, queued, working: text|null, failed: [{ text, message }] }` — `total` = distinct texts that should have a clip.
  - `POST /api/v1/admin/voice/generate` `{ mode: "missing" | "all" }` → 202 status. `missing` voices every wanted text without a clip (what "Speichern & vertonen" calls); `all` re-voices everything. 503 `voice_unavailable` when `VOICE_URL` is not configured.
  - `POST /api/v1/admin/voice/clip` `{ text }` → 202 status; re-voices one text ("Neu vertonen"). 400 `validation` when the text is not one the kiosk speaks.
- Voice service (internal, compose network only, never published):
  - `GET /healthz` → `{ status: "ok", voice: "thorsten-voice-kokoro" }`.
  - `POST /synthesize` `{ text (1–400 chars), lengthScale (0.7–1.7) }` → 200 `audio/mpeg`; 400 for anything else; one synthesis at a time (a second request waits).
- Results:
  - `GET /api/v1/admin/results/summary?from&to&grade&bucket=day|week|month` → per topic: `submissions`, `children` (distinct codes), `index` (0–100, mean of normalised scale answers), `previous` (same metrics for the preceding range of equal length) and `series: [{ bucket, submissions, index }]`; plus totals.
  - `GET /api/v1/admin/results/questions/:id?from&to&grade&bucket` → `{ question, n, distribution: [{ value|optionId, label, count }], mean?, series: [{ bucket, n, distribution }] }`.
  - `GET /api/v1/admin/results/export.csv?from&to&grade` → `text/csv` (UTF-8 BOM, `;`-separated for German Excel): day, grade, topic, question, kind, answer value, answer label, extended. **No code id.**
- `GET /media/:file` → the uploaded file (public — the kiosk shows it), `nosniff`, long cache.

## Business Rules

### The child's flow (kiosk)
1. **Start screen** — title + one big "Los geht's" button (this tap also unlocks audio on iOS).
2. **Picture code** — first *"Hast du schon ein Geheimzeichen?"*: **"Ja, ich habe eins 🔑"** /
   **"Ich bin neu ✨"**. Then three steps, one per screen: *Welches Tier?* → *Welche Farbe?* →
   *Welches Obst?* Each step is read aloud, each choice speaks its name when tapped, the
   picks so far are shown at the top, a back arrow undoes the last pick.
   - Returning: unknown code → *"Das Zeichen kenne ich nicht. Probier es nochmal!"* with
     "Nochmal" and "Ich bin neu".
   - New: a fourth step *"In welche Klasse gehst du?"* (big numbers from `grades`). A taken
     combination → *"Dieses Zeichen hat schon jemand. Such dir ein anderes aus!"* and back to
     the fruit step. Success → the sign shown big and read aloud: *"Das ist jetzt dein
     Geheimzeichen: Fuchs, Blau, Apfel. Merk es dir gut!"* → "Verstanden".
3. **Topic tabs** across the top, each in its colour with icon and name. Every tab, and every
   big topic tile, has its **own 🔊 button** beside it that reads the topic's name; tapping the
   tab or tile itself opens the topic **without speaking** (it only silences whatever is still
   being read). A topic already answered today shows ✓ and *"Das hast du heute schon gemacht.
   Morgen wieder!"* instead of questions. Before a tab is chosen, the same topics also appear
   as big tiles in the content area.
4. **Questions, one per screen**: progress dots, big picture (uploaded image or emoji), text in
   Andika ≥ 28 px, 🔊 replay button. With `autoRead` the question is read when it appears.
   Answer buttons ≥ 96 px. **Every answer tile (face or option) has its own 🔊** (48 px, in the
   tile's top-left corner, a separate button — never nested in the tile) that reads its label;
   "Fertig" and "Überspringen" have a 🔊 beside them. So a child can listen to every choice
   before choosing. **Tapping an answer, "Fertig" or "Überspringen" speaks nothing**: it
   silences any reading, marks the tapped tile, and a single answer advances after 0.9 s;
   multi-choice toggles silently and has a "Fertig" button; every question has a small
   "Überspringen".
   (The picture-code screens of step 2 keep speaking each pick when tapped, and "Tschüss" still
   says *"Tschüss!"*.)
5. **Submit** after the topic's last question → *"Danke!"* animation → back to the tabs with ✓.
   All topics done → *"Alles geschafft! Tschüss!"* → start screen after 5 s.
6. A **"Tschüss 👋"** button is always visible; **idle for `idleSeconds`** → start screen. The
   kiosk session token lives only in memory, so nothing of the previous child survives either.
7. **Which voice speaks** any text, in this order: the question's own uploaded recording
   (`audioUrl`) → the Thorsten clip from `voice` → the tablet's speech synthesis (only while a
   clip is still missing or the voice service is down). Clips and synthesis share one queue:
   a new prompt either waits for the current one or interrupts it, exactly as before. The
   "Los geht's" tap unlocks audio playback on iOS for the whole session. When the kiosk loads
   its config it **fetches every clip once into memory** (blob URLs, 3 at a time, in the
   background; clips no longer in the config are released), so a clip — and every part of a
   composed sentence — starts without a network round trip; a clip not fetched yet plays from
   its URL.

### Voice (Thorsten)
- **What gets a clip:** every fixed kiosk phrase, and the name of every active topic, the text
  of every active question and the label of every active option. Text is normalised (trimmed,
  inner whitespace collapsed) before it is keyed; the key also contains the voice and its
  `lengthScale`, so a changed text or speed simply has no clip yet.
- **When it is made — only when the admin is done:** the question editor keeps all text
  changes as a draft (across topics); a bar at the bottom shows how many changes are pending,
  with **"Speichern & vertonen"** and "Verwerfen". Saving writes every change, then asks the
  server once to voice everything missing. There is **no voicing on individual saves**.
  Every field (text, symbol, colour, kind, "aktiv", picture, recording) is a draft; only
  structural actions (add, delete, reorder) are saved immediately. A new question's
  placeholder text is not voiced by itself — the next "Speichern & vertonen" (or "Fehlende
  vertonen") does it. The server also voices missing
  texts at startup (fixed phrases on a fresh install; anything a failed run left behind) and
  after a settings save that changed `speechRate`.
- **Admin controls:** the Fragen page shows the state ("118 von 120 Texten vertont", working,
  failed) and **"Alle neu vertonen"**; each question shows its clip state with ▶ and
  **"Neu vertonen"**; topics and options show ▶ when their clip exists.
- **Queue:** in the app's memory, one text at a time, oldest first, a text queued twice is
  queued once. A failed text is listed with its error and retried by the next run; when the
  voice service is unreachable the run stops and `reachable` is false until the next run
  succeeds.
- **Clean-up:** after a run that leaves nothing missing, clips whose text is no longer wanted
  are deleted (row and file).
- **Uploaded recordings win:** a question with its own `audioUrl` still gets a Thorsten clip
  (for when the recording is removed), but the kiosk plays the recording.
- **The voice:** `Thorsten-Voice/Kokoro` (Kokoro-82M / StyleTTS2 fine-tuned on the CC0
  Thorsten dataset, Apache 2.0) at revision `734e593` — the checkpoint the user picked in a
  listening test against Piper. The image build exports it to ONNX (`voice/export.py`, PyTorch
  only in that build stage); at run time the service turns text into German phonemes with the
  model's own G2P (misaki's German module on espeak-ng, `ʏ` → `y` as the model README says),
  runs the ONNX model with Thorsten's style vector and **peak-normalises** the result (Kokoro's
  raw output is ≈ 8 dB quieter than Piper's was). Texts longer than 200 phonemes are spoken in
  chunks cut after a sentence mark (else a clause mark, else a space), which keeps the memory
  of one run small.
- **Clip audio is trimmed:** the voice service cuts the silence the model leaves around speech to
  20 ms before and 50 ms after it (threshold 2 % of full scale, 5 ms fade-in/out; an
  all-silent result is left as it is), so composed sentences have only a short, natural gap
  between parts. The clip key carries a **clip format version** (`v2` since trimming); bumping
  it makes every existing clip "missing", so the start-up run re-voices everything and the
  clean-up drops the old files — no admin action needed.

### Repeat protection (the user's question: *wie verhindern, dass ein Kind ganz oft hintereinander abstimmt?*)
- **Picture code chosen by the child.** A new child picks a free combination of animal, colour
  and fruit and keeps it in mind; a combination is unique, so the second child to pick it is
  asked to choose another. The system stores **no names** — only the sign and the grade
  (pseudonymous).
- **One submission per code, topic and Berlin calendar day.** Enforced in a `BEGIN IMMEDIATE`
  transaction plus the UNIQUE index as backstop → 409 `already_answered`. The first answer
  counts; a later one is refused kindly, never overwrites.
- **Guessing codes is throttled**: > 20 failed code attempts per device in 10 minutes → 429 with
  *"Kurze Pause …"*. Limited per device, not per IP — all school tablets share one public IP.
- **Making new signs to vote again is throttled**: > 10 new codes per device in 10 minutes →
  429. The admin panel shows new signs per day and per tablet, so a spike is visible, and can
  deactivate a code.
- **Accepted weakness of self-chosen signs:** a child who forgets their sign can make a new one,
  and a child can use another child's sign if they know it. This is soft protection for an
  opinion survey, not authentication.
- **Only registered tablets can vote.** The kiosk API refuses browsers without a valid device
  cookie, so the public URL cannot be used from home or by strangers; a lost or replaced tablet
  is revoked in the admin panel.

### Extended questions
`frequency = extended` questions are added to their topic on the weekdays in
`extendedWeekdays` (Berlin time). On those days the topic is still answered once — core and
extended together.

### Submission validation (server, `server/domain/answers.ts`)
- topic exists and is active; at least one answer; no question twice;
- every question belongs to the topic, is active and is shown today (core, or extended on an
  extended day);
- `scale5` value ∈ 1..5, `scale3` ∈ 1..3, `yesno` ∈ {0,1}, no `optionIds`;
- `choice`: `optionIds` non-empty, unique, all active options of that question; exactly one
  unless `multi`; no `value`.
- Unanswered (skipped) questions are simply absent.

### Admin
- Password from env `ADMIN_PASSWORD` (≥ 10 characters; the server refuses to start in
  production without it). Compared via scrypt + `timingSafeEqual`. Session: random 32-byte
  token, only its sha256 stored, 12 h lifetime.
- The admin sees **aggregates only** — no view, filter or export per child code.
- `kind` of an answered question cannot change; text/picture may (typo fixes). A changed
  meaning should be a new question.
- Text and field edits in the question editor are drafts until "Speichern & vertonen" (see
  Voice); leaving the page or logging out with pending changes asks first.
- Codes: list with grade, tablet and date; new signs per day (last 14 days). A deactivated code
  cannot log in, keeps its history, and its combination stays taken. Changing a code's grade
  is allowed (a child who picked the wrong number).
- Devices: register from the tablet itself while logged in as admin (label e.g. "Tablet 1");
  list shows last seen; revoke at any time.

### Statistics (`server/domain/stats.ts`, pure)
- Normalised score of a scale answer: `(value − 1) / (max − 1) × 100`; topic **index** = mean
  of normalised scale answers (`scale5`, `scale3`) in the bucket; `null` when there are none.
- `yesno`: count and share of "Ja". `choice`: count per option and share of respondents.
- Buckets in Berlin calendar: day, ISO week (Mon), month. `previous` = range of equal length
  directly before `from`.
- Default range: last 30 days, bucket week.

### Dashboard (admin)
- Totals (submissions, children, per-topic index with ▲/▼ vs. previous period).
- One line chart: index per topic over time, in the topic colours.
- Topic detail: per question a stacked bar chart of the answer distribution per bucket
  (scale/yesno) or a bar chart of option shares (choice).
- Filters: range (7 / 30 / 90 days / school year / custom), bucket, grade. CSV export.

## Data Flow

Greenfield — no existing code was analysed.

## Dependencies

None (first feature). Deployment follows the host conventions of TopRun and NinaNatur
(GHCR image, root cron `deploy/roll-all.sh` → `deploy/auto-deploy.sh` with health-checked
rollback, port published on `172.17.0.1` only).

## Deployment

| | |
|---|---|
| Repo | `github.com/JanderHungrige/wieisses` (public) |
| Image | `ghcr.io/janderhungrige/wieisses:main` (+ `:<sha>`), built by `.github/workflows/deploy.yml` on push to `main`; the build runs typecheck + tests |
| Voice image | `ghcr.io/janderhungrige/wieisses-voice:main` (≈ 700 MB), built by `.github/workflows/voice.yml` when `voice/**` changes (or by hand); an export stage downloads the pinned checkpoint (sha256-checked) and turns it into ONNX with PyTorch, the runtime stage gets only the ONNX model, runs the voice unit tests and synthesises "Hallo" as a smoke test |
| Host | clone at `/opt/wieisses`, `deploy/.env.prod` (gitignored): `COMPOSE_PROJECT_NAME=wieisses-prod`, `IMAGE_TAG=main`, `APP_PORT=8082`, `ADMIN_PASSWORD=…` |
| Cron | root, offset **:23** (taken: :00 battlefuel, :08 toprun, :15 ninanatur, :30 funding-tender-tracker, :45 3dmap2) |
| Proxy | NPM `wieisses.w3rth.de` → `http://172.17.0.1:8082` (already configured, answers 502 until the container runs) |
| Data | named volume `wieisses-data` → `/data`; nightly `deploy/backup.sh` (SQLite online backup + `PRAGMA integrity_check`) |

Container: non-root `node` user, read-only root FS, `/tmp` tmpfs, `cap_drop: ALL`,
`no-new-privileges`, memory 192 MB, healthcheck `GET /healthz`, logs rotated (3 × 10 MB).

Voice container (`voice` service in `deploy/compose.app.yml`): no published port, reached by
the app as `http://voice:5000` (`VOICE_URL`); non-root, read-only root FS, `cap_drop: ALL`,
`cpus: 1.0` (one of the host's two cores stays free), memory 768 MB, healthcheck `GET /healthz`.
`/tmp` is a 16 MB tmpfs **with exec**: phonemizer copies espeak-ng's shared library there and
loads it from the copy. Memory (measured 2026-11-07, 71 texts up to 400 characters, 1 CPU,
768 MB): ≈ 380–420 MiB while the model is loaded, peak 555 MiB, ≈ 30 MB idle after the
model is released. That needs onnxruntime's memory arena off and glibc returning large buffers
(`MALLOC_MMAP_THRESHOLD_`/`MALLOC_TRIM_THRESHOLD_` in the image); with the default arena the
service kept every text's working memory and grew past 760 MiB in three texts.
`deploy/auto-deploy.sh` rolls both services, each with its own health gate and rollback (as
TopRun does with app + ladder). A change under `deploy/` needs `git pull` in `/opt/wieisses`.

**Clip format changes go out voice first:** push the `voice/**` change to `main` on its own
(only `voice.yml` builds), wait until the host has rolled the new voice image, then push the
app change that bumps the clip format version. Otherwise the app's start-up run could voice
the new keys with the old voice image.

## Security

**Untrusted input:** every request body, query and path parameter; uploaded files; cookies;
`X-Forwarded-*` headers from anything but the trusted proxy range (`127.0.0.1`,
`172.16.0.0/12`).

**What a malicious caller could try, and the answer:**
- Vote from outside the school → device cookie required (random 32-byte token, only its hash
  stored, `HttpOnly; SameSite=Strict; Secure` behind https).
- Guess child codes or mass-create them → per-device throttles; codes are useless without a
  registered device.
- Flood answers → one per code/topic/day; body size capped (64 KB JSON).
- Brute-force the admin password → 10 failures / 15 min / IP, scrypt.
- CSRF on admin actions → `SameSite=Strict` + mandatory `X-Wieisses` header.
- Upload HTML/SVG/script as "image" → allow-list of types, magic-byte check, random file name,
  served with its fixed type and `X-Content-Type-Options: nosniff`; no SVG.
- Path traversal on `/media/:file` and static files → names matched against
  `^[a-f0-9]{32}\.(png|jpg|webp|mp3|m4a|ogg|wav)$`; static files resolved and confined to `dist/`.
- XSS via question texts → rendered as text by Preact only (no `dangerouslySetInnerHTML`);
  strict CSP `default-src 'self'`, `frame-ancestors 'none'`.
- SQL injection → prepared statements only.
- Reach the voice service → not published on any host port; only the app on the compose
  network can call it. It accepts plain text up to 400 characters and a bounded
  `lengthScale`; the app sends it only admin-saved texts and the fixed phrases, never anything
  a child or a visitor typed. Clip files get names derived from the key (`[a-f0-9]{32}.mp3`)
  and go through the same media route and its checks.

**Never exposed:** the admin password or its hash, device/session tokens (only issued once, in a
cookie), child codes in exports or results, client IPs in the database. Logs carry no codes and
no tokens.

## Known Issues

- Speech synthesis depends on a German voice on the tablet. iPads ship one; some Android
  tablets need the Google TTS German voice installed. Per-question audio uploads are the
  fallback. (Since the Thorsten voice, the tablet voice is only the fallback for missing clips.)
- The Thorsten "high" model is fine-tuned from the US-English "lessac" voice, whose source
  recordings are licensed for non-commercial use; the Thorsten dataset itself is CC0. Fine for
  a school survey, not for a commercial product. piper-tts is GPL-3.0 and runs as a separate
  service (see `voice/THIRD_PARTY.md`).
- The first full voicing (≈ 75 fixed phrases + all content) takes a few minutes on the host's
  CPU; until a clip exists the tablet voice speaks that text. Measured on the host on
  2026-11-07: 0.3–2 s per text on one core, 109 texts in about 90 s, ~240 MB while voicing.
  The clip format v2 rollout (trimmed silence) re-voiced all 109 texts in ≈ 2 min (0.3–4 s
  each, no failures) and pruned the 109 v1 clips.
- A run that finds the voice service unreachable stops and is **not retried by itself**. It
  happened on the first rollout (the app restarted before the voice container existed); the
  admin's "Fehlende vertonen" or an app restart starts it again. In normal rolls the voice
  service rolls first, so the app's start-up run finds it.
- Pulling the voice image (one 114 MB layer) failed three times on the host with containerd
  "failed to Lchown … no such file" before it succeeded; auto-deploy retries every minute, so
  it healed by itself — the same transient error TopRun's log shows.
- A child's grade is fixed at sign-up; there is no school-year rollover (all grades +1) yet —
  the admin can only change grades one code at a time.
- A tablet whose browser data is cleared loses its device cookie and must be registered again
  (Tablets → Dieses Gerät freischalten); the old entry can be revoked.
- Kiosk sessions live in server memory: a deploy or restart sends a child mid-topic back to the
  sign screen (their answers to that topic were not handed in yet).
- The new sign (*"Das ist jetzt dein Geheimzeichen: Fuchs, Blau, Apfel. Merk es dir gut!"*) is
  still spoken as five clips: each part ends with a falling tone and there are ≈ 0.2 s between
  parts. One clip per combination would be 768 clips.
- The Thorsten "high" voice sounds wooden to the user (2026-11-07). Evaluated as a
  replacement: `Thorsten-Voice/Kokoro` (Kokoro-82M / StyleTTS2 fine-tuned on the Thorsten
  dataset, Apache 2.0, revision `734e593`). It uses the same espeak-ng phonemes as Piper and on
  one CPU is about 3× faster, but through PyTorch it needs ≈ 1.2 GB RAM (out of memory in the
  768 MB container) and a 1.7 GB image; an ONNX export (onnxruntime is already in the image)
  would keep today's footprint — not tried yet. Its raw output is ≈ 8 dB quieter (needs peak
  normalising) and slower (speed ≈ 1.1–1.2 matches Piper at 1.11). In that revision
  `model.pth` is epoch 10, not epoch 5 as its README says.
- Both voices stress *„Worüber“* on the first syllable (espeak-ng's dictionary).
- Since 2026-11-07 the kiosk speaks with Kokoro-Thorsten instead of Piper (the user found it
  less wooden in a listening test). The non-commercial "lessac" note above applies to the old
  Piper model only; Kokoro-82M and the Thorsten fine-tune are Apache 2.0, espeak-ng (GPL-3.0)
  runs inside the separate voice container. The German G2P and the model code come from
  personal forks (`semidark/misaki`, `semidark/kokoro`), pinned to commits.
- Rolling the 700 MB Kokoro voice image failed for 20 minutes on 2026-11-07 with the same
  containerd errors ("failed to Lchown … no such file", "parent snapshot … does not exist"):
  battlefuel, funding-tender-tracker and toprun run `docker image prune -f` every minute without
  the host-wide lock, and the big layer never extracted between two prunes. Unblocked by one
  manual pull holding every project's deploy lock (`flock /tmp/docker-image-deploy.lock flock
  /tmp/battlefuel-auto-deploy.lock … docker pull …`, 26 s). `deploy/auto-deploy.sh` now waits for
  the shared `/tmp/docker-image-deploy.lock` and prunes only layers older than 24 h; the other
  projects still prune without it, so a big image can hit this again.
- Kokoro on the Mac's Docker took ≈ 6 s per short sentence on one CPU (Piper there was just as
  slow, while it took 0.3–2 s on the host); the host's time per text is measured at rollout.

## Out of scope (MVP)

Free-text answers (moderation and privacy burden with children's writing), per-child views,
multiple admin accounts, a dev/preview stack, burst detection, a separate "how it is
pronounced" text per question (Thorsten reads the displayed text).

## Bugs

(none yet — populated by /mdd bug when issues are reported)
