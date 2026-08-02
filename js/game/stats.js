/* Abgeleitete Werte. Nichts hier veraendert den Zustand — reine Berechnung. */
(function (MF) {
  'use strict';

  var util = MF.core.util;

  var MASS_BASE = 28;      /* kg Muskelmasse eines voellig untrainierten Koerpers */
  var MASS_PER_POINT = 0.0368;
  var NATURAL_CEILING = 86; /* so gross wird eine Partie ohne Nachhilfe hoechstens */

  function state() { return MF.game.state.get(); }

  /* --- Masse & Symmetrie ------------------------------------------------- */

  function muscleMass() {
    var sum = 0;
    MF.data.muscles.list.forEach(function (m) {
      sum += state().muscles[m.id].size * m.share;
    });
    return MASS_BASE + sum * MASS_PER_POINT;
  }

  /* 0..100 — wie gleichmaessig der Koerper entwickelt ist. */
  function symmetry() {
    var sizes = MF.data.muscles.ids.map(function (id) { return state().muscles[id].size; });
    var mean = sizes.reduce(function (a, b) { return a + b; }, 0) / sizes.length;
    if (mean <= 0) return 100;
    var variance = sizes.reduce(function (acc, s) {
      return acc + Math.pow(s - mean, 2);
    }, 0) / sizes.length;
    var cv = Math.sqrt(variance) / mean;   /* Variationskoeffizient */
    return util.clamp(100 - cv * 145, 0, 100);
  }

  /* Schwaechste Partie — fuer Hinweise in der UI. Gemessen wird der Aufbau
     seit Start RELATIV zum Wachstumsfaktor der Partie: Waden legen mit
     growth 0.70 konstruktionsbedingt nur halb so schnell zu wie der Rest
     und standen nach roher Groesse fast immer als Nachholbedarf da, selbst
     wenn sie fleissig trainiert wurden. Der Hinweis soll Vernachlaessigung
     zeigen, nicht Genetik — die Balance selbst bleibt unveraendert. */
  function weakestMuscle() {
    var worst = null;
    MF.data.muscles.list.forEach(function (m) {
      var s = state().muscles[m.id].size;
      var rel = (s - 8) / m.growth;
      if (!worst || rel < worst.rel) worst = { id: m.id, name: m.name, size: s, rel: rel };
    });
    return worst;
  }

  /* --- Gesundheit -------------------------------------------------------- */

  function healthAvg() {
    var h = state().health;
    return (h.herz + h.leber + h.schlaf + h.laune) / 4;
  }

  function healthLabel() {
    var avg = healthAvg();
    if (avg >= 85) return { text: 'topfit', tone: 'good' };
    if (avg >= 65) return { text: 'ordentlich', tone: 'good' };
    if (avg >= 45) return { text: 'angeschlagen', tone: 'warn' };
    if (avg >= 25) return { text: 'am Limit', tone: 'bad' };
    return { text: 'ausgebrannt', tone: 'bad' };
  }

  /* --- Wirkungen laufender Kuren ----------------------------------------- */

  function activeCourses() {
    return state().active.map(function (entry) {
      var def = MF.data.supplements.get(entry.id);
      return def ? { def: def, daysLeft: entry.daysLeft, total: entry.total } : null;
    }).filter(Boolean);
  }

  function sumEffects() {
    var sum = { growth: 0, regen: 0, energy: 0, focus: 0 };
    activeCourses().forEach(function (c) {
      Object.keys(sum).forEach(function (k) {
        sum[k] += c.def.effects[k] || 0;
      });
    });
    return sum;
  }

  /* Die Obergrenze, gegen die eine Partie laeuft. Genau hier liegt der Reiz der
     Substanzen: sie machen nicht nur schneller, sie heben die Decke an.
     Wer sie absetzt, faellt auf das natuerliche Limit zurueck. */
  function sizeCeiling() {
    var boost = 0;
    activeCourses().forEach(function (c) {
      var g = c.def.effects.growth || 0;
      if (g > 0) boost += g;
    });
    return util.clamp(NATURAL_CEILING + boost * 8, NATURAL_CEILING, 118);
  }

  /* Multiplikator auf das naechtliche Wachstum. */
  function growthMultiplier() {
    var s = state();
    var mult = 1 + sumEffects().growth;
    if (s.stats.natural) mult += 0.15;               /* Bonus fuers Sauberbleiben */

    var avg = healthAvg();
    if (avg < 80) mult *= 0.55 + 0.45 * (avg / 80);  /* schlechte Werte bremsen */
    if (s.crash) mult *= 0.45;                       /* Einbruch nach der Kur */

    return Math.max(0.1, mult);
  }

  /* Multiplikator auf die naechtliche Erholung. */
  function regenMultiplier() {
    var s = state();
    var mult = 1 + sumEffects().regen;
    if (s.stats.natural) mult += 0.10;
    mult *= 0.6 + 0.4 * (s.health.schlaf / 100);
    return Math.max(0.2, mult);
  }

  /* Breite der Trefferzone: 1.0 = normal. Muede und schlecht gelaunt trifft man schlechter. */
  function focusMultiplier() {
    var s = state();
    var mult = 1 + sumEffects().focus;
    mult *= 0.72 + 0.28 * ((s.health.schlaf + s.health.laune) / 200);
    if (s.crash) mult *= 0.85;
    return util.clamp(mult, 0.45, 2.0);
  }

  function energyMax() {
    var s = state();
    var base = MF.data.levels.forLevel(s.level).energy + sumEffects().energy;
    base *= 0.62 + 0.38 * (s.health.schlaf / 100);
    if (s.crash) base *= 0.8;
    return Math.max(30, Math.round(base));
  }

  function dailyIncome() {
    var s = state();
    var base = MF.data.levels.forLevel(s.level).income;
    /* Wer gut aussieht, verdient nebenbei etwas dazu (Kurse, Kooperationen). */
    var bonus = 1 + (muscleMass() - 30) * 0.02 + (s.level - 1) * 0.03;
    return Math.round(base * util.clamp(bonus, 0.8, 3.5));
  }

  MF.game.stats = {
    NATURAL_CEILING: NATURAL_CEILING,
    muscleMass: muscleMass,
    sizeCeiling: sizeCeiling,
    symmetry: symmetry,
    weakestMuscle: weakestMuscle,
    healthAvg: healthAvg,
    healthLabel: healthLabel,
    activeCourses: activeCourses,
    sumEffects: sumEffects,
    growthMultiplier: growthMultiplier,
    regenMultiplier: regenMultiplier,
    focusMultiplier: focusMultiplier,
    energyMax: energyMax,
    dailyIncome: dailyIncome
  };
})(window.MacFit);
