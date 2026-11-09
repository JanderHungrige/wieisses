# Third-party material in the app

The voice service lists its own in `voice/THIRD_PARTY.md`.

## Fonts (self-hosted, bundled by Vite)

| Font | Used in | Author | Licence | Package |
|---|---|---|---|---|
| Playpen Sans | kiosk | TypeTogether | SIL Open Font License 1.1 | `@fontsource/playpen-sans` |

The admin panel uses the device's own system font.

## Pictures made with AI (doc 02)

Both were made on the owner's own PC with Couch (ComfyUI) and **FLUX.2 klein 4B** (Black Forest
Labs, Apache-2.0); the owner may use the outputs freely. They are stylised illustrations, not
realistic depictions of real people, places or events.

| File | What | Couch workflow |
|---|---|---|
| `web/kiosk/assets/wiese.webp` | the meadow behind the kiosk (text to image, 1408 × 1056, saved without its ComfyUI metadata) | "Wie isses – Comic-Naturhintergrund" |
| `web/kiosk/Springy.tsx` (face only) | Springy's face — eyes, brows and smile — redrawn as vectors after an AI edit of the logo | "Springy – Maskottchen aus dem Logo", draft 1 |

The swirl itself (`web/logo.svg`, `web/kiosk/springy-body.ts`) is the site's own logo, traced.
