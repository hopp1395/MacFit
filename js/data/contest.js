/* Die Meisterschaft. Alle zehn Spieltage steigt eine, ab Level 4 — vorher
   hat man auf der Bühne nichts verloren.

   Zwei Klassen, und darin steckt der eigentliche Reiz: die Natural-Klasse
   hat eine Dopingkontrolle am Eingang. Wer je etwas aus dem Grenzbereich
   oder von den Anabolika genommen hat (stats.natural ist dann weg), kommt
   dort nicht mehr rein und muss in die offene Klasse — wo das Feld deutlich
   stärker ist. Substanzen machen den Sieg also nicht einfacher, sie
   verschieben nur, gegen wen man antritt. */
(function (MF) {
  'use strict';

  var INTERVAL = 10;        /* Spieltage zwischen zwei Meisterschaften */
  var FIRST_DAY = 12;       /* die erste steigt an diesem Tag */
  var UNLOCK_LEVEL = 4;
  var POSES_NEEDED = 3;     /* so viele Posen zeigt man in der Kür */
  var POSE_ENERGY = 6;      /* Energie je Pose */

  var CLASSES = [
    {
      id: 'natural', name: 'Natural-Klasse', icon: '🌿',
      fee: 40,
      naturalOnly: true,
      /* Preisgeld und Erfahrung für Platz 1, 2 und 3. */
      purse: [260, 140, 70],
      xp: [420, 250, 130],
      /* So stark ist das Feld im Verhältnis zur eigenen Bühnenwertung. */
      field: { low: 0.78, high: 1.05 },
      desc: 'Dopingkontrolle am Eingang. Kleineres Preisgeld, ehrlicheres Feld.'
    },
    {
      id: 'offen', name: 'Offene Klasse', icon: '🔥',
      fee: 80,
      purse: [620, 320, 150],
      xp: [560, 320, 160],
      field: { low: 0.94, high: 1.24 },
      desc: 'Keine Kontrolle, keine Fragen. Die Konkurrenz nutzt das aus.'
    }
  ];

  /* Die Konkurrenz. Namen und Studios sind Beiwerk — was zählt, ist der
     Faktor, der aus der Klasse gewürfelt wird. */
  var FIELD = [
    { name: 'Ronny Kessler', gym: 'Ironhouse' },
    { name: 'Sven Malik', gym: 'Powerkeller' },
    { name: 'Denise Faber', gym: 'Studio Nord' },
    { name: 'Ali Yildiz', gym: 'Kraftraum 12' },
    { name: 'Bernd Groth', gym: 'Muckibude Ost' },
    { name: 'Lena Sorge', gym: 'Athletik Süd' },
    { name: 'Pascal Reiter', gym: 'Gym 2000' },
    { name: 'Ingo Voss', gym: 'Hantelbank' },
    { name: 'Meike Ahrens', gym: 'Bodyline' },
    { name: 'Dragan Petrov', gym: 'Ironhouse' }
  ];

  /* Titel nach gewonnenen Meisterschaften — er steht danach auf der
     Mitgliedskarte. */
  var TITLES = [
    { wins: 1, name: 'Stadtmeister' },
    { wins: 3, name: 'Bezirksmeister' },
    { wins: 6, name: 'Landesmeister' },
    { wins: 10, name: 'Champion' }
  ];

  var BY_ID = {};
  CLASSES.forEach(function (c) { BY_ID[c.id] = c; });

  MF.data.contest = {
    INTERVAL: INTERVAL,
    FIRST_DAY: FIRST_DAY,
    UNLOCK_LEVEL: UNLOCK_LEVEL,
    POSES_NEEDED: POSES_NEEDED,
    POSE_ENERGY: POSE_ENERGY,
    classes: CLASSES,
    field: FIELD,
    titles: TITLES,
    get: function (id) { return BY_ID[id] || null; },
    /* Der Titel, der zu so vielen Siegen gehört — oder ''. */
    titleFor: function (wins) {
      var out = '';
      TITLES.forEach(function (t) { if (wins >= t.wins) out = t.name; });
      return out;
    }
  };
})(window.MacFit);
