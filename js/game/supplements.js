/* Kuren kaufen, laufende Wirkungen und Nebenwirkungen verwalten. */
(function (MF) {
  'use strict';

  var util = MF.core.util;

  function state() { return MF.game.state.get(); }

  function isActive(id) {
    return state().active.some(function (a) { return a.id === id; });
  }

  function isUnlocked(def) {
    return state().level >= def.unlockLevel;
  }

  function canBuy(def) {
    var s = state();
    if (!isUnlocked(def)) {
      return { ok: false, reason: 'Ab Level ' + def.unlockLevel };
    }
    if (isActive(def.id)) {
      return { ok: false, reason: 'Kur läuft bereits' };
    }
    if (!MF.game.economy.canAfford(def.price)) {
      return { ok: false, reason: 'Zu teuer' };
    }
    return { ok: true };
  }

  function buy(def) {
    var check = canBuy(def);
    if (!check.ok) return check;

    var s = state();
    MF.game.economy.spend(def.price);
    s.active.push({ id: def.id, daysLeft: def.days, total: def.days });
    s.owned[def.id] = (s.owned[def.id] || 0) + 1;

    if (def.tier === 'grenz' || def.tier === 'anabol') {
      s.stats.natural = false;
    }

    MF.core.events.emit('supplement:bought', def);
    MF.game.state.saveNow();
    return { ok: true };
  }

  /* Eine Nacht weiterschalten: Gesundheit anpassen, abgelaufene Kuren beenden. */
  function tickNight() {
    var s = state();
    var deltas = { herz: 0, leber: 0, schlaf: 0, laune: 0 };
    var ended = [];

    s.active.forEach(function (entry) {
      var def = MF.data.supplements.get(entry.id);
      if (!def) return;
      Object.keys(deltas).forEach(function (k) {
        deltas[k] += def.health[k] || 0;
      });
      entry.daysLeft -= 1;
    });

    /* Ohne Kur erholt sich der Koerper von selbst — aber langsam genug, dass
       eine harte Kur noch tagelang nachhängt. */
    var baseHeal = s.active.length === 0 ? 1.2 : 0.5;
    Object.keys(deltas).forEach(function (k) {
      deltas[k] += baseHeal;
    });

    /* Harte Trainingstage kosten zusaetzlich Laune und Schlaf. */
    var setsToday = MF.data.muscles.ids.reduce(function (acc, id) {
      return acc + s.muscles[id].setsToday;
    }, 0);
    if (setsToday >= 8) deltas.schlaf -= 1.5;
    if (setsToday === 0) deltas.laune -= 1.0;

    Object.keys(deltas).forEach(function (k) {
      s.health[k] = util.clamp(s.health[k] + deltas[k], 0, 100);
    });

    /* Abgelaufene Kuren aussortieren, Anabolika hinterlassen einen Einbruch. */
    s.active = s.active.filter(function (entry) {
      if (entry.daysLeft > 0) return true;
      var def = MF.data.supplements.get(entry.id);
      ended.push(def);
      if (def && def.crash) {
        var existing = s.crash ? s.crash.daysLeft : 0;
        s.crash = { daysLeft: Math.max(existing, def.crash), name: def.name };
      }
      return false;
    });

    if (s.crash) {
      s.crash.daysLeft -= 1;
      if (s.crash.daysLeft <= 0) s.crash = null;
    }

    return { deltas: deltas, ended: ended };
  }

  /* Kritisch niedrige Werte erzwingen eine Pause. */
  function checkBurnout() {
    var s = state();
    var h = s.health;
    var critical = Object.keys(h).filter(function (k) { return h[k] <= 8; });
    if (!critical.length) return null;

    /* Zwangspause: der naechste Tag beginnt mit wenig Energie, dafuer heilt es. */
    Object.keys(h).forEach(function (k) {
      h[k] = util.clamp(h[k] + 22, 0, 100);
    });
    s.active = [];
    s.crash = { daysLeft: 3, name: 'Zwangspause' };
    s.energy = Math.round(MF.game.stats.energyMax() * 0.4);

    return { critical: critical };
  }

  MF.game.supplements = {
    isActive: isActive,
    isUnlocked: isUnlocked,
    canBuy: canBuy,
    buy: buy,
    tickNight: tickNight,
    checkBurnout: checkBurnout
  };
})(window.MacFit);
