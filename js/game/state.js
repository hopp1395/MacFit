/* Zentraler Spielzustand. Alles, was einen Spielstand ausmacht, steht hier —
   abgeleitete Werte gehören dagegen nach stats.js. */
(function (MF) {
  'use strict';

  var current = null;
  var saveTimer = null;

  function createNewState() {
    var muscles = {};
    MF.data.muscles.list.forEach(function (m) {
      muscles[m.id] = {
        size: 8,            /* 0..100 Entwicklungsgrad */
        fatigue: 0,         /* 0..1 */
        pending: 0,         /* gesammelter Reiz, wird nachts umgewandelt */
        lastTrainedDay: 0,
        setsToday: 0
      };
    });

    return {
      version: MF.core.storage.VERSION,
      day: 1,
      xp: 0,
      level: 1,
      money: 120,
      energy: MF.data.levels.forLevel(1).energy,
      muscles: muscles,
      health: { herz: 100, leber: 100, schlaf: 100, laune: 100 },
      active: [],            /* laufende Kuren: { id, daysLeft, total } */
      crash: null,           /* { daysLeft, name } nach einer Anabol-Kur */
      owned: {},             /* wie oft schon gekauft: { supplementId: n } */
      stats: {
        totalSets: 0,
        totalReps: 0,
        perfectReps: 0,
        bestForm: 0,
        daysTrained: 0,
        natural: true,       /* nie etwas aus 'grenz' oder 'anabol' genommen */
        peakMass: 0
      },
      history: [],           /* [{ day, mass }] — letzte 40 Tage */
      settings: { haptics: true },
      seenIntro: false,
      lastReport: null
    };
  }

  function get() {
    return current;
  }

  function set(next) {
    current = next;
    return current;
  }

  function muscle(id) {
    return current.muscles[id];
  }

  /* Fehlende Felder aus einem alten Spielstand ergaenzen, damit ein
     erweitertes Spiel nicht an einem Save von gestern scheitert. */
  function hydrate(loaded) {
    var fresh = createNewState();

    Object.keys(fresh).forEach(function (key) {
      if (loaded[key] === undefined || loaded[key] === null) loaded[key] = fresh[key];
    });

    MF.data.muscles.ids.forEach(function (id) {
      if (!loaded.muscles[id]) loaded.muscles[id] = fresh.muscles[id];
      else {
        Object.keys(fresh.muscles[id]).forEach(function (k) {
          if (typeof loaded.muscles[id][k] !== 'number') loaded.muscles[id][k] = fresh.muscles[id][k];
        });
      }
    });

    Object.keys(fresh.health).forEach(function (k) {
      if (typeof loaded.health[k] !== 'number') loaded.health[k] = fresh.health[k];
    });
    Object.keys(fresh.stats).forEach(function (k) {
      if (loaded.stats[k] === undefined) loaded.stats[k] = fresh.stats[k];
    });
    Object.keys(fresh.settings).forEach(function (k) {
      if (loaded.settings[k] === undefined) loaded.settings[k] = fresh.settings[k];
    });

    return loaded;
  }

  /* Nicht bei jedem Tipp auf die Platte — kurz sammeln, dann schreiben. */
  function saveSoon() {
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(function () {
      saveTimer = null;
      MF.core.storage.save(current);
    }, 400);
  }

  function saveNow() {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    MF.core.storage.save(current);
  }

  MF.game.state = {
    createNewState: createNewState,
    hydrate: hydrate,
    get: get,
    set: set,
    muscle: muscle,
    saveSoon: saveSoon,
    saveNow: saveNow
  };
})(window.MacFit);
