---
id: 02-springy-naturlook
title: Springy und Naturlook — the logo as a guiding character, a comic nature background, sketch buttons, Playpen Sans
edition: wieisses
depends_on: [01-schul-umfrage]
relates: [01-schul-umfrage]
source_files:
  - web/lib/springy.ts
  - web/kiosk/Springy.tsx
  - web/kiosk/springy-body.ts
  - web/kiosk/springy.css
  - web/kiosk/speak.css
  - web/kiosk/Nature.tsx
  - web/kiosk/nature.css
  - web/kiosk/assets/wiese.webp
  - web/logo.svg
  - web/kiosk/Kiosk.tsx
  - web/kiosk/Prompt.tsx
  - web/kiosk/screens.tsx
  - web/kiosk/kiosk.css
  - web/kiosk/main.tsx
  - web/lib/speech.ts
  - web/index.html
  - web/admin/index.html
  - web/admin/App.tsx
  - web/admin/admin.css
  - shared/phrases.ts
  - server/domain/voice-texts.ts
  - server/handlers/voice-queue.ts
  - THIRD_PARTY.md
  - package.json
routes: []
models: []
test_files:
  - tests/unit/springy.test.ts
  - tests/unit/voice-texts.test.ts
  - tests/api/voice.test.ts
data_flow: .mdd/audits/flow-springy-naturlook-2026-11-09.md
last_synced: 2026-11-09
status: complete
phase: all
mdd_version: 11
tags: [mascot, springy, svg-animation, nature-background, sketch-buttons, playpen-sans, comfyui, couch, pronunciation]
path: Umfrage/Aussehen
integration_contracts: []
satisfies_contracts: []
known_issues: []
security_read_sites: []
sister_projects: [~/Code/NinaNatur, ~/Code/Couch]
---

# 02 — Springy und Naturlook

## Purpose

The kiosk gets a face and a place. **Springy** — the site's blue swirl logo with googly eyes —
guides the children through the survey: it says every prompt in a speech bubble, moves its mouth
while the voice speaks, looks at the 🔊 a child taps and jumps for joy at "Danke!". Behind
everything lies a **picture-book meadow that gently moves** (clouds, sun, butterflies). Buttons
look hand-drawn like NinaNatur's "Draft Sketch" buttons, and the text uses **Playpen Sans**, a
playful handwriting font made for children learning to read. The owner asked for all four on
2026-11-09 and chose Couch draft 1, a vector rig, Playpen Sans and this doc.

## Architecture

```
web/kiosk/Kiosk.tsx ──► <Nature/> (fixed backdrop + animated SVG layers, aria-hidden)
        │
        ├─► header (tabs, Tschüss) ─┐
        └─► <main class="stage"> ───┴─ screens; every Prompt = <Springy size="small"/> + speech bubble
                                        start / thanks = <Springy size="big"/>
web/kiosk/Springy.tsx   the SVG rig (body path, eyes, pupils, lids, brows, mouth) — CSS does the motion
web/lib/springy.ts      pure: springyMood(phase), pupilOffset(eye, target, max), lookAt/onLook store
web/lib/speech.ts       + onSpeaking(listener): fires when the shared speech queue starts/stops
server/domain/voice-texts.ts + spokenText(text): the form the voice service is given
```

No route, table or API shape changes. All assets are bundled by Vite (no request leaves the site).

## Springy

### Look
- **Body = the logo, exactly.** The original logo (293 × 250 px PNG) traced once into one SVG path
  (scikit-image contours, 189 points, Catmull-Rom → cubic Bézier; checked by overlay: no visible
  fringe). Fill `#0000bd` (the logo's blue), a 3-unit navy outline `#14164f` drawn under the fill
  (`paint-order: stroke`) so it matches the background's ink lines. The body never changes shape.
- **Face from Couch draft 1** (FLUX.2 klein 4B, workflow "Springy – Maskottchen aus dem Logo"):
  two big googly eyes sitting on top of the swirl's upper arc (white, navy ring, black pupil with a
  white highlight), two short navy brows above them, a small smile in the curl below the eyes.
- `web/logo.svg` is the same body without a face: the favicon of kiosk and admin, and the brand mark
  in the admin header and on the login card.

