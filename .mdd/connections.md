---
generated: 2026-11-09
doc_count: 3
connection_count: 1
overlap_count: 13
---

# MDD Connections

## Path Tree

```
Meta
└── Schema  00-frontmatter-spec  complete
Umfrage  01-schul-umfrage  complete
└── Aussehen  02-springy-naturlook  complete
```

## Dependency Graph

```mermaid
graph TD
  D00["00-frontmatter-spec"]:::complete
  D01["01-schul-umfrage"]:::complete
  D02["02-springy-naturlook"]:::complete
  D02 --> D01
  classDef complete fill:#d4f5d4,stroke:#2e7d32
  classDef in_progress fill:#fff4cc,stroke:#b8860b
  classDef draft fill:#eeeeee,stroke:#888888
  classDef deprecated fill:#f5d4d4,stroke:#a33
```

## Source File Overlap

| File | Docs |
|---|---|
| `server/domain/voice-texts.ts` | 01-schul-umfrage, 02-springy-naturlook |
| `server/handlers/voice-queue.ts` | 01-schul-umfrage, 02-springy-naturlook |
| `shared/phrases.ts` | 01-schul-umfrage, 02-springy-naturlook |
| `web/admin/App.tsx` | 01-schul-umfrage, 02-springy-naturlook |
| `web/admin/admin.css` | 01-schul-umfrage, 02-springy-naturlook |
| `web/admin/index.html` | 01-schul-umfrage, 02-springy-naturlook |
| `web/index.html` | 01-schul-umfrage, 02-springy-naturlook |
| `web/kiosk/Kiosk.tsx` | 01-schul-umfrage, 02-springy-naturlook |
| `web/kiosk/Prompt.tsx` | 01-schul-umfrage, 02-springy-naturlook |
| `web/kiosk/kiosk.css` | 01-schul-umfrage, 02-springy-naturlook |
| `web/kiosk/main.tsx` | 01-schul-umfrage, 02-springy-naturlook |
| `web/kiosk/screens.tsx` | 01-schul-umfrage, 02-springy-naturlook |
| `web/lib/speech.ts` | 01-schul-umfrage, 02-springy-naturlook |

## Warnings

(none)
