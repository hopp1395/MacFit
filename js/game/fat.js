/* Körperfett. Bis hierher galt im Spiel: mehr ist besser. Der zweite Wert
   neben der Masse macht daraus eine Abwägung.

   Jede Nacht wird gegengerechnet, was reingegangen ist und was verbrannt
   wurde:

     Zufuhr     eine Grundzufuhr, die auch an Ruhetagen läuft, plus alles,
                was an der Theke getrunken wurde (der Mass-Gainer schlägt
                deutlich zu Buche)
     Verbrauch  jeder Satz zählt, Konditionssätze fünffach; dazu Kuren mit
                burn-Wert (Thermo-Zeug)

   Der Wert wirkt an drei Stellen:
     Wachstum    ein leichter Überschuss hilft beim Muskelaufbau
                 (die Massephase), zu wenig und zu viel bremsen
     Definition  geht in den Fitness-Index und auf die Wettkampfbühne
     Aussehen    Taille, Bauchmuskeln und Bauch — im Avatar, in den Posen und
                 im Seitenriss der Trainingsfigur

   Zusammen ergibt das den Rhythmus, den es vorher nicht gab: vor der
   Meisterschaft runter, danach wieder aufbauen. */
(function (MF) {
  'use strict';

  var util = MF.core.util;

  var MIN = 5, MAX = 42;
  var BASE_INTAKE = 0.25;    /* Prozentpunkte pro Nacht ohne Zutun */
  /* Der Verbrauch waechst mit der Wurzel aus dem Umfang, nicht linear: der
     zwanzigste Satz verbrennt nicht so viel wie der zweite. Linear
     gerechnet war ein fleissiger Spieler nach zwei Wochen am Boden des
     Fettbereichs und kam da nie wieder weg. */
  var BURN_K = 0.09;
  var KONDITION_WEIGHT = 4;  /* ein Konditionssatz zaehlt wie fuenf normale */

  /* Ab hier ist nichts mehr zu sehen; darunter zeichnet sich der Bauch ab. */
  var DEF_FLOOR = 26, DEF_SPAN = 18;
  /* Und ab hier faengt das Gegenteil an: die Kanten verschwinden nicht nur,
     es kommt etwas dazu. Vorher endete oberhalb von DEF_FLOOR jede sichtbare
     Wirkung — vierzig Prozent Fett sahen aus wie sechsundzwanzig. Die beiden
     Baender ueberlappen sich zwischen 21 und 26, sonst gaebe es dazwischen
     einen Bereich, in dem sich beim Zunehmen gar nichts tut. */
  var SOFT_FLOOR = 21, SOFT_SPAN = 18;

  /* Wachstum je nach Fettstand: Stuetzstellen, dazwischen linear. Ein
     leichter Ueberschuss hilft wirklich, ein grosser bringt nichts mehr. */
  var GROWTH = [
    { at: 6, f: 0.84 },
    { at: 10, f: 0.94 },
    { at: 15, f: 1.03 },
    { at: 20, f: 1.07 },
    { at: 26, f: 1.00 },
    { at: 32, f: 0.92 },
    { at: 42, f: 0.86 }
  ];

  var LABELS = [
    { below: 9, text: 'schalentrocken', tone: 'good' },
    { below: 13, text: 'definiert', tone: 'good' },
    { below: 18, text: 'schlank', tone: 'good' },
    { below: 23, text: 'Massephase', tone: 'warn' },
    { below: 29, text: 'weich', tone: 'warn' },
    { below: 99, text: 'aus der Form', tone: 'bad' }
  ];

  function state() { return MF.game.state.get(); }

  function percent() {
    var s = state();
    return s ? s.fett : 18;
  }

  /* 0..1 — wie scharf die Figur gezeichnet ist. */
  function definition() {
    return util.clamp((DEF_FLOOR - percent()) / DEF_SPAN, 0, 1);
  }

  function softnessAt(p) {
    return util.clamp((p - SOFT_FLOOR) / SOFT_SPAN, 0, 1);
  }

  /* 0..1 — wie weich die Figur gezeichnet ist: das Gegenstueck zu
     definition(). Beides zusammen macht aus dem Fettstand eine Achse, die in
     beide Richtungen sichtbar ist. */
  function softness() {
    return softnessAt(percent());
  }

  /* Fremde Koerper (der Rivale) bringen nur ihre definition mit. Aus ihr
     laesst sich der Fettstand zurueckrechnen, den sie bedeutet — so braucht
     data/rivals.js keine zweite Zahl. */
  function softnessFor(def) {
    return softnessAt(DEF_FLOOR - DEF_SPAN * util.clamp(def, 0, 1));
  }

  function label() {
    var v = percent();
    for (var i = 0; i < LABELS.length; i++) {
      if (v < LABELS[i].below) return LABELS[i];
    }
    return LABELS[LABELS.length - 1];
  }

  function growthFactor() {
    var v = percent();
    if (v <= GROWTH[0].at) return GROWTH[0].f;
    for (var i = 1; i < GROWTH.length; i++) {
      if (v <= GROWTH[i].at) {
        var a = GROWTH[i - 1], b = GROWTH[i];
        return util.lerp(a.f, b.f, (v - a.at) / (b.at - a.at));
      }
    }
    return GROWTH[GROWTH.length - 1].f;
  }

  /* Was heute schon getrunken wurde — game/shakes.js bucht hier ein. */
  function intakeToday() {
    var s = state();
    return s.today.day === s.day ? (s.today.fatIn || 0) : 0;
  }

  function addIntake(amount) {
    var s = state();
    if (s.today.day !== s.day) {
      s.today.day = s.day;
      s.today.reps = 0;
      s.today.perfect = 0;
      s.today.xp = 0;
      s.today.kondition = 0;
      s.today.fatIn = 0;
    }
    s.today.fatIn = (s.today.fatIn || 0) + amount;
  }

  /* Kuren, die Fett verbrennen (Thermo-Zeug). */
  function courseBurn() {
    var sum = 0;
    MF.game.stats.activeCourses().forEach(function (c) {
      sum += c.def.burn || 0;
    });
    return sum;
  }

  /* Die Nacht. sets ist die Gesamtzahl der Saetze, kondition davon die
     Konditionssaetze. Rueckgabe fuer den Tagesbericht. */
  function tickNight(sets, kondition) {
    var s = state();
    var intake = BASE_INTAKE + intakeToday();
    var burn = Math.sqrt(Math.max(0, sets + kondition * KONDITION_WEIGHT)) * BURN_K
      + courseBurn();

    var delta = intake - burn;
    /* Unter 12 Prozent haelt der Koerper dagegen — die letzten Kilo sind
       die zaehesten. */
    if (delta < 0 && s.fett < 12) delta *= 0.5;

    var before = s.fett;
    s.fett = util.clamp(s.fett + delta, MIN, MAX);

    return {
      before: before,
      after: s.fett,
      delta: util.round(s.fett - before, 2),
      intake: util.round(intake, 2),
      burn: util.round(burn, 2)
    };
  }

  MF.game.fat = {
    MIN: MIN,
    MAX: MAX,
    percent: percent,
    definition: definition,
    softness: softness,
    softnessFor: softnessFor,
    label: label,
    growthFactor: growthFactor,
    intakeToday: intakeToday,
    addIntake: addIntake,
    tickNight: tickNight
  };
})(window.MacFit);
