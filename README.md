# MacFit

Ein Bodybuilding-Spiel für den Browser. Kein Server, keine Abhängigkeiten, kein Build-Schritt —
`index.html` doppelklicken und loslegen. Gemacht fürs Handy, läuft aber auch am Desktop.

## Worum geht's

Du bist neu im Gym "MacFit" und fängst schmal an. Du trainierst an Geräten, wirst stärker,
steigst Level auf und schaltest dabei mehr Geräte und mehr Zeug im Shop frei — von Whey und
Creatin bis zu Substanzen, die schnelle Gains bringen und dafür deine Gesundheit ruinieren.

## Start

Jeder Start beginnt mit einem kurzen Vorspann: du fährst mit dem Sportwagen vor dem Studio
vor, steigst aus, nimmst die Sporttasche und gehst rein. Antippen überspringt ihn.

Dazu läuft die **Titelmusik**: ein eigenes Stück im Stil des Dream-Trance der Neunziger —
Klavier-Arpeggio über a-Moll–F–C–G, Flächen-Pad, ab dem zweiten Takt Kick, Offbeat-Bass und
Leadmelodie. Es liegt keine Musikdatei im Projekt; `js/core/audio.js` erzeugt alles zur
Laufzeit per Web Audio. Abschalten geht unter **Körper → Einstellungen → Titelmusik**.

Beim allerersten Laden bleibt der Vorspann stumm — Browser lassen Ton erst nach einer
Nutzergeste zu. Ab dem nächsten Film spielt sie. Wer lieber ein eigenes Stück hören will,
legt es als `assets/theme.mp3` ab; siehe `assets/LIESMICH.txt`.

Beim allerersten Mal wird danach deine **Mitgliedskarte** ausgestellt: Name, Trainings-
klamotten und freiwillig ein Foto. Die Farbe siehst du im Vorspann, an den Geräten und am
Avatar wieder.

Das Foto kommt aus einem normalen Dateifeld — am Handy also Kamera oder Galerie — und wird
vor dem Speichern auf Passbildgröße (132 × 168) heruntergerechnet. Ein unbearbeitetes
Handyfoto würde den `localStorage` sprengen. Es verlässt das Gerät nicht. Ändern oder
entfernen kannst du es jederzeit im Tab **Körper**, ganz oben auf der Karte.

Einen bestehenden Spieler löschst du unter **Körper → Einstellungen → Spieler zurücksetzen**;
danach wird direkt eine neue Karte ausgestellt.

## Profil mitnehmen

Der Spielstand liegt im `localStorage` und hängt damit an genau einem Browser auf genau einem
Gerät. Unter **Körper → Einstellungen → Profil sichern und übertragen** legst du eine
JSON-Datei mit allem an: Tag, Level, XP, Geld, Muskelwerte, Gesundheit, laufende Kuren,
Statistik, Verlauf, Einstellungen und die Mitgliedskarte samt Foto.

Zurück geht es über „Profil laden" an derselben Stelle — oder gleich bei der
**Neuanmeldung**: dort steht unter der Karte ein „Vorhandenes Profil laden", damit ein Umzug
nicht bei Tag 1 anfängt. Steht auf dem Gerät schon ein Spieler, wird vorher gefragt.

Angenommen wird die Exportdatei und ein nackter Spielstand, wie er im Browserspeicher steht.
Fehlende Felder aus einer älteren Version werden ergänzt, das Level wird aus den XP neu
bestimmt. Dateien aus einer neueren Spielversion werden abgelehnt statt halb geladen.

Am Handy gibt es zusätzlich „Profil senden": ein Download landet dort irgendwo im
Dateisystem, das Teilen-Menü bringt die Datei dagegen direkt in Mail, Cloud oder Messenger.

## Steuerung

Ein Satz ist ein Timing-Spiel: ein Marker läuft über eine Leiste, du tippst irgendwo auf die
untere Bildschirmhälfte.

- **Grüne Zone** → perfekte Wiederholung, voller Reiz
- **Gelber Rand** → unsaubere Form, halber Reiz
- **Daneben oder zu spät** → verrissen, kein Reiz

