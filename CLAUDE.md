# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Was das ist

MacFit — ein Bodybuilding-Browserspiel. Reines Vanilla-JS ohne Build-Schritt, ohne
npm, ohne Tests, ohne Framework. Ausgeliefert über GitHub Pages vom `main`-Branch.
Alles im Repo (Code-Kommentare, UI-Texte, Commits) ist auf Deutsch; in JS-Kommentaren
werden Umlaute als ae/oe/ue umschrieben, in UI-Strings und im README stehen echte Umlaute.

## Entwickeln und Testen

- **Lokal starten:** kleiner HTTP-Server im Repo-Wurzelverzeichnis, z. B.
  `python -m http.server 8000` — dann `http://localhost:8000`. `file://` funktioniert
  seit MacFit Online **nicht mehr**, weil der Start eine Supabase-Verbindung braucht
  (Pflicht-Login; Zugangsdaten stehen öffentlich in `js/core/cloudconfig.js`).
- **Kein Build, kein Lint, keine Testsuite.** Getestet wird von Hand im Browser;
  fürs Balancing gibt es Konsolen-Helfer: `MacFit.debug.sleepDays(10)`,
  `.fakeSet('bankdruecken', 1)`, `.addXp(n)`, `.addMoney(n)`, `.state()`, `.reboot()`.

## Vor jedem Push (Pflicht)

1. **Version erhöhen** — dritte Stelle in `js/core/namespace.js` (`version: '1.x.y'`),
   auch bei Kleinständerungen. Nur daran ist am Handy erkennbar, ob GitHub Pages
   schon den neuen Stand liefert; `js/core/update.js` liest genau diese Zeile für
   den Auto-Update-Check.
2. **Cache-Buster mitziehen** — alle `?v=1.x.y`-Query-Strings in `index.html`
   müssen auf dieselbe neue Version.

Größere Umbauten laufen auf einem eigenen Branch und werden erst nach Freigabe
des Nutzers nach `main` gemergt (Test vorher über Pages-Umlenkung auf den Branch).

## Architektur

Klassische `<script>`-Tags statt ES-Module. Alles hängt am globalen `window.MacFit`
mit den vier Unterräumen `core`, `data`, `game`, `ui`. Jede Datei ist eine IIFE, die
sich an `MF.<bereich>.<name>` hängt. **Die Ladereihenfolge in `index.html` ist die
Abhängigkeitsauflösung** — eine neue Datei muss dort an der richtigen Stelle (mit
`?v=`-Suffix) eingetragen werden: vendor → core → data → game → ui → `js/main.js`.

Schichtregeln (strikt eingehalten):

- `ui/` ruft `game/` auf; `game/` kennt die UI **nie** und meldet sich nur über den
  Event-Bus (`js/core/events.js`, `MF.core.events.on/emit`). Die Verdrahtung
  Event → UI-Reaktion steht zentral in `wireEvents()` in `js/main.js`.
- Balancing-Werte (Übungen, Level, Substanzen, Rivalen, Wettkampf …) stehen
  **ausschließlich** in `js/data/` — reine Datenobjekte ohne Logik.
- Pixel-Grafik: `js/ui/pixel.js` (Palette/Primitive) → `figure.js` (Figuren-Rig) →
  `scene.js`/`poses.js`/`avatar.js`. Avatar, Gerätefiguren und Posen-Teilen-Bild
  rechnen mit denselben Körperproportionen — Änderungen daran betreffen alle drei.

## Spielstand und Cloud

- Lokal: `localStorage` unter `macfit.save.v1` (`js/core/storage.js`), gespeichert
  nach jedem Satz plus Autosave alle 15 s plus `pagehide`/`visibilitychange`.
- Cloud führt, das Gerät ist nur Puffer: `js/core/cloud.js` (Supabase, Row Level
  Security). Beim Start entscheidet `cloud.decideBoot(row, local, marker, uid)`
  zwischen `fresh` / `cloud` / `local` / `adopt` / Konflikt-Dialog — der ganze
  Boot-Ablauf (Login-Gate → Standwahl → `startGame` → Vorspann → Spieler-Anlage →
  Tages-Dialogkette) steht in `js/main.js`.
- Ein Sync-Marker im localStorage merkt sich Konto und letzten Abgleich; verlorene
  Uploads werden beim nächsten Start nachgeschoben.
- `.github/workflows/supabase-keepalive.yml` pingt Supabase zweimal pro Woche an,
  damit das Free-Tier-Projekt nicht pausiert wird (sonst startet das Spiel nicht mehr).

## Wichtige Abläufe

- **Tageszyklus:** Muskelwachstum passiert erst beim Schlafen (`js/game/day.js`) —
  Trainingsreiz wird über Nacht in Masse umgerechnet, Kuren/Nebenwirkungen ticken,
  Geld gibt es dann.
- **Satz-Timing-Spiel:** `js/game/training.js` (Logik) + `js/ui/screen-session.js`
  (Leiste/Marker). `beginSet` → Treffer-Liste (`'perfect'|'ok'|'miss'`) → `finishSet`.
- **Level** wird beim Boot immer aus den XP neu abgeleitet (`levels.levelForXp`),
  damit geänderte Schwellen Bestandsspieler nicht brechen. Profil-Importe aus
  neueren Spielversionen werden abgelehnt statt halb geladen.
