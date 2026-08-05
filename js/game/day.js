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

  /* Was der gesammelte Reiz einer Partie in der naechsten Nacht bringt.
     Wurzelkurve, gebremst je naeher die Partie an ihrer Decke liegt:
     doppelt so viele Saetze bringen nicht doppelt so viel. Auch tagsueber
     gefragt — der Nachholbedarf-Hinweis rechnet den Wert mit, damit er
     nach jedem Satz weiterwandert statt bis zum Schlafen stehenzubleiben. */
  function nightGain(def, m, ceiling, growthMult) {
    if (m.pending <= 0) return 0;
    var softCap = Math.pow(util.clamp(1 - m.size / ceiling, 0.02, 1), 0.9);
    return Math.sqrt(m.pending) * GROWTH_K * def.growth * growthMult * softCap;
  }

  function sleep() {
    var s = state();
    var massBefore = MF.game.stats.muscleMass();
    var fitBefore = MF.game.fitness.index();
    var growthMult = MF.game.stats.growthMultiplier();
    var regenMult = MF.game.stats.regenMultiplier();
    var ceiling = MF.game.stats.sizeCeiling();
    var trained = setsToday();
    /* Plan und Zettel VOR dem Muskel-Loop auswerten — der setzt setsToday
       zurueck, und der naechste Tag haengt einen neuen Zettel aus. */
    var coachEval = MF.game.coach.evaluateDay();
    var chalEval = MF.game.challenge.evaluateDay();

    var gains = [];
    var healed = [];        /* Partien, deren Zerrung heute Nacht ausheilt */
    var injured = [];       /* noch gesperrte Partien mit Resttagen */

    MF.data.muscles.list.forEach(function (def) {
      var m = s.muscles[def.id];
      var before = m.size;

      /* Wachstum aus dem gesammelten Reiz — ohne Substanzen ist bei ~86 Schluss. */
      m.size += nightGain(def, m, ceiling, growthMult);

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
      /* Eine Zerrung heilt pro Nacht einen Tag ab. */
      if (m.injuryDays > 0) {
        m.injuryDays -= 1;
        if (m.injuryDays === 0) healed.push(def.name);
      }
      m.fatigue = util.clamp(m.fatigue * (1 - util.clamp(def.regen * regenMult, 0.1, 0.95)), 0, 1);

      if (m.injuryDays > 0) injured.push({ name: def.name, days: m.injuryDays });

      var delta = m.size - before;
      if (Math.abs(delta) >= 0.01) {
        gains.push({ id: def.id, name: def.name, delta: delta });
      }
    });

    /* Kuren, Nebenwirkungen, Erholung */
    var supp = MF.game.supplements.tickNight();
    var burnout = MF.game.supplements.checkBurnout();

    /* Geld — erst verdienen, dann die Abos abrechnen: der Tagessatz soll
       aus dem frischen Einkommen bezahlbar sein. */
    var income = MF.game.stats.dailyIncome();
    MF.game.economy.earn(income);
    var abo = MF.game.abos.tickNight();

    /* Neuer Tag */
    if (trained > 0) s.stats.daysTrained += 1;
    s.day += 1;
    s.energy = burnout ? s.energy : MF.game.stats.energyMax();

    var massAfter = MF.game.stats.muscleMass();
    if (massAfter > s.stats.peakMass) s.stats.peakMass = massAfter;

    gains.sort(function (a, b) { return b.delta - a.delta; });

    var fitAfter = MF.game.fitness.index();

    /* Der Verlauf im Koerper-Bildschirm liest hier mit: ein Eintrag pro
       abgeschlossenem Trainingstag (deshalb s.day - 1) mit dem, was die
       Nacht daraus gemacht hat. Aeltere Staende haben nur day und mass —
       die Anzeige kommt damit zurecht. */
    s.history.push({
      day: s.day - 1,
      mass: util.round(massAfter, 2),
      gain: util.round(massAfter - massBefore, 2),
      fit: fitAfter,
      sets: trained,
      level: s.level
    });
    if (s.history.length > 40) s.history.shift();

    var report = {
      day: s.day,
      setsTrained: trained,
      gains: gains,
      massBefore: massBefore,
      massAfter: massAfter,
      massDelta: massAfter - massBefore,
      fitBefore: fitBefore,
      fitAfter: fitAfter,
      fitDelta: fitAfter - fitBefore,
      income: income,
      healthDeltas: supp.deltas,
      endedCourses: supp.ended,
      crash: s.crash,
      burnout: burnout,
      growthMult: growthMult,
      coach: coachEval,
      challenge: chalEval,
      abo: abo,
      healed: healed,
      injured: injured
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
    setsToday: setsToday,
    nightGain: nightGain
  };
})(window.MacFit);
