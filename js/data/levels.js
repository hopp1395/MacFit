/* Levelstufen: XP-Schwelle, Titel, Energie-Kapazität und Tageseinkommen.
   Was ein Level freischaltet, steht nicht hier doppelt, sondern wird aus
   exercises.js / supplements.js über unlockLevel abgeleitet. */
(function (MF) {
  'use strict';

  /* Die Schwellen sind so gesetzt, dass ein fleißiger Spieler Level 5 nach gut
     einer Woche erreicht und Level 12 erst nach rund zwei Monaten Spielzeit. */
  var LIST = [
    { level: 1,  xp: 0,     energy: 100, income: 30,  title: 'Neuling im Trainingsanzug' },
    { level: 2,  xp: 400,   energy: 108, income: 38,  title: 'Probemitglied' },
    { level: 3,  xp: 950,   energy: 116, income: 46,  title: 'Stammgast am Montag' },
    { level: 4,  xp: 1600,  energy: 124, income: 56,  title: 'Kennt die Geräte' },
    { level: 5,  xp: 2400,  energy: 134, income: 70,  title: 'Shaker-Träger' },
    { level: 6,  xp: 3600,  energy: 144, income: 86,  title: 'Sichtbar trainiert' },
    { level: 7,  xp: 5300,  energy: 154, income: 105, title: 'T-Shirt sitzt eng' },
    { level: 8,  xp: 8000,  energy: 166, income: 130, title: 'Fortgeschrittener' },
    { level: 9,  xp: 12000, energy: 178, income: 160, title: 'Gym-Inventar' },
    { level: 10, xp: 17500, energy: 190, income: 200, title: 'Massephase-Veteran' },
    { level: 11, xp: 24500, energy: 204, income: 250, title: 'Bühnenreif' },
    { level: 12, xp: 34000, energy: 220, income: 320, title: 'MacFit-Legende' }
  ];

  var MAX = LIST[LIST.length - 1].level;

  function forLevel(level) {
    return LIST[MF.core.util.clamp(level, 1, MAX) - 1];
  }

  /* Level, das zu einer XP-Summe gehoert. */
  function levelForXp(xp) {
    var lvl = 1;
    for (var i = 0; i < LIST.length; i++) {
      if (xp >= LIST[i].xp) lvl = LIST[i].level;
    }
    return lvl;
  }

  /* Fortschritt innerhalb des aktuellen Levels: 0..1 */
  function progress(xp) {
    var lvl = levelForXp(xp);
    if (lvl >= MAX) return 1;
    var from = forLevel(lvl).xp;
    var to = forLevel(lvl + 1).xp;
    return MF.core.util.clamp((xp - from) / (to - from), 0, 1);
  }

  function xpToNext(xp) {
    var lvl = levelForXp(xp);
    if (lvl >= MAX) return 0;
    return forLevel(lvl + 1).xp - xp;
  }

  /* Alles, was mit diesem Level neu dazukommt. */
  function unlocksAt(level) {
    var out = [];
    MF.data.exercises.unlockedAt(level).forEach(function (e) {
      out.push({ kind: 'Gerät', icon: e.icon, name: e.name });
    });
    if (MF.data.supplements) {
      MF.data.supplements.unlockedAt(level).forEach(function (s) {
        out.push({ kind: 'Shop', icon: s.icon, name: s.name });
      });
    }
    if (MF.data.shakes) {
      MF.data.shakes.unlockedAt(level).forEach(function (s) {
        out.push({ kind: 'Theke', icon: s.icon, name: s.name });
      });
    }
    if (MF.data.abos) {
      MF.data.abos.unlockedAt(level).forEach(function (a) {
        out.push({ kind: 'Coaching', icon: a.icon, name: a.name });
      });
    }
    return out;
  }

  MF.data.levels = {
    list: LIST,
    MAX: MAX,
    forLevel: forLevel,
    levelForXp: levelForXp,
    progress: progress,
    xpToNext: xpToNext,
    unlocksAt: unlocksAt
  };
})(window.MacFit);
