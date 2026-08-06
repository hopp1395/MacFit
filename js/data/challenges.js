/* Das Schwarze Brett: jeden Tag haengt ein neuer Zettel im Studio.

   Die Aufgaben zielen bewusst auf die AUSFUEHRUNG, nie auf eine bestimmte
   Muskelgruppe — welche Partie dran ist, sagt der Trainingsplan. Plan sagt
   was, Brett sagt wie gut. So koennen beide nebeneinander laufen.

   kind bestimmt, wie geprueft wird (siehe js/game/challenge.js):
     streak      n perfekte Wiederholungen am Stueck in einem Satz
     clean       ein voller Satz ohne einen einzigen Verriss
     form        ein Satz mit mindestens form Prozent Form
     sets        n Saetze am selben Tag
     muscles     n verschiedene Partien am selben Tag
     dayperfect  n perfekte Wiederholungen ueber den ganzen Tag
     drop        eine Dropset-Kette bis Stufe n durchziehen
     spotter     die Extra-Wiederholung des Spotters treffen
     wobble      n kippende Wiederholungen in einem Satz noch treffen
     flow        Pump-Flow von mindestens flow in einem Satz
     kondition   ein Konditionssatz mit mindestens form Prozent Form

   Zusatzbedingungen, die auf mehreren Arten liegen koennen:
     weight      Mindest-Gewichtsstufe (0 leicht, 1 normal, 2 schwer, 3 brutal)
     maxOk       wie viele "gerade noch" erlaubt sind (clean)

   minIndex/maxIndex spannen das FENSTER, in dem ein Zettel aushaengt. Das
   maxIndex ist der Kern der Sache: ein Zettel, der nie aus dem Topf faellt,
   haengt noch als Elite im Studio und ist dann laengst keine Aufgabe mehr,
   sondern eine Praemie fuers Erscheinen. Jeder Zettel altert deshalb etwa
   zwei Rangstufen nach seinem Auftauchen wieder aus. Der Topf bleibt dabei
   immer mindestens drei Zettel gross (siehe forIndex). */
