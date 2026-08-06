/* Die Meisterschaft: Termin, Zulassung, Wertung, Platzierung.

   Die Bühnenwertung hat vier Teile, damit auf dem Ergebniszettel steht,
   woran es lag:

     Masse        400 Punkte — was der Körper hergibt (fitness.massScore)
     Posen        300 Punkte — wie gut die drei gewählten Posen zu den
                  tatsächlich trainierten Partien passen
     Symmetrie    150 Punkte — Einseitigkeit fällt auf der Bühne auf
     Ausführung   150 Punkte — das Halten der Pose im Minispiel

   Darauf liegt die Gesundheit als Faktor (0,85 bis 1,0): wer kaputt ist,
   sieht auf der Bühne auch so aus.

   Die Gegner werden aus der eigenen Wertung gewürfelt, nicht absolut
   gesetzt. Das ist Absicht: eine feste Latte wäre am Anfang unerreichbar
   und später bedeutungslos. Der Unterschied zwischen den Klassen steckt im
   Faktorbereich — in der offenen Klasse ist das Feld deutlich stärker. */
(function (MF) {
  'use strict';

  var util = MF.core.util;

  function state() { return MF.game.state.get(); }
  function data() { return MF.data.contest; }

  /* ---------- Termin -------------------------------------------------------- */

  function unlocked() {
    var s = state();
    return !!s && s.level >= data().UNLOCK_LEVEL;
  }

  /* Termine liegen auf FIRST_DAY, FIRST_DAY + 10, + 20 ... */
  function isContestDay(day) {
    var d = data();
    return day >= d.FIRST_DAY && (day - d.FIRST_DAY) % d.INTERVAL === 0;
  }

  /* Der nächste Termin ab heute — der heutige zählt nur, solange man noch
     nicht angetreten ist. */
  function nextDay() {
    var s = state();
    var d = data();
    if (s.day <= d.FIRST_DAY) {
      return s.day === d.FIRST_DAY && s.contest.lastDay === s.day
        ? d.FIRST_DAY + d.INTERVAL : d.FIRST_DAY;
    }
    var steps = Math.ceil((s.day - d.FIRST_DAY) / d.INTERVAL);
    var day = d.FIRST_DAY + steps * d.INTERVAL;
    if (day === s.day && s.contest.lastDay === s.day) day += d.INTERVAL;
    return day;
  }

  function daysUntil() {
    return nextDay() - state().day;
  }

  function isToday() {
    var s = state();
    return unlocked() && isContestDay(s.day) && s.contest.lastDay !== s.day;
  }

  /* Schon angetreten heute? */
  function doneToday() {
    var s = state();
    return s.contest.lastDay === s.day;
  }

  /* ---------- Zulassung ----------------------------------------------------- */

  function canEnter(def) {
    var s = state();
    if (!unlocked()) return { ok: false, reason: 'Ab Level ' + data().UNLOCK_LEVEL };
    if (!isContestDay(s.day)) return { ok: false, reason: 'Kein Wettkampftag' };
    if (doneToday()) return { ok: false, reason: 'Heute schon angetreten' };
    if (def.naturalOnly && !s.stats.natural) {
      return { ok: false, reason: 'Dopingkontrolle' };
    }
    if (!MF.game.economy.canAfford(def.fee)) return { ok: false, reason: 'Startgeld fehlt' };
    if (s.energy < data().POSES_NEEDED * data().POSE_ENERGY) {
      return { ok: false, reason: 'Zu wenig Energie' };
    }
    return { ok: true };
  }

  /* Startgeld zahlen. Das Geld ist weg, egal wie es ausgeht. */
  function enter(def) {
    var check = canEnter(def);
    if (!check.ok) return check;
    MF.game.economy.spend(def.fee);
    MF.game.state.saveNow();
    return { ok: true };
  }

  function spendPose() {
    var s = state();
    s.energy = Math.max(0, s.energy - data().POSE_ENERGY);
    MF.core.events.emit('energy:changed');
  }

  /* ---------- Wertung ------------------------------------------------------- */

  /* Wie gut zeigt eine Pose den Körper, den man wirklich hat? Gemittelt über
     die Partien, die sie herausstellt. */
  function poseScore(poseId) {
    var pose = MF.ui.poses.get(poseId);
    var m = state().muscles;
    var list = pose.focus || [];
    if (!list.length) return 0;
    var sum = 0;
    list.forEach(function (id) {
      sum += util.clamp(m[id].size / 100, 0, 1);
    });
    return sum / list.length;
  }

  /* hits: Liste aus 'perfect' | 'ok' | 'miss' über alle Posen. */
  function execution(hits) {
    if (!hits || !hits.length) return 0;
    var sum = 0;
    hits.forEach(function (h) {
      sum += h === 'perfect' ? 1 : (h === 'ok' ? 0.6 : 0);
    });
    return sum / hits.length;
  }

  /* Die Aufschlüsselung — die Oberfläche zeigt genau diese Zeilen. */
  function score(poseIds, hits) {
    var masse = MF.game.fitness.massScore() / MF.game.fitness.MAX * 400;
    var posen = 0;
    (poseIds || []).forEach(function (id) { posen += poseScore(id); });
    posen = poseIds && poseIds.length ? (posen / poseIds.length) * 300 : 0;
    var symmetrie = MF.game.stats.symmetry() / 100 * 150;
    var ausfuehrung = execution(hits) * 150;
    var health = 0.85 + 0.15 * (MF.game.stats.healthAvg() / 100);

    var parts = [
      { key: 'masse', name: 'Masse', value: masse, max: 400 },
      { key: 'posen', name: 'Posen', value: posen, max: 300 },
      { key: 'symmetrie', name: 'Symmetrie', value: symmetrie, max: 150 },
      { key: 'ausfuehrung', name: 'Ausführung', value: ausfuehrung, max: 150 }
    ];
    var sum = masse + posen + symmetrie + ausfuehrung;

    return {
      parts: parts,
      health: health,
      total: Math.round(sum * health)
    };
  }

  /* Die eigene Wertung ohne Kür — Grundlage für die Stärke des Feldes.
     Ohne sie hinge die Konkurrenz an der Tagesform im Minispiel. */
  function baseScore() {
    var masse = MF.game.fitness.massScore() / MF.game.fitness.MAX * 400;
    var symmetrie = MF.game.stats.symmetry() / 100 * 150;
    /* Mittelmaß bei Posen und Ausführung als Bezugspunkt. */
    return Math.round((masse + 150 + symmetrie + 90));
  }

  /* Immer dieselben Gegner am selben Tag in derselben Klasse — ohne
     gespeicherten Zustand. Der Sinus-Hash reicht dafür völlig. */
  function noise(n) {
    var x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  /* Das Starterfeld: fünf Gegner plus der eigene Rivale, wenn er antritt. */
  function opponents(def) {
    var s = state();
    var base = baseScore();
    var seed = s.day * 31 + (def.id === 'natural' ? 7 : 13);
    var out = [];

    for (var i = 0; i < 5; i++) {
      var who = data().field[Math.floor(noise(seed + i * 3) * data().field.length)];
      var span = def.field.high - def.field.low;
      var factor = def.field.low + noise(seed + i * 7 + 1) * span;
      out.push({
        name: who.name, gym: who.gym,
        total: Math.max(40, Math.round(base * factor)),
        rival: false
      });
    }

    /* Der Rivale steht mit auf der Bühne — mit seinen echten Zahlen. Das
       ist der Moment, auf den das ganze Nebeneinander hinausläuft. */
    if (MF.game.rival.active()) {
      var v = MF.game.rival.view();
      if (v) {
        var rivalBase = MF.game.fitness.scoreForMass(v.mass) / MF.game.fitness.MAX * 400;
        out.push({
          name: v.name, gym: 'dein Studio',
          total: Math.max(40, Math.round((rivalBase + 150 + 110 + 90)
            * (0.9 + noise(seed + 99) * 0.2))),
          rival: true
        });
      }
    }

    return out;
  }

  /* ---------- Durchlauf ----------------------------------------------------- */

  /* Auswerten, einsortieren, auszahlen. poseIds und hits kommen aus dem
     Minispiel. */
  function finish(def, poseIds, hits) {
    var s = state();
    var mine = score(poseIds, hits);
    var field = opponents(def);

    var all = field.slice();
    all.push({ name: s.player.name || 'Du', gym: 'dein Studio', total: mine.total, me: true });
    all.sort(function (a, b) { return b.total - a.total; });

    var rank = 1;
    for (var i = 0; i < all.length; i++) {
      if (all[i].me) { rank = i + 1; break; }
    }

    var money = def.purse[rank - 1] || 0;
    var xp = def.xp[rank - 1] || Math.round(def.xp[2] * 0.4);

    s.contest.lastDay = s.day;
    s.contest.entries += 1;
    if (rank === 1) s.contest.wins += 1;
    if (!s.contest.best || rank < s.contest.best) s.contest.best = rank;
    s.contest.title = data().titleFor(s.contest.wins);
    s.contest.history.push({
      day: s.day, klasse: def.id, rank: rank, total: mine.total,
      starters: all.length, money: money
    });
    if (s.contest.history.length > 20) s.contest.history.shift();

    if (money) MF.game.economy.earn(money);
    var levelUp = MF.game.progression.addXp(xp);

    MF.core.events.emit('contest:done', { rank: rank, total: mine.total, money: money });
    MF.game.state.saveNow();

    return {
      rank: rank, starters: all.length, board: all, score: mine,
      money: money, xp: xp, levelUp: levelUp, klasse: def,
      title: s.contest.title, wins: s.contest.wins
    };
  }

  MF.game.contest = {
    unlocked: unlocked,
    isContestDay: isContestDay,
    isToday: isToday,
    doneToday: doneToday,
    nextDay: nextDay,
    daysUntil: daysUntil,
    canEnter: canEnter,
    enter: enter,
    spendPose: spendPose,
    poseScore: poseScore,
    execution: execution,
    score: score,
    baseScore: baseScore,
    opponents: opponents,
    finish: finish
  };
})(window.MacFit);