### Moods — `springyMood(phase)` (pure)
| Kiosk phase | Mood | What Springy does |
|---|---|---|
| `start` | `hello` | big, hops and tilts as a greeting; bubble "Hallo, ich bin Springy!" (shown, not spoken: audio is locked until "Los geht's") |
| `ask`, `pick`, `unknown`, `welcome`, `topics` | `idle` | small, beside each prompt; springs (squash & stretch) every few seconds |
| `thanks` | `cheer` | big, jumps twice with happy (^ ^) eyes and raised brows |
| `loading`, `unregistered`, `offline` | `hidden` | not shown (adult screens) |

On every mood: **blinks** about every 4.5 s; **talks** — the mouth opens and closes every 0.16 s —
exactly while the shared speech queue is speaking (`onSpeaking`), whoever started it.

### Looking — `pupilOffset(eye, target, max)` (pure)
A tapped 🔊 (`SpeakButton` or the prompt's 🔊) reports its centre with `lookAt(point)`. Springy turns
both pupils towards it — the vector from the eye centre to the target, scaled down to at most `max`
(5 SVG units) — and looks straight ahead again after 2.5 s. A target at the eye centre, or a
non-finite one, gives `{ x: 0, y: 0 }`.

### Where Springy is
- **Every prompt** (`Prompt`: ask, picture code, topic home, "schon gemacht", questions): a small
  Springy (48 px phone, up to 92 px tablet) left of the heading; the heading is drawn as Springy's speech
  bubble (paper, ink outline, a tail pointing at Springy); its 🔊 sits inside the bubble at its
  end, after a dashed divider (the heading itself stays only the text).
- **Start screen:** big Springy (clamp 140–240 px) above "Los geht's" instead of the 👋😊.
- **Thanks screen:** big cheering Springy above "Danke!" / "Alles geschafft!"; the confetti stays.
- Exactly one Springy on screen. It is decorative: `aria-hidden="true"`, never a tap target
  (`pointer-events: none`), never covers a button.

### What Springy says
- After "Los geht's" the first thing a child hears is **"Hallo, ich bin Springy!"** followed by
  "Hast du schon ein Geheimzeichen?" (`sayParts`, two clips). New fixed phrase
  `PHRASE.springyHello`; like every fixed phrase it gets its Thorsten clip at server start.
- Nothing else is new: Springy's speech bubbles show the prompts the kiosk already speaks.

### Pronunciation — `spokenText(text)` (pure)
The German voice reads "Springy" as *Schpringi* (`ʃpɾˈɪŋiː`, checked with the model's G2P). The
owner's name is English, so the queue gives the voice service a spoken form: a word followed by
" Springy" becomes "<word>s Pringy" — "ich bin Springy" → "ich bins Pringy" →
`ɪç bɪns pɾˈɪŋiː`, which runs together as *ich bin Springy*. Only the text sent to the voice service
changes: the clip is still keyed and looked up by the displayed text, the screen still shows
"Springy", and the rule also applies to admin texts. "Springy" at the very start of a text keeps
the German reading (no word to attach the s to).

### Motion rules
- Only `transform` and `opacity` are animated (smooth on old iPads).
- `prefers-reduced-motion: reduce` → no springing, hopping, jumping or pupil movement; the mouth is
  shown open while speaking instead of flapping; blinking stays off.

## Nature background
- **Backdrop:** `web/kiosk/assets/wiese.webp` — a picture-book meadow (watercolour, dark-green ink
  outlines: wildflowers along the bottom, a pond, two trees, soft hills, a calm empty sky), made
  with Couch (FLUX.2 klein 4B text-to-image, workflow "Wie isses – Comic-Naturhintergrund",
  1408 × 1056) and converted to WebP without its ComfyUI metadata (≤ 250 KB). Fixed behind the
  page, `background-size: cover`, anchored at the bottom.
- **Animated layers** (`Nature.tsx`, inline SVG in the same ink style, `aria-hidden`,
  `pointer-events: none`): three clouds drifting across the sky at different speeds (70–140 s), a
  sun in the top-right corner whose rays turn slowly (60 s per turn), two butterflies fluttering
  on long loops (wings 0.35 s, path 18–26 s). Reduced motion → everything still.
- **Readability:** the screens sit on a **paper panel** (paper at 92 %, ink outline, sketch edge);
  the active topic's colour now tints that panel (`color-mix(var(--topic) 26%, paper)`) instead of
  the whole page. Ink text on the panel stays ≥ 4.5 : 1.

## Sketch buttons (NinaNatur "Draft Sketch")
Taken from NinaNatur `frontend/src/themes/draft-sketch/ours/controls.css`:
ink `#1c2419`, paper `#fbfaf6`, wash `color-mix(#8fbf6a 34%, paper)`, deep wash
`color-mix(#6fa24f 52%, paper)`, edge `255px 14px 225px 16px / 16px 225px 14px 255px`.
- Every kiosk button: 1.5 px ink border (2 px on tiles), the hand-drawn edge, a hard
  `1px 2px` shadow at 40 % ink; pressed → `translate(1px, 2px)` without shadow; hover (mouse) →
  `rotate(-0.6deg)`.
- Primary buttons ("Los geht's", "Verstanden", "Fertig", "Nochmal versuchen") use the deep wash
  with ink text; secondary ones ("Überspringen", "Zurück", "Tschüss", the two choice cards) paper
  or wash. Tiles keep their own colours (topic colour, face tint, white).
- A picked tile: drawn heavier (4 px ink border) and ringed in green; options also show the ✓ —
  never colour alone.
- 🔊 buttons: never the 🔊 emoji, but a **drawn loudspeaker** (`SpeakerIcon`: ink line, sun-yellow
  body, two sound waves) **without a circle**, straight on the colour it belongs to — the tab,
  the tile's corner, the bubble's end, beside "Fertig"/"Überspringen"/"Tschüss". The tap area
  stays ≥ 40 px (48 px on tiles and in the bubble); pressed it sits down like every button;
  disabled it fades. **While its text is being read, its waves pulse** (until the speech queue
  falls silent or anything else interrupts it), so a child sees which 🔊 is talking; reduced
  motion → the waves stay still.
- Tabs: the hand-drawn edge on top, the topic colour, the ink border.
- Reduced motion → no rotate/translate.

## Font
**Playpen Sans** (TypeTogether, SIL OFL 1.1) from `@fontsource/playpen-sans`, latin 400 and 600
(≈ 80 KB each), bundled like Andika before; Andika (kiosk-only until now) and its package are gone.
The admin keeps the system font. Chosen over
Andika, Patrick Hand, Fredoka, Comic Neue and Baloo 2 in a side-by-side preview: playful, but
single-storey a and g as taught at school, and l / I / 1 easy to tell apart. Four tabs, their 🔊
and "Tschüss" must still fit one row at 1024 px.

## Business Rules
1. Springy is decoration: `aria-hidden`, no tap target, never covers or blocks a button.
2. Springy's mouth moves only while the shared speech queue speaks; Springy never starts speech.
3. Tapping a 🔊 still only reads aloud (doc 01) — it now also makes Springy look at it.
4. One Springy on screen at a time; none on the adult screens.
5. The clip key and the screen always use the displayed text; only the voice service sees
   `spokenText()`.
6. No asset is loaded from another domain; the backdrop carries no ComfyUI metadata.
7. Reduced motion stills every animation of this feature.

## Data Flow
See `.mdd/audits/flow-springy-naturlook-2026-11-09.md`. Phase → `springyMood`; speech queue
`busy` → `onSpeaking` → talking; 🔊 tap → `lookAt` → `pupilOffset`; queue `runOne` →
`spokenText` → voice service. The topic colour moves from the page background to the panel.

## Dependencies
- `01-schul-umfrage`: the kiosk flow, `Prompt`/`SpeakButton`, the speech queue, fixed phrases and
  the voicing queue.

## Security
No new input, route or storage. Static, self-hosted assets only.

## Provenance and licences
- Springy face and the meadow: Couch on the owner's PC, FLUX.2 klein 4B (Apache-2.0). Stylised
  illustrations, not realistic depictions of real people or events — no AI label required
  (EU AI Act Art. 50); provenance noted here and in `THIRD_PARTY.md`.
- Playpen Sans: SIL OFL 1.1, listed in `THIRD_PARTY.md`.

## Known Issues
(none yet)

## Bugs
(none yet — populated by /mdd bug when issues are reported)
