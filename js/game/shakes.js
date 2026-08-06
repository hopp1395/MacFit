/* Shakes trinken. Bewusst getrennt von game/supplements.js: eine Kur laeuft
   ueber Tage und steht in s.active, ein Shake wirkt sofort und nur heute.

   Buchfuehrung in s.shakes = { day, count, bonus }:
     day    fuer welchen Spieltag count und bonus gelten
     count  wie viele Shakes heute schon getrunken sind (Deckel MAX_PER_DAY)
     bonus  Summe der heutigen Energie — stats.energyMax() rechnet sie drauf
   Beim Tageswechsel stimmt day nicht mehr, damit faengt die Zaehlung von
   selbst wieder bei null an — der Bonus verfaellt, kein Aufraeumen noetig. */
(function (MF) {
  'use strict';

  function state() { return MF.game.state.get(); }

  /* Frischer Block, sobald ein neuer Tag angefangen hat. */
  function today() {
    var s = state();
    if (!s.shakes || s.shakes.day !== s.day) {
      s.shakes = { day: s.day, count: 0, bonus: 0 };
    }
    return s.shakes;
  }

  function count() {
    return today().count;
  }

  function left() {
    return Math.max(0, MF.data.shakes.MAX_PER_DAY - count());
  }

  /* Was die heutigen Shakes zur Energie beitragen. */
  function bonusToday() {
    var s = state();
    if (!s || !s.shakes || s.shakes.day !== s.day) return 0;
    return s.shakes.bonus;
  }

  function isUnlocked(def) {
    return state().level >= def.unlockLevel;
  }

  function canBuy(def) {
    if (!isUnlocked(def)) {
      return { ok: false, reason: 'Ab Level ' + def.unlockLevel };
    }
    if (left() <= 0) {
      return { ok: false, reason: 'Heute schon zwei' };
    }
    if (!MF.game.economy.canAfford(def.price)) {
      return { ok: false, reason: 'Zu teuer' };
    }
    return { ok: true };
  }

  /* Kaufen und sofort austrinken — ein Vorrat waere nur eine Zwischenstufe,
     die den Deckel aushebelt. */
  function drink(def) {
    var check = canBuy(def);
    if (!check.ok) return check;

    var s = state();
    MF.game.economy.spend(def.price);

    var t = today();
    t.count += 1;
    t.bonus += def.energy;
    s.energy += def.energy;
    /* Was drin ist, landet nachts auf dem Koerperfett. */
    if (def.fat) MF.game.fat.addIntake(def.fat);
    s.owned[def.id] = (s.owned[def.id] || 0) + 1;

    MF.core.events.emit('energy:changed');
    MF.core.events.emit('shake:drunk', def);
    MF.game.state.saveNow();
    return { ok: true, energy: def.energy, left: left() };
  }

  MF.game.shakes = {
    count: count,
    left: left,
    bonusToday: bonusToday,
    isUnlocked: isUnlocked,
    canBuy: canBuy,
    drink: drink
  };
})(window.MacFit);
