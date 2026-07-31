/* Geld. Einnahmen kommen nachts, Ausgaben aus dem Shop. */
(function (MF) {
  'use strict';

  function state() { return MF.game.state.get(); }

  function money() {
    return state().money;
  }

  function canAfford(amount) {
    return state().money >= amount;
  }

  function spend(amount) {
    var s = state();
    if (s.money < amount) return false;
    s.money -= amount;
    MF.core.events.emit('money:changed');
    return true;
  }

  function earn(amount) {
    var s = state();
    s.money += amount;
    MF.core.events.emit('money:changed');
    return amount;
  }

  MF.game.economy = {
    money: money,
    canAfford: canAfford,
    spend: spend,
    earn: earn
  };
})(window.MacFit);
