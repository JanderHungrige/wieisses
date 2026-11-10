---
generated: 2026-11-10
doc_count: 4
connection_count: 4
overlap_count: 16
---

# MDD Connections

## Path Tree

```
Meta
└── Schema  00-frontmatter-spec  complete
Umfrage  01-schul-umfrage  complete
├── App  03-installierbare-app  complete
├── Aussehen  02-springy-naturlook  complete
└── Betrieb  04-fragen-werkzeug  complete
```

## Dependency Graph

```mermaid
graph TD
  D00["00-frontmatter-spec"]:::complete
  D01["01-schul-umfrage"]:::complete
  D02["02-springy-naturlook"]:::complete
  D03["03-installierbare-app"]:::complete
  D04["04-fragen-werkzeug"]:::complete
  D02 --> D01
  D03 --> D01
  D03 --> D02
  D04 --> D01
  classDef complete fill:#d4f5d4,stroke:#2e7d32
  classDef in_progress fill:#fff4cc,stroke:#b8860b
  classDef draft fill:#eeeeee,stroke:#888888
  classDef deprecated fill:#f5d4d4,stroke:#a33
```

## Source File Overlap

| File | Docs |
|---|---|
| `server/adapters/db.ts` | 01-schul-umfrage, 04-fragen-werkzeug |
| `server/domain/voice-texts.ts` | 01-schul-umfrage, 02-springy-naturlook |
| `server/handlers/content.ts` | 01-schul-umfrage, 04-fragen-werkzeug |
| `server/handlers/voice-queue.ts` | 01-schul-umfrage, 02-springy-naturlook |
| `shared/phrases.ts` | 01-schul-umfrage, 02-springy-naturlook |
| `shared/schema.ts` | 01-schul-umfrage, 04-fragen-werkzeug |
| `web/admin/App.tsx` | 01-schul-umfrage, 02-springy-naturlook |
| `web/admin/admin.css` | 01-schul-umfrage, 02-springy-naturlook |
| `web/admin/index.html` | 01-schul-umfrage, 02-springy-naturlook, 03-installierbare-app |
| `web/index.html` | 01-schul-umfrage, 02-springy-naturlook, 03-installierbare-app |
| `web/kiosk/Kiosk.tsx` | 01-schul-umfrage, 02-springy-naturlook |
| `web/kiosk/Prompt.tsx` | 01-schul-umfrage, 02-springy-naturlook |
| `web/kiosk/kiosk.css` | 01-schul-umfrage, 02-springy-naturlook |
| `web/kiosk/main.tsx` | 01-schul-umfrage, 02-springy-naturlook, 03-installierbare-app |
| `web/kiosk/screens.tsx` | 01-schul-umfrage, 02-springy-naturlook |
| `web/lib/speech.ts` | 01-schul-umfrage, 02-springy-naturlook |

## Warnings

(none)
