---
id: 04-fragen-werkzeug
title: Fragen-Werkzeug und Beispieldaten — question changes and removable demo answers, run inside the container over SSH
edition: wieisses
depends_on: [01-schul-umfrage]
relates: [01-schul-umfrage]
source_files:
  - server/ops/questions.ts
  - server/ops/demo.ts
  - server/ops/cli.ts
  - server/handlers/question-changes.ts
  - server/handlers/demo.ts
  - server/handlers/content.ts
  - server/adapters/demo-store.ts
  - server/adapters/db.ts
  - server/domain/content-diff.ts
  - server/domain/demo-answers.ts
  - shared/schema.ts
routes: []
models: [topic, question, answer_option, device, child_code, submission, answer, setting]
test_files:
  - tests/unit/content-diff.test.ts
  - tests/unit/demo-answers.test.ts
  - tests/api/question-changes.test.ts
  - tests/api/demo-data.test.ts
  - tests/api/ops-cli.test.ts
data_flow: .mdd/audits/flow-fragen-werkzeug-2026-11-10.md
last_synced: 2026-11-10
status: complete
phase: all
mdd_version: 11
tags: [question-editor, ops-cli, docker-exec, change-list, dry-run, demo-data, dashboard-demo, sqlite-savepoint]
path: Umfrage/Betrieb
integration_contracts: []
satisfies_contracts: []
known_issues: []
security_read_sites: []
sister_projects: []
---

# 04 — Fragen-Werkzeug und Beispieldaten

## Purpose

Question updates arrive by mail and are applied from the chat with Claude. The last one went out
as a one-off migration (v3) written blind against a database nobody could look at — slow and
nervous. This feature gives Claude (and anyone with SSH access to the host) two small tools that
run **inside the app container**:

- **`server/ops/questions.ts`** — shows the live question content and applies a list of changes to
  it: a dry run first, then for real with a backup, then the missing texts are voiced.
- **`server/ops/demo.ts`** — fills the database with eight weeks of plausible answers so the
  dashboard can be shown before the real survey starts, and removes exactly those again.

## Architecture

```
Mac (Claude) ──ssh jan@host──▶ docker exec -i wieisses-prod-app-1 node server/ops/<tool>.ts …
                                   │  stdin: change list (JSON)   stdout: result
                                   ▼
server/ops/questions.ts ─▶ handlers/question-changes.ts ─▶ handlers/content.ts (same rules as the
   (args, stdin, output)      (batch, dry run, diff)         admin editor) ─▶ adapters/content-write.ts
                                   └─▶ domain/content-diff.ts (pure: before/after → lines)
                                   └─▶ handlers/voice-queue.ts (generate 'missing', wait)
server/ops/demo.ts ─▶ handlers/demo.ts ─▶ domain/demo-answers.ts (pure generator)
                                       └─▶ adapters/demo-store.ts, access-store.ts, submission-store.ts
```

- `server/ops/` is the command line's "routes" layer: parse arguments and stdin, call one
  handler, print. Like `server/ops/backup.ts` it ships in the image (`dev/` does not).
- The running server reads questions from SQLite on every request (no cache), so a committed
  change is live for the next child. SQLite (WAL, `busy_timeout` 5 s) lets the tool write while
  the server runs.
- `server/ops/cli.ts` holds what both tools share: open the database (refuse unless the schema is
  current), read stdin, a logger on stderr so stdout stays the result.
- `transaction()` (`server/adapters/db.ts`) nests: inside an open transaction it uses a
  `SAVEPOINT`, so a batch can wrap `deleteQuestion`/`deleteTopic`/`insertSubmission`, which open
  their own.
- The content handlers take `ContentDeps = Pick<App, 'db' | 'now'>` instead of the whole `App`,
  so the tool needs no admin password and no HTTP server.

## Data Model

No schema change. Demo data uses the existing tables plus one `setting` row:

| Key | Value | Meaning |
|---|---|---|
| `demo.deviceId` | device id (JSON number) | the "Beispieldaten" device; every demo code hangs off it |

`getSettings` ignores unknown keys, so the row never reaches the settings form.

