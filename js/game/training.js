/* Satz-Logik: Schwierigkeit eines Geraets und Auswertung der getippten Reps.
   Kennt keine UI — bekommt nur die Trefferqualitaeten und rechnet. */
(function (MF) {
  'use strict';

  var util = MF.core.util;

  /* Gewichtsstufen: mehr Reiz, aber schneller Marker und engere Zone. */
  var WEIGHTS = [
    { key: 'leicht', name: 'Leicht',  stim: 0.75, speed: 0.85, zone: 1.20, energy: 0.75 },
    { key: 'normal', name: 'Normal',  stim: 1.00, speed: 1.00, zone: 1.00, energy: 1.00 },
    { key: 'schwer', name: 'Schwer',  stim: 1.35, speed: 1.14, zone: 0.82, energy: 1.30 },
    { key: 'brutal', name: 'Brutal',  stim: 1.80, speed: 1.30, zone: 0.66, energy: 1.65 }
  ];

  /* Erfahrung je Wiederholung — dieselben Werte zeigt der Satz-Bildschirm
     im Moment des Treffers an. */
  var XP_PERFECT = 4;
  var XP_OK = 1;

  function state() { return MF.game.state.get(); }

  function weightAt(index) {
    return WEIGHTS[util.clamp(index, 0, WEIGHTS.length - 1)];
  }

  /* Dropset: direkt im Anschluss eine Stufe leichter weitermachen. Halber
     Satz, halbe Energie, mehr Reiz — und maximal zwei Stufen, sonst haengt
     man bis zum Umfallen an einem Geraet. */
  var DROP_MAX = 2;
  var DROP_ENERGY = 0.5;
  var DROP_STIM = 1.25;
  var DROP_MIN_FORM = 0.55;
  var DROP_MIN_INDEX = 300;   /* "Solide Basis" — vorher verbrennt es nur Kraft */

  function energyCost(exercise, weightIndex, dropStep) {
    var cost = exercise.energy * weightAt(weightIndex).energy;
    if (dropStep) cost *= DROP_ENERGY;
    return Math.round(cost);
  }

  /* Wie viele Wiederholungen hat dieser Satz? Ein Dropset ist ein halber. */
  function repCount(exercise, dropStep) {
    return dropStep ? Math.max(2, Math.ceil(exercise.reps / 2)) : exercise.reps;
  }

  function isUnlocked(exercise) {
    return state().level >= exercise.unlockLevel;
  }

  /* Zerrung: nach zu vielen verrissenen Wiederholungen ist die Partie
     drei Tage gesperrt. */
  var INJURY_DAYS = 3;
  var INJURY_MISS_RATIO = 0.5;   /* mehr als die Haelfte verrissen */
  var INJURY_MIN_REPS = 5;       /* Mini-Saetze koennen nichts zerren */

  function isInjured(muscleId) {
    return state().muscles[muscleId].injuryDays > 0;
  }

  /* Darf dieser Satz gestartet werden? dropStep > 0 rechnet mit den
     guenstigeren Konditionen der Dropset-Kette. */
  function canTrain(exercise, weightIndex, dropStep) {
    var s = state();
    if (!isUnlocked(exercise)) {
      return { ok: false, reason: 'Erst ab Level ' + exercise.unlockLevel + ' verfügbar.' };
    }
    var m = s.muscles[exercise.muscle];
    var name = MF.data.muscles.get(exercise.muscle).name;
    if (m.injuryDays > 0) {
      return { ok: false, reason: name + ' ist gezerrt — noch ' + m.injuryDays
        + (m.injuryDays === 1 ? ' Tag' : ' Tage') + ' Pause.' };
    }
    if (s.energy < energyCost(exercise, weightIndex, dropStep)) {
      return { ok: false, reason: 'Zu wenig Energie. Zeit zu schlafen.' };
    }
    if (m.fatigue >= 0.95) {
      return { ok: false, reason: name + ' ist komplett platt.' };
    }
    return { ok: true };
  }

  /* Breite der perfekten Zone (Anteil der Leiste, 0..1). Die Zone schrumpft
     innerhalb des Satzes mit jeder Wiederholung. */
  function zoneWidth(exercise, weightIndex, repIndex) {
    var m = state().muscles[exercise.muscle];
    var w = exercise.zone * weightAt(weightIndex).zone * MF.game.stats.focusMultiplier();
    w *= 1 - m.fatigue * 0.30;                                  /* muede Partie */
    w *= 1 - (repIndex / Math.max(1, exercise.reps)) * 0.35;    /* Erschoepfung im Satz */
    return util.clamp(w, 0.05, 0.65);
  }

  /* Marker-Durchlaeufe pro Sekunde. */
  function markerSpeed(exercise, weightIndex, repIndex) {
    var m = state().muscles[exercise.muscle];
    var sp = exercise.speed * weightAt(weightIndex).speed;
    sp *= 1 + m.fatigue * 0.20;
    sp *= 1 + (repIndex / Math.max(1, exercise.reps)) * 0.15;
    return sp;
  }

  /* Pump-Flow: ab drei perfekten Reps in Folge zaehlt jede Flow-Rep 4 %
     Bonus-Reiz. Der Deckel waechst mit dem Fitness-Index — wer weit ist,
     holt mehr aus dem Flow (+12 % untrainiert bis +30 % Elite). */
  function flowScore(hits) {
    var streak = 0, best = 0, bonus = 0;
    for (var i = 0; i < hits.length; i++) {
      if (hits[i] === 'perfect') {
        streak += 1;
        if (streak > best) best = streak;
        if (streak >= 3) bonus += 0.04;
      } else {
        streak = 0;
      }
    }
    var cap = 0.12 + 0.18 * (MF.game.fitness.index() / MF.game.fitness.MAX);
    return { bonus: Math.min(bonus, cap), bestStreak: best };
  }

  /* Instabile Hantel: ab "Schwer" schwankt die Trefferzone. Amplitude als
     Anteil der Leiste — Ermuedung verstaerkt das Zittern, eine saubere
     Technik-Historie beruhigt die Hand. */
  function driftAmp(exercise, weightIndex) {
    if (weightIndex < 2) return 0;
    var m = state().muscles[exercise.muscle];
    var amp = (weightIndex >= 3 ? 0.07 : 0.04) + m.fatigue * 0.04;
    if (MF.game.fitness.technique() >= 0.5) amp *= 0.7;
    return amp;
  }

  /* Bietet der Spotter nach dem letzten Rep eine Extra-Rep an? Nur nach
     vollen Saetzen mit ordentlicher Form an ausgeruhten Partien — und erst
     ab "Schwer"; wer als "Durchtrainiert" gilt, bekommt ihn schon ab Normal. */
  function spotterOffer(exercise, weightIndex, hits) {
    if (hits.length < exercise.reps) return false;
    var minWeight = MF.game.fitness.index() >= 600 ? 1 : 2;
    if (weightIndex < minWeight) return false;
    if (state().muscles[exercise.muscle].fatigue > 0.85) return false;

    var perfect = 0, ok = 0;
    hits.forEach(function (h) {
      if (h === 'perfect') perfect++;
      else if (h === 'ok') ok++;
    });
    return (perfect + ok * 0.5) / hits.length >= 0.6;
  }

  /* Lohnt sich direkt im Anschluss ein Dropset? Gibt die naechste Stufe
     zurueck oder null. result ist das Ergebnis des eben beendeten Satzes. */
  function dropOffer(result) {
    var step = (result.dropStep || 0) + 1;
    if (step > DROP_MAX) return null;
    if (result.weightIndex < 1) return null;                 /* leichter geht nicht */
    if (result.formScore < DROP_MIN_FORM) return null;       /* erst sauber ziehen */
    if (MF.game.fitness.index() < DROP_MIN_INDEX) return null;
    if (result.injured) return null;

    var next = result.weightIndex - 1;
    var check = canTrain(result.exercise, next, step);
    if (!check.ok) return null;

    return {
      step: step,
      weightIndex: next,
      weight: weightAt(next),
      reps: repCount(result.exercise, step),
      cost: energyCost(result.exercise, next, step)
    };
  }

  /* Energie sofort abziehen, sobald der Satz startet. */
  /* Der Satz beginnt — Energie kostet er erst Wiederholung fuer Wiederholung
     (siehe chargeRep). Wer nach zwei Reps abbricht, zahlt auch nur zwei. */
  function beginSet() {
    MF.core.events.emit('energy:changed');
    MF.game.state.saveSoon();
  }

  /* Eine Wiederholung abrechnen. Der letzte Rep traegt den Rundungsrest,
     damit ein voller Satz exakt so viel kostet wie angeschrieben. */
  function chargeRep(exercise, weightIndex, dropStep, repIndex, totalReps) {
    var s = state();
    var total = energyCost(exercise, weightIndex, dropStep);
    var reps = Math.max(1, totalReps);
    var share = repIndex + 1 >= reps
      ? total - Math.round((total / reps) * (reps - 1) * 100) / 100
      : Math.round((total / reps) * 100) / 100;

    s.energy = Math.max(0, s.energy - share);
    MF.core.events.emit('energy:changed');
    return share;
  }

  /* hits: Array aus 'perfect' | 'ok' | 'miss'.
     forced: Ausgang der Spotter-Extra-Rep — 'hit' | 'fail' | undefined.
     Die Extra-Rep steht NICHT in hits, sie veraendert die Form nicht. */
  function finishSet(exercise, weightIndex, hits, forced, dropStep) {
    var s = state();
    var m = s.muscles[exercise.muscle];
    var weight = weightAt(weightIndex);

    var perfect = 0, ok = 0, miss = 0;
    hits.forEach(function (h) {
      if (h === 'perfect') perfect++;
      else if (h === 'ok') ok++;
      else miss++;
    });

    var reps = hits.length || 1;
    var formScore = util.clamp((perfect + ok * 0.5) / reps, 0, 1);
    var flow = flowScore(hits);

    var stimulus = exercise.stimulus * weight.stim * formScore * (1 - m.fatigue * 0.60);
    stimulus = Math.max(0, stimulus);
    stimulus *= 1 + flow.bonus;
    if (forced === 'hit') stimulus *= 1.30;
    /* Der halbe Satz direkt im Anschluss zaehlt ueberproportional — genau
       dafuer quaelt man sich die Kette runter. */
    if (dropStep) stimulus *= DROP_STIM;

    m.pending += stimulus;
    m.fatigue = util.clamp(m.fatigue + 0.15 * weight.energy
      + (forced === 'fail' ? 0.20 : 0), 0, 1);
    m.lastTrainedDay = s.day;
    m.setsToday += 1;

    /* Jede Wiederholung zahlt fuer sich: perfekt deutlich mehr als okay,
       dazu der Reiz des Satzes. So sieht man beim Tippen, wofuer man
       arbeitet — die Zahl steigt sichtbar mit jeder sauberen Rep. */
    var xp = Math.round(stimulus * 1.5)
           + perfect * XP_PERFECT + ok * XP_OK
           + Math.round(flow.bonus * 40)          /* Serie zahlt sich doppelt aus */
           + (forced === 'hit' ? 10 : 0);
    var levelUp = MF.game.progression.addXp(xp);

    s.stats.totalSets += 1;
    s.stats.totalReps += reps;
    s.stats.perfectReps += perfect;
    if (formScore > s.stats.bestForm) s.stats.bestForm = formScore;

    /* Ein völlig verrissener Satz drückt auf die Laune. */
    if (formScore < 0.35) {
      s.health.laune = util.clamp(s.health.laune - 1.5, 0, 100);
    }

    /* Die verrissene Spotter-Rep tut weh — und wer angeschlagen ist,
       zahlt obendrein mit Energie ("Zerrung light"). */
    if (forced === 'fail') {
      s.health.laune = util.clamp(s.health.laune - 2, 0, 100);
      if (MF.game.stats.healthAvg() < 45) s.energy = Math.max(0, s.energy - 10);
    }

    /* Muskelzerrung: wer den halben Satz verreisst, hat es uebertrieben —
       die Partie ist drei Tage gesperrt. Eine verrissene Spotter-Rep an
       einer schon muerben Partie reicht ebenfalls. */
    var injured = false;
    if ((reps >= INJURY_MIN_REPS && miss / reps > INJURY_MISS_RATIO)
        || (forced === 'fail' && m.fatigue >= 0.60)) {
      m.injuryDays = INJURY_DAYS;
      m.pending = 0;                    /* der Reiz dieses Satzes ist futsch */
      s.health.laune = util.clamp(s.health.laune - 4, 0, 100);
      injured = true;
      MF.core.events.emit('muscle:injured', {
        id: exercise.muscle,
        name: MF.data.muscles.get(exercise.muscle).name,
        days: INJURY_DAYS
      });
    }

    var result = {
      exercise: exercise,
      weight: weight,
      weightIndex: weightIndex,
      perfect: perfect,
      ok: ok,
      miss: miss,
      reps: reps,
      formScore: formScore,
      stimulus: stimulus,
      xp: xp,
      levelUp: levelUp,
      grade: gradeFor(formScore),
      bestStreak: flow.bestStreak,
      flowBonus: flow.bonus,
      forced: forced || null,
      dropStep: dropStep || 0,
      injured: injured,
      injuryDays: injured ? INJURY_DAYS : 0
    };

    MF.core.events.emit('set:finished', result);
    MF.game.state.saveNow();
    return result;
  }

  function gradeFor(formScore) {
    if (formScore >= 0.92) return { text: 'Perfekte Ausführung', tone: 'good' };
    if (formScore >= 0.75) return { text: 'Sauberer Satz', tone: 'good' };
    if (formScore >= 0.55) return { text: 'Geht so', tone: 'warn' };
    if (formScore >= 0.35) return { text: 'Zu viel Schwung', tone: 'warn' };
    return { text: 'Ego-Lifting', tone: 'bad' };
  }

  MF.game.training = {
    WEIGHTS: WEIGHTS,
    INJURY_DAYS: INJURY_DAYS,
    XP_PERFECT: XP_PERFECT,
    XP_OK: XP_OK,
    DROP_MAX: DROP_MAX,
    DROP_MIN_INDEX: DROP_MIN_INDEX,
    repCount: repCount,
    dropOffer: dropOffer,
    weightAt: weightAt,
    energyCost: energyCost,
    isUnlocked: isUnlocked,
    isInjured: isInjured,
    canTrain: canTrain,
    zoneWidth: zoneWidth,
    markerSpeed: markerSpeed,
    driftAmp: driftAmp,
    spotterOffer: spotterOffer,
    beginSet: beginSet,
    chargeRep: chargeRep,
    finishSet: finishSet
  };
})(window.MacFit);
