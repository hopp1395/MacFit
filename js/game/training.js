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

  function state() { return MF.game.state.get(); }

  function weightAt(index) {
    return WEIGHTS[util.clamp(index, 0, WEIGHTS.length - 1)];
  }

  function energyCost(exercise, weightIndex) {
    return Math.round(exercise.energy * weightAt(weightIndex).energy);
  }

  function isUnlocked(exercise) {
    return state().level >= exercise.unlockLevel;
  }

  /* Darf dieser Satz gestartet werden? */
  function canTrain(exercise, weightIndex) {
    var s = state();
    if (!isUnlocked(exercise)) {
      return { ok: false, reason: 'Erst ab Level ' + exercise.unlockLevel + ' verfügbar.' };
    }
    if (s.energy < energyCost(exercise, weightIndex)) {
      return { ok: false, reason: 'Zu wenig Energie. Zeit zu schlafen.' };
    }
    if (s.muscles[exercise.muscle].fatigue >= 0.95) {
      return { ok: false, reason: MF.data.muscles.get(exercise.muscle).name + ' ist komplett platt.' };
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

  /* Energie sofort abziehen, sobald der Satz startet. */
  function beginSet(exercise, weightIndex) {
    var s = state();
    s.energy = Math.max(0, s.energy - energyCost(exercise, weightIndex));
    MF.core.events.emit('energy:changed');
    MF.game.state.saveSoon();
  }

  /* hits: Array aus 'perfect' | 'ok' | 'miss' */
  function finishSet(exercise, weightIndex, hits) {
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

    var stimulus = exercise.stimulus * weight.stim * formScore * (1 - m.fatigue * 0.60);
    stimulus = Math.max(0, stimulus);

    m.pending += stimulus;
    m.fatigue = util.clamp(m.fatigue + 0.15 * weight.energy, 0, 1);
    m.lastTrainedDay = s.day;
    m.setsToday += 1;

    var xp = Math.round(stimulus * 1.5 + perfect * 2);
    var levelUp = MF.game.progression.addXp(xp);

    s.stats.totalSets += 1;
    s.stats.totalReps += reps;
    s.stats.perfectReps += perfect;
    if (formScore > s.stats.bestForm) s.stats.bestForm = formScore;

    /* Ein völlig verrissener Satz drückt auf die Laune. */
    if (formScore < 0.35) {
      s.health.laune = util.clamp(s.health.laune - 1.5, 0, 100);
    }

    var result = {
      exercise: exercise,
      weight: weight,
      perfect: perfect,
      ok: ok,
      miss: miss,
      reps: reps,
      formScore: formScore,
      stimulus: stimulus,
      xp: xp,
      levelUp: levelUp,
      grade: gradeFor(formScore)
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
    weightAt: weightAt,
    energyCost: energyCost,
    isUnlocked: isUnlocked,
    canTrain: canTrain,
    zoneWidth: zoneWidth,
    markerSpeed: markerSpeed,
    beginSet: beginSet,
    finishSet: finishSet
  };
})(window.MacFit);
