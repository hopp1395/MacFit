/* Die Tagesaufgabe vom Schwarzen Brett: auswaehlen, pruefen, auszahlen.

   Der Zettel des Tages steht in s.challenge und wird EINMAL pro Tag
   ausgelost — deterministisch aus der Tageszahl, damit ein Neustart
   nichts Neues aushaengt. Geprueft wird nach jedem Satz aus dem fertigen
   Ergebnis; ein erledigter Zettel bleibt erledigt. */
(function (MF) {
  'use strict';

  var util = MF.core.util;

  function state() { return MF.game.state.get(); }

  /* Die Belohnung waechst mit dem Rang: derselbe Zettel ist spaeter mehr
     wert, sonst lohnt er sich ab der Mitte des Spiels nicht mehr. */
  function rankStep() {
    var idx = MF.game.fitness.RANKS.indexOf(MF.game.fitness.rank());
    return Math.max(0, idx);
  }

  function reward(def) {
    return {
      money: Math.round(def.money * (1 + rankStep() * 0.25)),
      xp: Math.round(def.xp * (1 + rankStep() * 0.20))
    };
  }

  /* Der Zettel des Tages. Haengt der alte noch, wird er weitergereicht. */
  function today() {
    var s = state();
    var c = s.challenge;
    if (c.day === s.day && c.id && MF.data.challenges.get(c.id)) {
      return MF.data.challenges.get(c.id);
    }

    var pool = MF.data.challenges.forIndex(MF.game.fitness.index());
    if (!pool.length) pool = MF.data.challenges.list;
    var def = pool[((s.day % pool.length) + pool.length) % pool.length];

    c.day = s.day;
    c.id = def.id;
    c.done = false;
    MF.game.state.saveSoon();
    return def;
  }

  function isDone() {
    var s = state();
    return s.challenge.day === s.day && !!s.challenge.done;
  }

  /* Erfuellt dieser Satz den Zettel? Reine Pruefung, veraendert nichts. */
  function satisfies(def, result) {
    if (def.kind === 'streak') return result.bestStreak >= def.n;
    if (def.kind === 'clean') return result.miss === 0 && result.reps >= result.exercise.reps;
    if (def.kind === 'form') {
      return result.formScore >= def.form && result.weightIndex >= def.weight;
    }
    if (def.kind === 'sets') return MF.game.day.setsToday() >= def.n;
    return false;
  }

  /* Ein Aufstieg durch die Praemie darf nicht untergehen: er wird hier
     geparkt und von der Satz-Auswertung abgeholt. */
  var pendingLevelUp = null;

  function takeLevelUp() {
    var up = pendingLevelUp;
    pendingLevelUp = null;
    return up;
  }

  /* Nach jedem Satz pruefen — und bei Erfolg sofort auszahlen. */
  function check(result) {
    var s = state();
    if (isDone()) return null;

    var def = today();
    if (!satisfies(def, result)) return null;

    var pay = reward(def);
    s.challenge.done = true;
    MF.game.economy.earn(pay.money);
    var up = MF.game.progression.addXp(pay.xp);
    if (up) pendingLevelUp = up;
    s.health.laune = util.clamp(s.health.laune + 3, 0, 100);
    MF.game.state.saveNow();

    var out = { def: def, reward: pay };
    /* Am Satz-Ergebnis vermerken — die Auswertung zeigt es als eigene Zeile. */
    result.board = out;
    MF.core.events.emit('challenge:done', out);
    return out;
  }

  /* Abrechnung fuer den Tagesreport — vor dem Tageswechsel abfragen. */
  function evaluateDay() {
    var s = state();
    if (s.challenge.day !== s.day || !s.challenge.id) return null;
    var def = MF.data.challenges.get(s.challenge.id);
    if (!def) return null;
    return { title: def.title, done: !!s.challenge.done, money: reward(def).money };
  }

  /* Der Satz-Ausgang traegt alles Noetige — kein eigener Zaehler noetig. */
  MF.core.events.on('set:finished', function (result) {
    check(result);
  });

  MF.game.challenge = {
    today: today,
    isDone: isDone,
    reward: reward,
    satisfies: satisfies,
    check: check,
    takeLevelUp: takeLevelUp,
    evaluateDay: evaluateDay
  };
})(window.MacFit);
