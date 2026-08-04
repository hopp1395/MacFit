/* Das Schwarze Brett: jeden Tag haengt ein neuer Zettel im Studio.

   Die Aufgaben zielen bewusst auf die AUSFUEHRUNG, nie auf eine bestimmte
   Muskelgruppe — welche Partie dran ist, sagt der Trainingsplan. Plan sagt
   was, Brett sagt wie gut. So koennen beide nebeneinander laufen.

   kind bestimmt, wie geprueft wird (siehe js/game/challenge.js):
     streak  n perfekte Wiederholungen am Stueck in einem Satz
     clean   ein voller Satz ohne einen einzigen Verriss
     form    ein Satz mit mindestens form Prozent ab Gewichtsstufe weight
     sets    n Saetze am selben Tag
   minIndex: ab welchem Fitness-Index der Zettel ueberhaupt aushaengt. */
(function (MF) {
  'use strict';

  var LIST = [
    { id: 'sauber-10', kind: 'clean', minIndex: 0, money: 40, xp: 15,
      title: 'Sauber durchziehen',
      text: 'Ein kompletter Satz ohne einen einzigen Verriss.' },

    { id: 'drei-saetze', kind: 'sets', n: 3, minIndex: 0, money: 35, xp: 12,
      title: 'Kein Kurzbesuch',
      text: 'Drei Sätze an einem Tag — egal an welchem Gerät.' },

    { id: 'serie-3', kind: 'streak', n: 3, minIndex: 0, money: 45, xp: 18,
      title: 'Im Flow',
      text: 'Drei perfekte Wiederholungen am Stück.' },

    { id: 'form-70', kind: 'form', form: 0.70, weight: 1, minIndex: 120, money: 55, xp: 20,
      title: 'Technik vor Ego',
      text: 'Ein Satz mit mindestens 70 % Form auf „Normal“ oder schwerer.' },

    { id: 'serie-5', kind: 'streak', n: 5, minIndex: 300, money: 70, xp: 26,
      title: 'Fünf am Stück',
      text: 'Fünf perfekte Wiederholungen ohne Aussetzer.' },

    { id: 'fuenf-saetze', kind: 'sets', n: 5, minIndex: 300, money: 65, xp: 24,
      title: 'Volles Programm',
      text: 'Fünf Sätze an einem Tag.' },

    { id: 'form-80-schwer', kind: 'form', form: 0.80, weight: 2, minIndex: 450, money: 95, xp: 34,
      title: 'Schweres Eisen, saubere Bahn',
      text: 'Ein Satz mit mindestens 80 % Form auf „Schwer“ oder „Brutal“.' },

    { id: 'serie-8', kind: 'streak', n: 8, minIndex: 600, money: 130, xp: 45,
      title: 'Maschinenlauf',
      text: 'Acht perfekte Wiederholungen am Stück.' },

    { id: 'sauber-brutal', kind: 'form', form: 0.95, weight: 3, minIndex: 730, money: 190, xp: 60,
      title: 'Brutal ohne Ausrede',
      text: 'Ein Satz auf „Brutal“ mit mindestens 95 % Form.' }
  ];

  var BY_ID = {};
  LIST.forEach(function (c) { BY_ID[c.id] = c; });

  MF.data.challenges = {
    list: LIST,
    get: function (id) { return BY_ID[id] || null; },
    /* Alles, was bei diesem Fitness-Index aushaengen darf. */
    forIndex: function (index) {
      return LIST.filter(function (c) { return index >= c.minIndex; });
    }
  };
})(window.MacFit);