(function (MF) {
  'use strict';

  /* short steht in der Zeile im Gym (eine Zeile, mehr ist nicht drin),
     text erklaert die Aufgabe im Fenster dahinter. */
  var LIST = [
    /* --- Einstieg: Untrainiert bis Freizeitsportler ----------------------- */
    { id: 'drei-saetze', kind: 'sets', n: 3, minIndex: 0, maxIndex: 180, money: 35, xp: 12,
      title: 'Kein Kurzbesuch', short: '3 Sätze heute',
      text: 'Drei Sätze an einem Tag — egal an welchem Gerät.' },

    { id: 'sauber-10', kind: 'clean', minIndex: 0, maxIndex: 180, money: 40, xp: 15,
      title: 'Sauber durchziehen', short: 'Satz ohne Verriss',
      text: 'Ein kompletter Satz ohne einen einzigen Verriss.' },

    { id: 'serie-3', kind: 'streak', n: 3, minIndex: 0, maxIndex: 180, money: 45, xp: 18,
      title: 'Im Flow', short: '3 perfekte am Stück',
      text: 'Drei perfekte Wiederholungen am Stück.' },

    /* --- Aufbau: Freizeitsportler bis Sportlich --------------------------- */
    { id: 'form-70', kind: 'form', form: 0.70, weight: 1, minIndex: 120, maxIndex: 450,
      money: 55, xp: 20,
      title: 'Technik vor Ego', short: '70 % Form ab Normal',
      text: 'Ein Satz mit mindestens 70 % Form auf „Normal“ oder schwerer.' },

    { id: 'muskel-3', kind: 'muscles', n: 3, minIndex: 150, maxIndex: 600, money: 60, xp: 22,
      title: 'Nichts auslassen', short: '3 Partien heute',
      text: 'Trainiere heute drei verschiedene Muskelpartien — ein Satz je Partie genügt.' },

    { id: 'fuenf-saetze', kind: 'sets', n: 5, minIndex: 180, maxIndex: 450, money: 65, xp: 24,
      title: 'Volles Programm', short: '5 Sätze heute',
      text: 'Fünf Sätze an einem Tag.' },

    { id: 'serie-5', kind: 'streak', n: 5, minIndex: 180, maxIndex: 600, money: 70, xp: 26,
      title: 'Fünf am Stück', short: '5 perfekte am Stück',
      text: 'Fünf perfekte Wiederholungen ohne Aussetzer.' },

    { id: 'kondi-sauber', kind: 'kondition', form: 0.90, minIndex: 180, maxIndex: 600,
      money: 75, xp: 26,
      title: 'Auch das gehört dazu', short: '90 % Form in Kondition',
      text: 'Ein Konditionssatz — Laufband, Spinning oder Yoga — mit mindestens '
          + '90 % Form. Lange Sätze, weite Zone, aber eben bis zum Schluss.' },

    /* --- Mitte: Solide Basis bis Athletisch ------------------------------- */
    { id: 'sauber-normal', kind: 'clean', weight: 1, maxOk: 2, minIndex: 300, maxIndex: 730,
      money: 90, xp: 32,
      title: 'Kein Wackeln', short: 'Satz ab Normal, max. 2 unsauber',
      text: 'Ein voller Satz ab „Normal“ ohne Verriss — und höchstens zwei '
          + 'Wiederholungen, die nur gerade so sitzen.' },

    { id: 'form-80-schwer', kind: 'form', form: 0.80, weight: 2, minIndex: 300, maxIndex: 730,
      money: 95, xp: 34,
      title: 'Schweres Eisen, saubere Bahn', short: '80 % Form ab Schwer',
      text: 'Ein Satz mit mindestens 80 % Form auf „Schwer“ oder „Brutal“.' },

    { id: 'tag-perfekt-25', kind: 'dayperfect', n: 25, minIndex: 300, maxIndex: 730,
      money: 100, xp: 36,
      title: 'Fünfundzwanzig Treffer', short: '25 perfekte heute',
      text: 'Fünfundzwanzig perfekte Wiederholungen über den ganzen Tag — '
          + 'verteilt auf so viele Sätze, wie du brauchst.' },

    { id: 'drop-kette', kind: 'drop', n: 2, minIndex: 380, maxIndex: 850, money: 120, xp: 42,
      title: 'Bis zum Abwinken', short: 'Dropset-Kette ganz runter',
      text: 'Zieh eine Dropset-Kette über beide Stufen durch — zweimal Gewicht '
          + 'runter, ohne Pause weiter.' },

    { id: 'serie-8', kind: 'streak', n: 8, weight: 1, minIndex: 450, maxIndex: 850,
      money: 130, xp: 45,
      title: 'Maschinenlauf', short: '8 perfekte ab Normal',
      text: 'Acht perfekte Wiederholungen am Stück, auf „Normal“ oder schwerer.' },

    { id: 'wobble-retten', kind: 'wobble', n: 1, minIndex: 450, maxIndex: 850,
      money: 110, xp: 40,
      title: 'Hantel gerettet', short: 'kippende Wiederholung treffen',
      text: 'Wenn die Hantel mitten in der Wiederholung kippt, den Marker '
          + 'trotzdem treffen. Eine müde Partie zittert öfter.' },

    /* --- Spitze: Durchtrainiert aufwaerts --------------------------------- */
    { id: 'spotter-rep', kind: 'spotter', minIndex: 600, money: 170, xp: 55,
      title: 'Eine geht noch', short: 'Spotter-Rep treffen',
      text: 'Der Spotter bietet nach einem makellosen Satz eine Extra-Wiederholung '
          + 'an — die musst du treffen. Erst der perfekte Satz, dann die Zugabe.' },

    { id: 'flow-hoch', kind: 'flow', flow: 0.20, minIndex: 730, money: 200, xp: 62,
      title: 'Der Pump trägt', short: '20 % Pump-Flow',
      text: 'Ein Satz mit mindestens 20 % Pump-Bonus. Lange Serien perfekter '
          + 'Wiederholungen, möglichst ohne Unterbrechung.' },

    { id: 'sauber-brutal', kind: 'form', form: 0.95, weight: 3, minIndex: 730, money: 190, xp: 60,
      title: 'Brutal ohne Ausrede', short: '95 % Form auf Brutal',
      text: 'Ein Satz auf „Brutal“ mit mindestens 95 % Form.' },

    { id: 'serie-12', kind: 'streak', n: 12, weight: 2, minIndex: 850, money: 240, xp: 75,
      title: 'Zwölf ohne Zucken', short: '12 perfekte ab Schwer',
      text: 'Zwölf perfekte Wiederholungen am Stück auf „Schwer“ oder „Brutal“ — '
          + 'an einem Gerät, das so viele Wiederholungen überhaupt hergibt.' },

    { id: 'tag-perfekt-60', kind: 'dayperfect', n: 60, minIndex: 850, money: 260, xp: 80,
      title: 'Ein ganzer Arbeitstag', short: '60 perfekte heute',
      text: 'Sechzig perfekte Wiederholungen über den Tag. Das ist kein Satz, '
          + 'das ist ein Programm.' },

    { id: 'makellos-brutal', kind: 'clean', weight: 3, maxOk: 0, minIndex: 850,
      money: 280, xp: 88,
      title: 'Makellos', short: 'Satz auf Brutal, jede Rep perfekt',
      text: 'Ein voller Satz auf „Brutal“, in dem jede einzelne Wiederholung '
          + 'perfekt sitzt. Kein Verriss, kein „gerade noch“.' }
  ];

  var BY_ID = {};
  LIST.forEach(function (c) { BY_ID[c.id] = c; });

  function inWindow(c, index) {
    if (index < c.minIndex) return false;
    return c.maxIndex === undefined || index <= c.maxIndex;
  }

  MF.data.challenges = {
    list: LIST,
    get: function (id) { return BY_ID[id] || null; },
    /* Alles, was bei diesem Fitness-Index aushaengt. Sollte ein Fenster
       einmal nichts hergeben, faellt die Auswahl auf die schwersten Zettel
       zurueck, die der Spieler ueberhaupt erreicht hat — lieber zu schwer
       als ein leeres Brett. */
    forIndex: function (index) {
      var open = LIST.filter(function (c) { return inWindow(c, index); });
      if (open.length) return open;
      var reached = LIST.filter(function (c) { return index >= c.minIndex; });
      return reached.length ? reached.slice(-3) : LIST.slice(0, 3);
    }
  };
})(window.MacFit);