## Command line

All commands also run locally against a dev data directory
(`DATA_DIR=.data node server/ops/questions.ts export`). On the host:

```bash
ssh jan@159.195.148.193 'docker exec -i wieisses-prod-app-1 node --disable-warning=ExperimentalWarning server/ops/questions.ts export'
ssh jan@159.195.148.193 'docker exec -i wieisses-prod-app-1 node --disable-warning=ExperimentalWarning server/ops/questions.ts apply' < changes.json
ssh jan@159.195.148.193 'docker exec -i wieisses-prod-app-1 node --disable-warning=ExperimentalWarning server/ops/questions.ts apply --yes' < changes.json
```

### `questions.ts export`
Prints the content as JSON — the admin editor's `CountedTopic[]` (`adminTopics`): every topic
(id, name, icon, colour, sort, active, `answerCount` = submissions) with its questions (id, text,
kind, multi, icon, frequency, sort, active, `answerCount` = submissions that answered it) and
their options (id, label, icon, sort, active, `answerCount` = times picked). Inactive items are
included — "ausgeblendet" is `active: false`, "Sonderfrage" is `frequency: "extended"`.

### `questions.ts apply [--yes] [--no-voice]`
Reads a **change list** (JSON array) from stdin. Each entry is one of:

| `op` | fields | does |
|---|---|---|
| `topic.create` | `topic` (TopicCreate), `ref?` | new topic |
| `topic.update` | `id`, `patch` (TopicPatch) | rename, recolour, reorder, show/hide |
| `topic.delete` | `id` | only an unanswered topic |
| `question.create` | `topic` (id or ref), `question` (QuestionCreate), `options?` (OptionCreate[]), `ref?` | new question, its options in the given order |
| `question.update` | `id`, `patch` (QuestionPatch) | text, icon, `frequency`, `sort`, `active` … |
| `question.delete` | `id` | only an unanswered question |
| `option.create` | `question` (id or ref), `option` (OptionCreate) | new answer for a choice question |
| `option.update` | `id`, `patch` (OptionPatch) | label, icon, sort, `active` |
| `option.delete` | `id` | only a never-picked option |

`ref` names an item created earlier in the same list, so a later entry can point at it
(`"topic": "neu"`). The payloads are the admin editor's Zod schemas from `shared/schema.ts`, so the
tool accepts exactly what the editor accepts.

Output: one line per difference between before and after, then the verdict:

```
~ Frage 12 · Essen: „Hattest du genug Zeit?“ → „Hattest du heute genug Zeit?“
~ Frage 14 · Essen: täglich → Sonderfrage
+ Frage 41 · Spielen & Basteln (Sonderfrage, Auswahl): „Spielst du lieber drinnen oder draußen?“ — 🏠 Drinnen · 🌳 Draußen
~ Frage 9 · Hausaufgaben: ausgeblendet
- Antwort 31 · Frage 12: „Vielleicht“
Probelauf — nichts gespeichert. Zum Speichern dasselbe mit --yes.
```

With `--yes`: `Gespeichert. Backup: /data/backups/pre-questions-<stamp>.sqlite`, then the voicing
result (`Vertont: 3 Texte, 0 fehlgeschlagen.` / `Vertonung übersprungen (kein VOICE_URL).` or `(--no-voice)`).
Exit code 0 on success, 1 when a change is refused (message names the entry: `Änderung 3
(question.update 12): Die Art einer beantworteten Frage lässt sich nicht ändern …`), 2 on bad
usage or a change list that does not parse.

### `demo.ts add | remove | status`
- `add` — creates the demo set (below) and prints `Beispieldaten: 45 Bildzeichen, <n> Antworten
  (<from> bis <to>).` Refuses when a set exists.
- `remove` — deletes exactly the demo set and prints what went. `Keine Beispieldaten vorhanden.`
  when there is none.
- `status` — whether a set exists, with its counts.

## Business Rules

### Question changes
1. **Dry run by default.** Without `--yes` the whole list runs inside one transaction that is
   rolled back at the end — the diff shows what *would* change, computed by the same code.
