---
id: 03-installierbare-app
title: Installierbare App — web app manifest, app icon, offline-only service worker; install via Edge or the Microsoft Store
edition: wieisses
depends_on: [01-schul-umfrage, 02-springy-naturlook]
relates: [01-schul-umfrage, 02-springy-naturlook]
source_files:
  - web/public/manifest.webmanifest
  - web/public/sw.js
  - web/public/offline.html
  - web/public/offline.css
  - web/public/icons/icon.svg
  - web/public/icons/icon-maskable.svg
  - web/public/icons/icon-192.png
  - web/public/icons/icon-512.png
  - web/public/icons/icon-maskable-512.png
  - web/public/icons/apple-touch-icon.png
  - dev/app-icons.ts
  - web/index.html
  - web/admin/index.html
  - web/kiosk/main.tsx
  - vite.config.ts
routes: []
models: []
test_files:
  - tests/unit/app-manifest.test.ts
  - tests/unit/service-worker.test.ts
data_flow: greenfield
last_synced: 2026-11-09
status: complete
phase: all
mdd_version: 11
tags: [pwa, web-app-manifest, service-worker, app-icon, microsoft-store, pwabuilder, edge-install, offline-page]
path: Umfrage/App
integration_contracts: []
satisfies_contracts: []
known_issues: []
security_read_sites: []
sister_projects: []
---

# 03 — Installierbare App

## Purpose
"Wie isses?" can be installed as an app — from Edge or Chrome ("Diese Website als App
installieren"), on an iPad or Android tablet's home screen, or as a Microsoft Store app packaged
with PWABuilder. The app is only a window onto https://wieisses.w3rth.de/: the database, the
admin, the Thorsten voice and every update stay on the server, so a push to `main` still updates
every installed app (doc 01, Deployment) and no store update is ever needed for a new version.

## Architecture
```
web/public/  (Vite publicDir: copied to dist/ unhashed, so these URLs never change)
  manifest.webmanifest   name, icons, start_url "/", scope "/", standalone (fullscreen first)
  sw.js                  service worker: page loads go to the network; only when that fails,
                         the cached offline page answers. Nothing else is touched or cached.
  offline.html + .css    "Keine Verbindung", retries every 20 s (meta refresh, CSP-safe)
  icons/                 icon.svg + PNGs (192, 512, maskable 512, apple-touch 180)
dev/app-icons.ts         draws the icon SVGs from Springy's body path, renders the PNGs (macOS)
web/kiosk/main.tsx       registers /sw.js in production builds only
```

## App icon
Springy (the logo with its face, `springy-body.ts`) sitting on the sun: a sun-yellow disc
(`#ffd54a`, ink ring `#8a5a00` — the kiosk's sun) with the navy Springy on it. `icon.svg` and its
PNGs have a transparent background around the disc (Windows taskbar, start menu). The maskable icon
fills the whole square with sun-yellow and keeps Springy inside the central 80 % safe zone (Android
cuts it to a circle or squircle). The PNGs are rendered by `dev/app-icons.ts` with macOS QuickLook
(`qlmanage`): no new dependency; re-run it after changing the icon and commit the PNGs.

## Manifest
`id` and `start_url` "/", `scope` "/" (the admin at /admin/ opens inside the app too, so the sun
gate works in the app), `display` "standalone" with `display_override` ["fullscreen",
"standalone"], `lang` "de", `background_color`/`theme_color` `#fff8ec` (the kiosk's paper),
`categories` ["education"], icons: SVG (any), 192 and 512 PNG (any), 512 PNG (maskable). Both pages
link it; the kiosk page also links the apple-touch icon.

## Service worker (`sw.js`)
- **Only page loads** (`request.mode === 'navigate'`: `/`, `/admin/…`) are handled: network
  first; when the network fails, the cached `offline.html`. API calls, built assets, media and
  voice clips are never intercepted — **no child's data is ever cached** (CLAUDE.md, children's data).
- Install: caches `offline.html`, `offline.css` and `icons/icon.svg` into `wieisses-offline-v1`,
  then `skipWaiting()`. Activate: deletes every other cache, `clients.claim()`.
- Registered from the kiosk (`main.tsx`) in production builds only, after `load`; a failure is
  ignored (the kiosk works without it). Its scope "/" covers the admin as well.
- Served `no-cache` like every unhashed file, so a changed `sw.js` is picked up on the next load.
- The kiosk's new-build check fetches `/` with `fetch()` (mode `cors`), not a navigation, so the
  service worker never sees it; `location.reload()` between two children is a navigation and goes
  to the network first — a new build still arrives at once.

## Installing
- **Edge / Chrome on Windows:** open https://wieisses.w3rth.de/, menu → Apps → "Diese Website als
  App installieren". The app gets a start-menu entry and its own window. An installed app keeps
  its storage apart from the browser: **register each installed app once** (sun → Admin → Tablets,
  doc 01).
- **Locked kiosk (optional):** Windows "Zugewiesener Zugriff" (Assigned Access) with Microsoft Edge
  in kiosk mode on the URL — the tablet then shows only the survey.
- **iPad / Android:** Share → "Zum Home-Bildschirm" / "App installieren".
- **Microsoft Store (done by the owner, not in this repo):** PWABuilder (pwabuilder.com) → enter the
  URL → Windows package → upload the MSIX in Partner Center (individual developer account: free
  since 2025, ID check). The listing needs a privacy-policy URL (children's data: no names, no IPs,
  aggregates only), the age-rating questionnaire, screenshots and a description; certification
  takes a few days. Visibility can be "hidden — reachable only by direct link".

## Business Rules
1. The service worker answers only failed page loads, and only with the offline page; it never
   caches or serves API responses, media, clips or built assets.
2. Manifest, service worker, offline page and icons are unhashed files with fixed URLs.
3. Nothing is loaded from another domain (CLAUDE.md); the offline page has no inline style or
   script (CSP `style-src 'self'; script-src 'self'`).
4. The icon is Springy on the sun; the maskable icon keeps Springy inside the 80 % safe zone.

## Data Flow
Install: browser reads `/manifest.webmanifest` → icons. Page load: navigation → `sw.js` →
network (→ `offline.html` from the cache only when the network fails). Everything else: page →
network, as before.

## Dependencies
- `01-schul-umfrage`: the kiosk, its new-build reload between two children, device registration.
- `02-springy-naturlook`: Springy's body path and face, the sun's colours, the sun admin gate.

## Security
CSP unchanged: `default-src 'self'` covers the manifest and the worker (`script-src 'self'`).
The offline page carries the server's headers from when it was cached.

## Known Issues
(none)
