/* Muskelgruppen. "share" gewichtet den Anteil an der Gesamtmasse,
   "regen" wie schnell die Ermuedung ueber Nacht abklingt (0..1 pro Nacht),
   "growth" wie stark die Partie auf Reiz reagiert. */
(function (MF) {
  'use strict';

  var LIST = [
    { id: 'brust',     name: 'Brust',     short: 'BRU', share: 1.30, regen: 0.55, growth: 1.00 },
    { id: 'ruecken',   name: 'Rücken',    short: 'RÜC', share: 1.60, regen: 0.50, growth: 0.95 },
    { id: 'schultern', name: 'Schultern', short: 'SCH', share: 0.90, regen: 0.60, growth: 1.05 },
    { id: 'bizeps',    name: 'Bizeps',    short: 'BIZ', share: 0.55, regen: 0.70, growth: 1.20 },
    { id: 'trizeps',   name: 'Trizeps',   short: 'TRI', share: 0.60, regen: 0.70, growth: 1.15 },
    { id: 'bauch',     name: 'Bauch',     short: 'BAU', share: 0.70, regen: 0.75, growth: 1.10 },
    { id: 'beine',     name: 'Beine',     short: 'BEI', share: 2.00, regen: 0.40, growth: 0.85 },
    { id: 'waden',     name: 'Waden',     short: 'WAD', share: 0.50, regen: 0.65, growth: 0.70 }
  ];

  var BY_ID = {};
  LIST.forEach(function (m) { BY_ID[m.id] = m; });

  MF.data.muscles = {
    list: LIST,
    get: function (id) { return BY_ID[id] || null; },
    ids: LIST.map(function (m) { return m.id; })
  };
})(window.MacFit);