2. **All or nothing.** With `--yes` the list runs in one transaction; the first refused entry
   rolls back every entry and nothing is written.
3. **Same rules as the admin editor** (doc 01, Admin), by calling the same handlers:
   - an answered question keeps its `kind` (409 → refused);
   - only `choice` questions get options;
   - an answered topic/question or a picked option cannot be deleted — hide it
     (`active: false`) instead;
   - `multi` is forced off for a non-choice question.
4. **Unknown ids and refs** are refused (`… gibt es nicht.` / `Verweis „x“ ist nicht bekannt.`);
   a `ref` used twice is refused.
5. **Backup before writing**: an online SQLite backup into `/data/backups/` (same volume as the
   nightly backups), taken only when `--yes` is given and before the transaction starts.
6. **Voicing after writing**: a run of "Fehlende vertonen" (`generate('missing')`) that the tool
   waits for, unless `--no-voice` or `VOICE_URL` is unset. A failed text is reported, not fatal —
   the admin page's "Fehlende vertonen" can retry it.
7. The diff covers topics, questions and options: added (`+`), removed (`-`), changed (`~`:
   text/name/label, icon, kind, multi, frequency, sort, colour, shown/hidden).

### Demo data
1. **Marked**: one device "Beispieldaten", **revoked** at creation (its token is never handed
   out), id stored in `setting` `demo.deviceId`. Every demo code has that `device_id`.
2. **45 picture codes, all inactive**: a child can never log in with a demo sign (login answers
   "unknown sign"); the combination is taken until `remove` (a child who picks it is asked for
   another — doc 01, Codes). Grades from the settings (`grades`).
3. **Eight weeks up to yesterday**, school days only (Mon–Fri). Extended questions on the
   weekdays from the settings (`extendedWeekdays`), like the kiosk.
4. Codes appear over time: two thirds in the first week, the rest spread over the following weeks
   (some inside the last 14 days, so "new signs per day" shows something). A code answers only from
   its first day on.
5. Per code, topic and day a ~35 % chance of an answer; at most one per code/topic/day (the
   existing `insertSubmission` rule). Answers lean good, each topic has its own level and a slow
   drift over the weeks, so the index lines differ and move.
6. Only **active** topics, questions and options get answers; choice questions pick one option
   (multi: one or two).
7. **Remove** deletes, in one transaction: the answers and submissions of demo codes, the demo
   codes, the device and the setting row. Nothing else.
8. Deterministic for a given seed (`--seed n`, default 42), so tests can pin the output.

## Data Flow

See `.mdd/audits/flow-fragen-werkzeug-2026-11-10.md`. The tool writes through the same adapters as
the admin editor and the kiosk; the dashboard reads demo answers through the unchanged results
queries (which already count inactive codes).

## Dependencies

- 01-schul-umfrage — content tables and editor rules, codes and devices, submissions, voice queue,
  settings, the container and backup layout.

## Security

**Who can run it:** only someone who can `docker exec` into the app container, i.e. who holds SSH
access to the host as a member of the `docker` group. No new port, route, password or token; the
tools are not reachable over HTTP.

**Untrusted input:** the change list on stdin (it may be hand-written or generated from a mailed
question update). It is parsed with the admin editor's Zod schemas (lengths, emoji, kinds, media
URLs) before anything runs; ids are numbers, refs are short strings; values reach SQLite only
through prepared statements. A malicious list could at most do what the admin editor can.

**Never exposed:** the export carries content and counts only — no child code, no submission, no
answer row, no device token, no admin session. `demo.ts` never prints codes. Neither tool logs to
the container log.

**Production safety:** dry run by default; backup before every committed change; demo data is
confined to one revoked device and inactive codes and is removed by id, never by a guess.

## Known Issues

- A Beispieldaten sign that the admin re-activates in the code list becomes usable by a child;
  `remove` would delete that child's answers with the rest. Remove the demo set before the real
  survey starts.
- `pre-questions-*.sqlite` backups are not rotated by the nightly job (which keeps only
  `wieisses-*.sqlite.gz`); they are small and can be deleted by hand.

## Bugs

(none yet — populated by /mdd bug when issues are reported)
