# MacFit

Ein Bodybuilding-Spiel für den Browser. Kein Server, keine Abhängigkeiten, kein Build-Schritt —
`index.html` doppelklicken und loslegen. Gemacht fürs Handy, läuft aber auch am Desktop.

## Worum geht's

Du bist neu im Gym "MacFit" und fängst schmal an. Du trainierst an Geräten, wirst stärker,
steigst Level auf und schaltest dabei mehr Geräte und mehr Zeug im Shop frei — von Whey und
Creatin bis zu Substanzen, die schnelle Gains bringen und dafür deine Gesundheit ruinieren.

## Steuerung

Ein Satz ist ein Timing-Spiel: ein Marker läuft über eine Leiste, du tippst irgendwo auf die
untere Bildschirmhälfte.

- **Grüne Zone** → perfekte Wiederholung, voller Reiz
- **Gelber Rand** → unsaubere Form, halber Reiz
- **Daneben oder zu spät** → verrissen, kein Reiz

Die Zone schrumpft mit jeder Wiederholung im Satz und wird enger, je müder die Partie ist.
Mehr Intensität bringt mehr Reiz, macht das Timing aber härter.

## Der Tagesablauf

Jeder Tag hat begrenzte Energie. Ist sie leer, gehst du schlafen — **erst dann wächst der
Muskel**. Trainingsreiz wird über Nacht in Masse umgerechnet, die Ermüdung klingt ab, Kuren
und Nebenwirkungen ticken einen Tag weiter, und es gibt Geld.

Partien, die länger als vier Tage liegen bleiben, gehen zurück. Wer nur Oberkörper trainiert,
sieht das an der Symmetrie-Wertung und an der Figur.

## Substanzen

Vier Gesundheitswerte — Herz, Leber, Schlaf, Laune — stehen den Gains gegenüber. Basis-Zeug ist
harmlos. Alles darüber kostet Werte, und nach einer anabolen Kur folgt ein Einbruch mit
Masseverlust. Fallen die Werte auf fast null, zwingt dich der Körper in eine Pause.

Wer sauber bleibt, behält den **Natural-Bonus** (+15 % Wachstum, +10 % Erholung). Beide Wege
funktionieren.

> Das Spiel ist Satire. Substanzen, Wirkungen und Zahlen sind frei erfunden und weder
> Empfehlung noch Anleitung.

## Aufbau

Klassische `<script>`-Tags statt ES-Modulen, damit `file://` funktioniert. Alles hängt an einem
globalen `window.MacFit`.

```
index.html          Grundgerüst + Skripte in Ladereihenfolge
css/                base (Reset/Farben) · layout (Gerüst) · components (Bausteine)
js/core/            util, events, storage, ticker, haptics
js/data/            muscles, exercises, supplements, levels — reine Spieldaten
js/game/            state, stats, training, progression, supplements, economy, day
js/ui/              router, hud, avatar, screens, toast, modal, report
js/main.js          Bootstrap
```

Regel: `ui/` ruft `game/` auf, `game/` kennt die UI nie und meldet sich nur über den Event-Bus.
Balancing-Werte stehen ausschließlich in `js/data/`.

Der Spielstand liegt im `localStorage` unter `macfit.save.v1` und wird nach jedem Satz
gespeichert. Zurücksetzen geht im Tab "Körper".

## Konsolen-Helfer

```js
MacFit.debug.sleepDays(10)              // zehn Nächte durchsimulieren
MacFit.debug.fakeSet('bankdruecken', 1) // Satz mit 100 % Form
MacFit.debug.addXp(2000)
MacFit.debug.addMoney(5000)
MacFit.debug.state()                    // kompletter Spielstand
```
