/* Der Inhalt der Coaching-Abos: welcher Split-Tag heute ist, welche Partien
   dran sind, was der Trainer aus der Analyse macht. Kauf und Abrechnung
   stehen in abos.js — hier wird nur abgeleitet und gerechnet.

   Die Ziele des Tages werden EINMAL bestimmt und in s.coach.todayPlan
   gecacht: die Trainer-Auswahl hängt von der Ermüdung ab, die sich tagsüber
   ändert — Banner am Morgen und Auswertung am Abend müssen aber dieselben
   Ziele sehen. Im Cache stehen nur IDs, er läuft mit durch JSON und Cloud. */
(function (MF) {
  'use strict';

  var ADVICE = {
    masse: 'Mehr schwere Sätze — Masse ist die Basis des Index.',
    symmetrie: 'Zu einseitig trainiert. Kümmere dich um die Partien unten.',
    gesundheit: 'Deine Werte bremsen das Wachstum. Gönn dir Ruhe oder eine Reha-Kur.',
    technik: 'Zu viele unsaubere Wiederholungen. Weniger Gewicht, die grüne Zone treffen.',
    konstanz: 'Zu viele trainingsfreie Tage. Regelmäßigkeit schlägt Heldentaten.'
  };
  var HEALTH_LABELS = { herz: 'Herz', leber: 'Leber', schlaf: 'Schlaf', laune: 'Laune' };

  function state() { return MF.game.state.get(); }

  function splitToday() {
    var s = state();
    var idx = ((s.day - s.coach.planStart) % 3 + 3) % 3;
    return MF.data.abos.split[idx];
  }

  /* Das stärkste freigeschaltete Gerät einer Partie — oder null, wenn es
     noch keins gibt (frühe Level). */
  function bestExercise(muscleId) {
    var best = null;
    MF.data.exercises.byMuscle(muscleId).forEach(function (ex) {
      if (!MF.game.training.isUnlocked(ex)) return;
      if (!best || ex.stimulus > best.stimulus) best = ex;
    });
    return best;
  }

  /* Nur Plan-Abo: alle Partien des heutigen Split-Tags. */
  function splitPlan() {
    var day = splitToday();
    var targets = [];
    day.muscles.forEach(function (mid) {
      var ex = bestExercise(mid);
      if (ex) targets.push({ muscle: mid, exercise: ex.id });
    });
    return { day: state().day, source: 'plan', title: day.name, targets: targets };
  }

  /* Trainer: die schwächsten ausgeruhten Partien. Läuft zusätzlich das
     Plan-Abo, bleibt der Split-Tag stehen und der Trainer wählt darin —
     erst wenn dort weniger als zwei Kandidaten übrig sind, füllt er mit
     den global schwächsten auf. */
  function trainerPlan() {
    var s = state();
    var ranked = MF.game.stats.weakestMuscles().filter(function (m) {
      return s.muscles[m.id].fatigue < 0.7 && !!bestExercise(m.id);
    });

    var picks = [];
    function add(m) {
      for (var i = 0; i < picks.length; i++) {
        if (picks[i].id === m.id) return;
      }
      if (picks.length < 3) picks.push(m);
    }

    var title = 'Schwachstellen';
    if (MF.game.abos.planActive()) {
      var day = splitToday();
      title = day.name;
      ranked.forEach(function (m) {
        if (day.muscles.indexOf(m.id) >= 0) add(m);
      });
      if (picks.length < 2) ranked.forEach(add);
    } else {
      ranked.forEach(add);
    }

    var targets = picks.map(function (m) {
      return { muscle: m.id, exercise: bestExercise(m.id).id };
    });
    return { day: s.day, source: 'trainer', title: title, targets: targets };
  }

  /* Die Ziele des Tages — gecacht, siehe Kopfkommentar. */
  function todayTargets() {
    var s = state();
    if (!MF.game.abos.planActive() && !MF.game.abos.trainerActive()) return null;
    if (s.coach.todayPlan && s.coach.todayPlan.day === s.day) return s.coach.todayPlan;

    var plan = MF.game.abos.trainerActive() ? trainerPlan() : splitPlan();
    s.coach.todayPlan = plan;
    MF.game.state.saveSoon();
    return plan;
  }

  function isTargetMuscle(muscleId) {
    var plan = todayTargets();
    if (!plan) return false;
    for (var i = 0; i < plan.targets.length; i++) {
      if (plan.targets[i].muscle === muscleId) return true;
    }
    return false;
  }

  function isTargetExercise(exerciseId) {
    var plan = todayTargets();
    if (!plan) return false;
    for (var i = 0; i < plan.targets.length; i++) {
      if (plan.targets[i].exercise === exerciseId) return true;
    }
    return false;
  }

  /* Abendliche Auswertung — muss in sleep() VOR dem Zurücksetzen von
     setsToday laufen, sonst ist nichts mehr zu zählen. */
  function evaluateDay() {
    var s = state();
    var plan = todayTargets();
    if (!plan || !plan.targets.length) return null;

    var done = 0;
    plan.targets.forEach(function (t) {
      if (s.muscles[t.muscle].setsToday > 0) done += 1;
    });
    var status = done === plan.targets.length ? 'erfuellt'
               : done > 0 ? 'teilweise' : 'offen';
    return { status: status, done: done, total: plan.targets.length, title: plan.title };
  }

  /* Die Trainer-Analyse für den Körper-Bildschirm. */
  function analysis() {
    var s = state();
    var ranked = MF.game.stats.weakestMuscles();
    var parts = MF.game.fitness.parts();

    var worst = null;
    parts.components.forEach(function (comp) {
      if (!worst || comp.value < worst.value) worst = comp;
    });

    var flags = [];
    Object.keys(HEALTH_LABELS).forEach(function (k) {
      if (s.health[k] < 50) {
        flags.push(HEALTH_LABELS[k] + ' angeschlagen (' + Math.round(s.health[k]) + ' von 100) — schone dich.');
      }
    });

    return {
      weakest3: ranked.slice(0, 3),
      componentAdvice: { name: worst.name, text: ADVICE[worst.key] || '' },
      healthFlags: flags
    };
  }

  MF.game.coach = {
    splitToday: splitToday,
    bestExercise: bestExercise,
    todayTargets: todayTargets,
    isTargetMuscle: isTargetMuscle,
    isTargetExercise: isTargetExercise,
    evaluateDay: evaluateDay,
    analysis: analysis
  };
})(window.MacFit);
