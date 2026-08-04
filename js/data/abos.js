/* Coaching-Angebote: laufende Dienstleistungen statt Kuren. Das Trainingsplan-
   Abo verlängert sich selbst, der Personal Trainer kostet einen Tagessatz —
   beides lebt in s.coach und nicht in s.active, damit weder der Burnout noch
   die Wirkungs-Summierung der Kuren die Abos berührt.

   Der Split ordnet die acht Muskelgruppen den klassischen Trainingstagen zu.
   Bauch läuft am Beintag mit — irgendwo muss er hin, und der Beintag hat mit
   nur zwei großen Gruppen am ehesten Platz. */
(function (MF) {
  'use strict';

  var LIST = [
    { id: 'trainingsplan', name: 'Trainingsplan-Abo', icon: '📋', kind: 'abo',
      price: 30, days: 7, unlockLevel: 5,
      desc: 'Push, Pull, Beine — jeden Tag ein klarer Auftrag mit passenden '
          + 'Geräten. Verlängert sich automatisch, solange das Konto es hergibt.' },

    { id: 'trainer', name: 'Personal Trainer', icon: '🎯', kind: 'daily',
      price: 25, unlockLevel: 7,
      desc: 'Analysiert Körper und Training, nimmt sich jeden Tag deine '
          + 'schwächsten Partien vor. Jederzeit kündbar.' }
  ];

  var SPLIT = [
    { key: 'push', name: 'Push-Tag', muscles: ['brust', 'schultern', 'trizeps'] },
    { key: 'pull', name: 'Pull-Tag', muscles: ['ruecken', 'bizeps'] },
    { key: 'legs', name: 'Leg-Day',  muscles: ['beine', 'waden', 'bauch'] }
  ];

  var BY_ID = {};
  LIST.forEach(function (a) { BY_ID[a.id] = a; });

  MF.data.abos = {
    list: LIST,
    split: SPLIT,
    get: function (id) { return BY_ID[id] || null; },
    unlockedAt: function (level) {
      return LIST.filter(function (a) { return a.unlockLevel === level; });
    }
  };
})(window.MacFit);
