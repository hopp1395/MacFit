/* Trainingsgeräte.
   energy   = Energiekosten pro Satz
   reps     = Wiederholungen (= Tipp-Versuche) pro Satz
   stimulus = Grundreiz pro Satz bei perfekter Form
   speed    = Marker-Durchläufe pro Sekunde (höher = schwerer zu treffen)
   zone     = Breite der perfekten Zone (Anteil der Leiste)
   Späte Geräte sind schneller und enger — dafür deutlich ergiebiger.

   Kondition (kind: 'kondition'): Cardio, Spinning, Yoga. Sie bringen kaum
   Reiz, dafür Gesundheit — health gibt an, was ein sauberer Satz an Herz,
   Leber, Schlaf und Laune zurückholt (mit der Form skaliert). recovery
   senkt zusätzlich die Ermüdung ALLER Partien; sie hängen an der Partie,
   die tatsächlich arbeitet, und tauchen dort in der Geräteliste auf. */
(function (MF) {
  'use strict';

  var LIST = [
    /* --- Einstieg --------------------------------------------------------- */
    { id: 'kurzhantel-curl', name: 'Kurzhantel-Curl', icon: '💪', muscle: 'bizeps',
      unlockLevel: 1, energy: 10, reps: 10, stimulus: 9, speed: 0.50, zone: 0.30,
      desc: 'Der Klassiker vor dem Spiegel. Jeder fängt hier an.' },

    { id: 'bankdruecken', name: 'Bankdrücken', icon: '🏋️', muscle: 'brust',
      unlockLevel: 1, energy: 16, reps: 10, stimulus: 14, speed: 0.55, zone: 0.28,
      desc: 'Die Frage aller Fragen: "Wie viel drückst du?"' },

    { id: 'latzug', name: 'Latzug', icon: '🪝', muscle: 'ruecken',
      unlockLevel: 1, energy: 15, reps: 10, stimulus: 13, speed: 0.52, zone: 0.28,
      desc: 'Breiter Rücken beginnt am Seilzug.' },

    { id: 'beinpresse', name: 'Beinpresse', icon: '🦵', muscle: 'beine',
      unlockLevel: 1, energy: 20, reps: 10, stimulus: 16, speed: 0.48, zone: 0.30,
      desc: 'Unbeliebt, unverzichtbar. Leg Day lässt sich nicht ewig schieben.' },

    { id: 'crunch-maschine', name: 'Crunch-Maschine', icon: '🎯', muscle: 'bauch',
      unlockLevel: 1, energy: 9, reps: 12, stimulus: 8, speed: 0.58, zone: 0.30,
      desc: 'Sixpack wird in der Küche gemacht — aber hier vorbereitet.' },

    /* --- Level 2-4 -------------------------------------------------------- */
    { id: 'schulterdruecken', name: 'Schulterdrücken', icon: '🧱', muscle: 'schultern',
      unlockLevel: 2, energy: 14, reps: 10, stimulus: 13, speed: 0.60, zone: 0.26,
      desc: 'Runde Schultern lassen die Taille schmaler wirken.' },

    { id: 'trizepsdruecken', name: 'Trizepsdrücken am Kabel', icon: '🔗', muscle: 'trizeps',
      unlockLevel: 2, energy: 11, reps: 12, stimulus: 10, speed: 0.62, zone: 0.26,
      desc: 'Zwei Drittel des Oberarms sind Trizeps. Merkt sich keiner.' },

    { id: 'wadenheben', name: 'Wadenheben', icon: '🐄', muscle: 'waden',
      unlockLevel: 3, energy: 8, reps: 15, stimulus: 8, speed: 0.70, zone: 0.24,
      desc: 'Waden sind genetisch. Sagen alle, die sie nie trainieren.' },

    { id: 'rudern-kabel', name: 'Rudern am Kabel', icon: '🚣', muscle: 'ruecken',
      unlockLevel: 3, energy: 18, reps: 10, stimulus: 18, speed: 0.62, zone: 0.24,
      desc: 'Dicke Mitte im Rücken. Schulterblätter zusammen.' },

    { id: 'schraegbank', name: 'Schrägbankdrücken', icon: '📐', muscle: 'brust',
      unlockLevel: 4, energy: 18, reps: 10, stimulus: 19, speed: 0.65, zone: 0.23,
      desc: 'Für die obere Brust — der Unterschied zwischen groß und geformt.' },

    { id: 'seitheben', name: 'Seitheben', icon: '✈️', muscle: 'schultern',
      unlockLevel: 4, energy: 12, reps: 14, stimulus: 14, speed: 0.75, zone: 0.20,
      desc: 'Leichtes Gewicht, saubere Form. Schwung ist Selbstbetrug.' },

    /* --- Level 5-8 -------------------------------------------------------- */
    { id: 'kniebeuge', name: 'Kniebeuge', icon: '⚡', muscle: 'beine',
      unlockLevel: 5, energy: 28, reps: 8, stimulus: 32, speed: 0.68, zone: 0.22,
      desc: 'Die Königsübung. Fordert alles, gibt alles zurück.' },

    { id: 'klimmzug', name: 'Klimmzug', icon: '🔝', muscle: 'ruecken',
      unlockLevel: 5, energy: 22, reps: 8, stimulus: 26, speed: 0.72, zone: 0.21,
      desc: 'Ehrlichste Übung im Gym. Dein Körpergewicht lügt nicht.' },

    { id: 'dips', name: 'Dips', icon: '⬇️', muscle: 'trizeps',
      unlockLevel: 6, energy: 18, reps: 10, stimulus: 22, speed: 0.78, zone: 0.19,
      desc: 'Bankdrücken für Fortgeschrittene, sagt der Typ an der Station.' },

    { id: 'negativ-schraegbank', name: 'Negativ-Schrägbank', icon: '📉', muscle: 'brust',
      unlockLevel: 6, energy: 20, reps: 10, stimulus: 24, speed: 0.76, zone: 0.20,
      desc: 'Kopf nach unten, Hantel zur unteren Brust. Erst einhaken, dann drücken.' },

    { id: 'hammer-curl', name: 'Hammer-Curl', icon: '🔨', muscle: 'bizeps',
      unlockLevel: 6, energy: 14, reps: 12, stimulus: 20, speed: 0.80, zone: 0.19,
      desc: 'Brachialis mitnehmen — der Arm wird dicker, nicht nur höher.' },

    { id: 'kreuzheben', name: 'Kreuzheben', icon: '🩸', muscle: 'ruecken',
      unlockLevel: 7, energy: 34, reps: 6, stimulus: 44, speed: 0.75, zone: 0.18,
      desc: 'Maximaler Reiz, maximale Erschöpfung. Rücken gerade!' },

    { id: 'beinstrecker', name: 'Beinstrecker', icon: '🦿', muscle: 'beine',
      unlockLevel: 7, energy: 16, reps: 14, stimulus: 22, speed: 0.85, zone: 0.18,
      desc: 'Brennt wie Feuer, isoliert den Quadrizeps.' },

    { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', icon: '🪁', muscle: 'bauch',
      unlockLevel: 8, energy: 15, reps: 12, stimulus: 20, speed: 0.88, zone: 0.17,
      desc: 'Ohne Schwung. Wirklich ohne Schwung.' },

    /* --- Kondition: wenig Reiz, viel Gesundheit --------------------------- */
    { id: 'laufband', name: 'Laufband-Cardio', icon: '🏃', muscle: 'waden',
      unlockLevel: 1, energy: 12, reps: 12, stimulus: 5, speed: 0.45, zone: 0.34,
      kind: 'kondition', health: { herz: 3, laune: 1 },
      desc: 'Zwanzig Minuten im Grundlagenbereich. Das Herz dankt es dir jede Nacht.' },

    { id: 'spinning', name: 'Spinning-Kurs', icon: '🚴', muscle: 'beine',
      unlockLevel: 3, energy: 20, reps: 16, stimulus: 9, speed: 0.72, zone: 0.26,
      kind: 'kondition', health: { herz: 4.5, laune: 1.5, schlaf: 1 },
      desc: 'Dunkler Raum, laute Musik, jemand brüllt Zahlen. Danach lebst du gesünder.' },

    { id: 'yoga', name: 'Yoga-Flow', icon: '🧘', muscle: 'bauch',
      unlockLevel: 2, energy: 10, reps: 10, stimulus: 6, speed: 0.38, zone: 0.36,
      kind: 'kondition', health: { laune: 3.5, schlaf: 3, herz: 1 }, recovery: 0.15,
      desc: 'Atmen, halten, nicht wackeln. Löst die Verspannungen aus allen Partien.' },

    /* --- Endgame ---------------------------------------------------------- */
    { id: 'butterfly-pro', name: 'Butterfly Pro-Serie', icon: '🦋', muscle: 'brust',
      unlockLevel: 9, energy: 20, reps: 12, stimulus: 34, speed: 0.92, zone: 0.16,
      desc: 'Die teure Maschine im hinteren Bereich. Zeitlupe hoch, Zeitlupe runter.' },

    { id: 'donkey-calf', name: 'Donkey Calf Raise', icon: '🫏', muscle: 'waden',
      unlockLevel: 10, energy: 14, reps: 20, stimulus: 24, speed: 1.00, zone: 0.15,
      desc: 'Hohe Wiederholungen, kurzer Weg, viel Schmerz.' },

    { id: 'front-squat', name: 'Frontkniebeuge', icon: '🔥', muscle: 'beine',
      unlockLevel: 11, energy: 32, reps: 8, stimulus: 52, speed: 0.98, zone: 0.14,
      desc: 'Technik-Übung auf Wettkampfniveau. Ein Zucken und der Satz ist hin.' },

    { id: 'overhead-press', name: 'Overhead-Press (Wettkampf)', icon: '👑', muscle: 'schultern',
      unlockLevel: 12, energy: 26, reps: 8, stimulus: 48, speed: 1.05, zone: 0.13,
      desc: 'Stehend, streng, ohne Schwung. Die Königsdisziplin der Schulter.' }
  ];

  var BY_ID = {};
  LIST.forEach(function (e) { BY_ID[e.id] = e; });

  function byMuscle(muscleId) {
    return LIST.filter(function (e) { return e.muscle === muscleId; });
  }

  function unlockedAt(level) {
    return LIST.filter(function (e) { return e.unlockLevel === level; });
  }

  MF.data.exercises = {
    list: LIST,
    get: function (id) { return BY_ID[id] || null; },
    byMuscle: byMuscle,
    unlockedAt: unlockedAt
  };
})(window.MacFit);
