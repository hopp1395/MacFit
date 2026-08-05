/* Zentraler Spielzustand. Alles, was einen Spielstand ausmacht, steht hier —
   abgeleitete Werte gehören dagegen nach stats.js. */
(function (MF) {
  'use strict';

  var current = null;
  var saveTimer = null;
  var autosaveTimer = null;

  function createNewState() {
    var muscles = {};
    MF.data.muscles.list.forEach(function (m) {
      muscles[m.id] = {
        size: 8,            /* 0..100 Entwicklungsgrad */
        fatigue: 0,         /* 0..1 */
        pending: 0,         /* gesammelter Reiz, wird nachts umgewandelt */
        lastTrainedDay: 0,
        setsToday: 0,
        injuryDays: 0       /* Zerrung: so viele Tage gesperrt */
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
      /* Coaching-Abos — bewusst getrennt von active: der Burnout leert active,
         ein bezahltes Abo darf er nicht mitreißen. todayPlan ist der Tagescache
         der Zielpartien (nur IDs, muss durch JSON und Cloud passen). */
      coach: { planDays: 0, planAuto: true, planStart: 0, trainer: false,
               todayPlan: null },
      /* Zettel vom Schwarzen Brett: gilt fuer genau einen Tag. */
      challenge: { day: 0, id: '', done: false, shownDay: 0 },
      /* Trainingsserie ueber echte Kalendertage (siehe game/streak.js). */
      streak: { lastDay: '', days: 0, best: 0 },
      /* Was heute zusammengekommen ist — fuer die Zusammenfassung vor dem
         Feierabend. day haelt fest, fuer welchen Spieltag die Zahlen gelten;
         beim Tageswechsel faengt die Zaehlung von selbst wieder bei null an. */
      today: { day: 0, reps: 0, perfect: 0, xp: 0 },
      stats: {
        totalSets: 0,
        totalReps: 0,
        perfectReps: 0,
        bestForm: 0,
        daysTrained: 0,
        natural: true,       /* nie etwas aus 'grenz' oder 'anabol' genommen */
        peakMass: 0
      },
      /* Ein Eintrag pro abgeschlossenem Tag, letzte 40:
         [{ day, mass, gain, fit, sets, level }] — siehe game/day.js. */
      history: [],
      /* created bleibt false, bis die Anlage durchlaufen ist. Alte Spielstände
         ohne diesen Block laufen dadurch einmalig durch die Anlage.
         photo ist ein verkleinertes JPEG als data-URL oder leer. */
      player: { name: '', outfit: 'blau', photo: '', number: '', since: 1, created: false,
                mailAskedDay: 0 },
      /* autoResume: nach der Nacht ohne Tippen weiterspielen (Wahl am
         Schlaf-Countdown, bleibt über Sitzungen erhalten). */
      settings: { haptics: true, music: true, sound: true, muscle: 'brust', weight: 1,
                  autoResume: false, shopTab: 'alle' },
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
    Object.keys(fresh.coach).forEach(function (k) {
      if (loaded.coach[k] === undefined) loaded.coach[k] = fresh.coach[k];
    });
    Object.keys(fresh.challenge).forEach(function (k) {
      if (loaded.challenge[k] === undefined) loaded.challenge[k] = fresh.challenge[k];
    });
    Object.keys(fresh.streak).forEach(function (k) {
      if (loaded.streak[k] === undefined) loaded.streak[k] = fresh.streak[k];
    });
    Object.keys(fresh.today).forEach(function (k) {
      if (typeof loaded.today[k] !== 'number') loaded.today[k] = fresh.today[k];
    });
    Object.keys(fresh.settings).forEach(function (k) {
      if (loaded.settings[k] === undefined) loaded.settings[k] = fresh.settings[k];
    });
    Object.keys(fresh.player).forEach(function (k) {
      if (loaded.player[k] === undefined) loaded.player[k] = fresh.player[k];
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
    return MF.core.storage.save(current);
  }

  /* Sicherheitsnetz: regelmäßig nachsehen, ob sich etwas geändert hat.
     storage.save() schreibt nur bei echten Änderungen, ein Leerlauf kostet
     also nichts. Fängt vergessene Speicherpunkte und Browser ab, die beim
     Schließen kein pagehide mehr liefern (kommt auf iOS vor). */
  function startAutosave(seconds) {
    if (autosaveTimer) window.clearInterval(autosaveTimer);
    autosaveTimer = window.setInterval(function () {
      if (current) MF.core.storage.save(current);
    }, (seconds || 15) * 1000);
  }

  MF.game.state = {
    createNewState: createNewState,
    hydrate: hydrate,
    get: get,
    set: set,
    muscle: muscle,
    saveSoon: saveSoon,
    saveNow: saveNow,
    startAutosave: startAutosave
  };
})(window.MacFit);