Die Zone schrumpft mit jeder Wiederholung im Satz und wird enger, je müder die Partie ist.
Mehr Intensität bringt mehr Reiz, macht das Timing aber härter.

Dazu **Geräusche im Stil von Amiga 500 und C64**: Rechteckwellen statt Sinustönen, harte
Hüllkurven, Tonhöhen, die in Rastern springen statt zu gleiten, und der ganze Effektweg
durch ein 4-Bit-Raster. Gewicht auflegen klirrt, eine saubere Wiederholung antwortet mit
einem SID-Arpeggio nach oben, eine verrissene mit einem Ton, der stufenweise abstürzt.
Satzende und Levelaufstieg bekommen die Fanfare, die damals hinter jedem Level stand.

Dieselben Geräusche liegen auch auf dem Rest: Motor und Reifen im Vorspann, Autotür,
Schiebetür des Studios, Kasse beim Einkauf im Shop und eine absteigende Tonfolge beim
Schlafengehen. Abschalten unter **Körper → Einstellungen → Geräusche**, unabhängig von der
Titelmusik.

## Erfolge teilen

Im Tab **Körper** gibt es „Erfolge teilen“. Du wählst eine Pose — Doppelter Bizeps,
Lat-Spreizen, Most Muscular oder Bauch und Beine — und bekommst ein fertiges Bild: deine
Figur in dieser Pose, gebaut aus deinen aktuellen Muskelwerten, darunter Fitness-Index,
Rang, Masse, Level und Tag. Ganz unten steht der Einladungslink, damit auch ein
weitergeleiteter Screenshot noch zum Spiel führt.

Geteilt wird über das Teilen-Menü des Geräts — dort stehen WhatsApp, Signal, Mail und alles
andere, was installiert ist. Ein Knopf, drei Stufen: Bild und Text zusammen, sonst Text im
Teilen-Menü und Bild in die Downloads, sonst Bild speichern und Text in die Zwischenablage.
Der Dialog sagt vorher, welche Stufe dein Browser kann.

Hinaus geht nur Bild und Text. Dein Foto und dein Spielstand bleiben auf dem Gerät.

## Der Tagesablauf

Jeder Tag hat begrenzte Energie. Ist sie leer, gehst du schlafen — **erst dann wächst der
Muskel**. Trainingsreiz wird über Nacht in Masse umgerechnet, die Ermüdung klingt ab, Kuren
und Nebenwirkungen ticken einen Tag weiter, und es gibt Geld.

Der Tageswechsel ist eingerahmt: Beim Schlafen siehst du, wie du das Studio verlässt und
wegfährst, danach kommt der Tagesreport mit dem Schlaf-Countdown, und „Weiter trainieren“
spielt die Anfahrt wie beim Spielstart. Beide Filme lassen sich antippen und überspringen.

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
js/core/            util, events, storage, ticker, haptics, audio (Musik + Geräusche)
js/data/            muscles, exercises, supplements, levels, outfits, scenes — reine Spieldaten
js/game/            state, stats, fitness, training, progression, supplements, economy, day
js/ui/              router, hud, avatar, screens, toast, modal, report, intro, create,
                    membercard, poses, share, transfer
js/ui/pixel|figure|scene   Pixel-Grafik: Palette, Figuren-Rig, Szenenaufbau
js/main.js          Bootstrap
```

Regel: `ui/` ruft `game/` auf, `game/` kennt die UI nie und meldet sich nur über den Event-Bus.
Balancing-Werte stehen ausschließlich in `js/data/`.

Der Spielstand liegt im `localStorage` unter `macfit.save.v1` und wird nach jedem Satz
gespeichert. Spieler zurücksetzen geht im Tab "Körper".

## Konsolen-Helfer

```js
MacFit.debug.sleepDays(10)              // zehn Nächte durchsimulieren
MacFit.debug.fakeSet('bankdruecken', 1) // Satz mit 100 % Form
MacFit.debug.addXp(2000)
MacFit.debug.addMoney(5000)
MacFit.debug.state()                    // kompletter Spielstand
```
