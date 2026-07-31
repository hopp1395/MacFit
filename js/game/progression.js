/* XP, Levelaufstieg, Freischaltungen. */
(function (MF) {
  'use strict';

  function state() { return MF.game.state.get(); }

  /* Gibt bei einem Aufstieg Infos zurueck, sonst null. */
  function addXp(amount) {
    var s = state();
    if (!amount || amount <= 0) return null;

    var before = s.level;
    s.xp += amount;
    var after = MF.data.levels.levelForXp(s.xp);
    if (after <= before) return null;

    s.level = after;
    var def = MF.data.levels.forLevel(after);

    /* Aufstieg bringt frische Energie — sonst faellt der Bonus am Tagesende unter den Tisch. */
    s.energy = Math.min(MF.game.stats.energyMax(), s.energy + 25);

    var info = {
      level: after,
      title: def.title,
      unlocks: MF.data.levels.unlocksAt(after),
      energy: def.energy
    };
    MF.core.events.emit('level:up', info);
    return info;
  }

  function currentTitle() {
    return MF.data.levels.forLevel(state().level).title;
  }

  function isMaxLevel() {
    return state().level >= MF.data.levels.MAX;
  }

  MF.game.progression = {
    addXp: addXp,
    currentTitle: currentTitle,
    isMaxLevel: isMaxLevel
  };
})(window.MacFit);
