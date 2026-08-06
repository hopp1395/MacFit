/* Die Theke: Protein-Shakes. Anders als die Kuren im Regal laufen sie nicht
   ueber Tage, sondern wirken sofort — und nur heute. Ein Shake hebt die
   Tagesenergie um seinen energy-Wert: die Kopfleiste zeigt mehr Energie und
   zugleich eine hoehere Obergrenze, in der Nacht ist der Effekt wieder weg.

   Zwei Stueck pro Tag sind das Limit (MAX_PER_DAY). Ohne Deckel waere Energie
   schlicht kaeuflich und der Tag haette kein Ende mehr. */
(function (MF) {
  'use strict';

  var MAX_PER_DAY = 2;

  var LIST = [
    { id: 'hausmarke', name: 'Hausmarke Vanille', icon: '🥤',
      price: 18, unlockLevel: 1, energy: 16,
      desc: 'Wasser, Pulver, Shaker. Schmeckt nach Studio und trägt durch den Nachmittag.' },

    { id: 'schoko-xl', name: 'Schoko-Protein XL', icon: '🍫',
      price: 32, unlockLevel: 3, energy: 26,
      desc: 'Doppelte Portion, halbe Löslichkeit. Unten im Becher bleibt immer ein Rest.' },

    { id: 'beeren-iso', name: 'Beeren-Iso klar', icon: '🫐',
      price: 55, unlockLevel: 5, energy: 38,
      desc: 'Klar wie Saft, liegt nicht schwer im Magen. Der Mann am Tresen ist sichtlich stolz darauf.' },

    { id: 'doppeldecker', name: 'Mass-Gainer "Doppeldecker"', icon: '🥛',
      price: 95, unlockLevel: 7, energy: 55,
      desc: 'Neunhundert Kalorien im Becher. Danach geht viel — nur kein Bauchtraining.' }
  ];

  var BY_ID = {};
  LIST.forEach(function (s) { BY_ID[s.id] = s; });

  MF.data.shakes = {
    list: LIST,
    MAX_PER_DAY: MAX_PER_DAY,
    get: function (id) { return BY_ID[id] || null; },
    unlockedAt: function (level) {
      return LIST.filter(function (s) { return s.unlockLevel === level; });
    }
  };
})(window.MacFit);
