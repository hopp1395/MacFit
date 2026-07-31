/* Der Tageswechsel. Hier wird aus Reiz tatsaechlich Muskel —
   trainiert wird im Gym, gewachsen wird im Schlaf. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var GROWTH_K = 0.30;      /* Grundfaktor Reiz -> Groesse */
  var DECAY_AFTER_DAYS = 4; /* ab wann eine Partie zurueckgeht */

  function state() { return MF.game.state.get(); }

  function setsToday() {
    var s = state();
    return MF.data.muscles.ids.reduce(function (acc, id) {
      return acc + s.muscles[id].setsToday;
    }, 0);
  }

  function sleep() {
    var s = state();
    var massBefore = MF.game.stats.muscleMass();
    var growthMult = MF.game.stats.growthMultiplier();
    var regenMult = MF.game.stats.regenMultiplier();
    var ceiling = MF.game.stats.sizeCeiling();
    var trained = setsToday();

    var gains = [];

    MF.data.muscles.list.forEach(function (def) {
      var m = s.muscles[def.id];
      var before = m.size;

      /* Wachstum: Wurzelkurve auf den gesammelten Reiz, gebremst je naeher die
         Partie an ihrer Decke liegt. Doppelt so viele Saetze bringen nicht
         doppelt so viel — und ohne Substanzen ist bei ~86 Schluss. */
      if (m.pending > 0) {
        var softCap = Math.pow(util.clamp(1 - m.size / ceiling, 0.02, 1), 0.9);
        m.size += Math.sqrt(m.pending) * GROWTH_K * def.growth * growthMult * softCap;
      }

      /* Vernachlaessigte Partien gehen langsam zurueck. */
      var idle = s.day - m.lastTrainedDay;
      if (idle > DECAY_AFTER_DAYS && m.size > 8) {
        m.size -= Math.min(0.9, 0.12 * (idle - DECAY_AFTER_DAYS)) * (m.size / 40 + 0.5);
      }

      /* Nach einer Kur bricht ein Teil der Masse wieder weg. */
      if (s.crash && m.size > 8) {
        m.size -= m.size * 0.008;
      }

      m.size = util.clamp(m.size, 5, 100);
      m.pending = 0;
      m.setsToday = 0;
      m.fatigue = util.clamp(m.fatigue * (1 - util.clamp(def.regen * regenMult, 0.1, 0.95)), 0, 1);

      var delta = m.size - before;
      if (Math.abs(delta) >= 0.01) {
        gains.push({ id: def.id, name: def.name, delta: delta });
      }
    });

    /* Kuren, Nebenwirkungen, Erholung */
    var supp = MF.game.supplements.tickNight();
    var burnout = MF.game.supplements.checkBurnout();

    /* Geld */
    var income = MF.game.stats.dailyIncome();
    MF.game.economy.earn(income);

    /* Neuer Tag */
    if (trained > 0) s.stats.daysTrained += 1;
    s.day += 1;
    s.energy = burnout ? s.energy : MF.game.stats.energyMax();

    var massAfter = MF.game.stats.muscleMass();
    if (massAfter > s.stats.peakMass) s.stats.peakMass = massAfter;

    s.history.push({ day: s.day, mass: util.round(massAfter, 2) });
    if (s.history.length > 40) s.history.shift();

    gains.sort(function (a, b) { return b.delta - a.delta; });

    var report = {
      day: s.day,
      setsTrained: trained,
      gains: gains,
      massBefore: massBefore,
      massAfter: massAfter,
      massDelta: massAfter - massBefore,
      income: income,
      healthDeltas: supp.deltas,
      endedCourses: supp.ended,
      crash: s.crash,
      burnout: burnout,
      growthMult: growthMult
    };

    s.lastReport = {
      day: report.day,
      massDelta: util.round(report.massDelta, 2),
      income: report.income
    };

    MF.core.events.emit('day:ended', report);
    MF.game.state.saveNow();
    return report;
  }

  MF.game.day = {
    sleep: sleep,
    setsToday: setsToday
  };
})(window.MacFit);
