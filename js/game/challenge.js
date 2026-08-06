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
     wert. Der Aufschlag faellt bewusst klein aus, seit die Zettel selbst
     mitwachsen (maxIndex in data/challenges.js) — sonst zahlte man zweimal
     fuer dieselbe Sache, einmal ueber den schwereren Zettel und noch einmal
     ueber den Rang. */
  function rankStep() {
    var idx = MF.game.fitness.RANKS.indexOf(MF.game.fitness.rank());
    return Math.max(0, idx);
  }

  function reward(def) {
    return {
      money: Math.round(def.money * (1 + rankStep() * 0.12)),
      xp: Math.round(def.xp * (1 + rankStep() * 0.10))
    };
  }

  /* Die Auslosung: gemischt, aber gerecht.

     Ein glattes day % pool.length liefe die Liste stur der Reihe nach ab —
     man wuesste schon abends, was morgen haengt. Reines Wuerfeln aus der
     Tageszahl ist dafuer ungerecht: bei einem kleinen Topf kommen einzelne
     Zettel wochenlang nicht dran.

     Deshalb wird der Topf rundenweise durchgespielt. Jede Runde ist so lang
     wie der Topf gross ist und wird vorher gemischt — innerhalb einer Runde
     kommt jeder Zettel genau einmal, die Reihenfolge ist aber jedes Mal eine
     andere. Gemischt wird mit einem winzigen Generator, der allein an der
     Rundennummer haengt: ein Neustart haengt denselben Zettel wieder aus. */
  function shuffled(pool, round) {
    var order = pool.slice();
    /* Lehmer-Generator, klein genug, dass jede Zwischenzahl exakt bleibt. */
    var seed = (round * 7919 + 13) % 65537;
    for (var i = order.length - 1; i > 0; i--) {
      seed = (seed * 75 + 74) % 65537;
      var j = seed % (i + 1);
      var tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    return order;
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

    var n = pool.length;
    var day = Math.max(0, s.day);
    var order = shuffled(pool, Math.floor(day / n));
    var slot = day % n;
    var def = order[slot];
    /* Nie zweimal hintereinander derselbe Zettel — das kann nur am Wechsel
       von einer Runde zur naechsten passieren. c.id haelt an dieser Stelle
       noch den von gestern. */
    if (n > 1 && def.id === c.id) def = order[(slot + 1) % n];

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

  /* Wie viele verschiedene Partien heute schon dran waren. */
  function musclesToday() {
    var s = state();
    return MF.data.muscles.ids.filter(function (id) {
      return s.muscles[id].setsToday > 0;
    }).length;
  }

  /* Perfekte Wiederholungen des laufenden Tages. Das Tageskonto wird beim
     Tageswechsel zurueckgesetzt — bis dahin gilt der Stand aus s.today. */
  function perfectToday() {
    var s = state();
    return s.today.day === s.day ? s.today.perfect : 0;
  }

  /* Erfuellt dieser Satz den Zettel? Reine Pruefung, veraendert nichts.
     Geprueft wird nach jedem Satz — Zettel, die den ganzen Tag zaehlen
     (sets, muscles, dayperfect), lesen dabei das Tageskonto mit. */
  function satisfies(def, result) {
    /* Mindest-Gewichtsstufe, wo eine gefordert ist. Ohne sie liesse sich
       fast jede Aufgabe auf "Leicht" abfruehstuecken: die perfekte Zone ist
       dort zwanzig Prozent breiter. */
    if (def.weight !== undefined && result.weightIndex < def.weight) return false;

    if (def.kind === 'streak') return result.bestStreak >= def.n;

    if (def.kind === 'clean') {
      if (result.miss > 0) return false;
      /* Ein Dropset ist ein halber Satz — der zaehlt hier nicht. */
      if (result.reps < result.exercise.reps) return false;
      if (def.maxOk !== undefined && result.ok > def.maxOk) return false;
      return true;
    }

    if (def.kind === 'form') return result.formScore >= def.form;
    if (def.kind === 'sets') return MF.game.day.setsToday() >= def.n;
    if (def.kind === 'muscles') return musclesToday() >= def.n;
    if (def.kind === 'dayperfect') return perfectToday() >= def.n;
    if (def.kind === 'drop') return (result.dropStep || 0) >= def.n;
    if (def.kind === 'spotter') return result.forced === 'hit';
    if (def.kind === 'wobble') return (result.wobbleHits || 0) >= def.n;
    if (def.kind === 'flow') return (result.flowBonus || 0) >= def.flow;
    if (def.kind === 'kondition') {
      return result.exercise.kind === 'kondition' && result.formScore >= def.form;
    }
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

  /* Zwischenstand fuer die Zettel, die ueber den ganzen Tag laufen. Alle
     anderen entscheiden sich in einem einzigen Satz — da gibt es nichts
     anzuzeigen, deshalb null. */
  function progress(def) {
    if (def.kind === 'sets') {
      return { have: MF.game.day.setsToday(), need: def.n, unit: 'Sätzen' };
    }
    if (def.kind === 'muscles') {
      return { have: musclesToday(), need: def.n, unit: 'Partien' };
    }
    if (def.kind === 'dayperfect') {
      return { have: perfectToday(), need: def.n, unit: 'perfekten Wiederholungen' };
    }
    return null;
  }

  MF.game.challenge = {
    today: today,
    isDone: isDone,
    reward: reward,
    progress: progress,
    satisfies: satisfies,
    check: check,
    takeLevelUp: takeLevelUp,
    evaluateDay: evaluateDay
  };
})(window.MacFit);
