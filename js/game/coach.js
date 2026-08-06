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
    definition: 'Die Masse ist da, man sieht sie nur nicht. Kondition rein, '
              + 'Mass-Gainer raus — auf der Bühne zählt genau das.',
    technik: 'Zu viele unsaubere Wiederholungen. Weniger Gewicht, die grüne Zone treffen.',
    konstanz: 'Zu viele trainingsfreie Tage. Regelmäßigkeit schlägt Heldentaten.'
  };
  var HEALTH_LABELS = { herz: 'Herz', leber: 'Leber', schlaf: 'Schlaf', laune: 'Laune' };

  /* Ab hier schaut der Trainer genauer hin. Frueher lag die Schwelle bei 50 —
     da war der Wert schon im Keller; jetzt warnt er, bevor es bremst. */
  var HEALTH_WATCH = 65;    /* im Blick behalten */
  var HEALTH_ALARM = 45;    /* dringend gegensteuern */

  function state() { return MF.game.state.get(); }

  /* Der Gesundheitswert, der am weitesten unten liegt. */
  function worstHealth() {
    var s = state();
    var key = null, val = 101;
    Object.keys(HEALTH_LABELS).forEach(function (k) {
      if (s.health[k] < val) { val = s.health[k]; key = k; }
    });
    return { key: key, value: val, label: HEALTH_LABELS[key] };
  }

  /* Welche Kondition-Einheit passt zu einem schwachen Wert? Herz will
     Ausdauer, Schlaf und Laune wollen Ruhe — die Leber holt kein Training
     zurueck, dafuer gibt es die Reha-Kuren. */
  function conditionFor(key) {
    var wanted = key === 'herz' ? 'herz' : (key === 'leber' ? null : key);
    if (!wanted) wanted = 'laune';
    var best = null;
    MF.data.exercises.list.forEach(function (ex) {
      if (ex.kind !== 'kondition' || !ex.health) return;
      if (!MF.game.training.isUnlocked(ex)) return;
      if (MF.game.training.isInjured(ex.muscle)) return;
      var v = ex.health[wanted] || 0;
      if (v <= 0) return;
      if (!best || v > (best.health[wanted] || 0)) best = ex;
    });
    return best;
  }

  /* Der Gesundheits-Rat des Trainers: null, solange alles im gruenen
     Bereich liegt. Sonst { key, label, value, urgent, exercise, text }. */
  function healthTip() {
    var worst = worstHealth();
    if (!worst.key || worst.value >= HEALTH_WATCH) return null;

    var urgent = worst.value < HEALTH_ALARM;
    var ex = conditionFor(worst.key);
    var text;
    if (worst.key === 'leber') {
      text = urgent
        ? 'Deine Leber ist am Anschlag. Setz die Kuren ab und kauf dir Erholung.'
        : 'Die Leber trägt schwer. Zeit für eine ruhige Woche.';
    } else if (ex) {
      text = (urgent ? 'Dringend: ' : '') + worst.label + ' liegt bei '
           + Math.round(worst.value) + '. Häng ' + ex.icon + ' ' + ex.name
           + ' an dein Training — sauber ausgeführt holt das jedes Mal etwas zurück.';
    } else {
      text = worst.label + ' liegt bei ' + Math.round(worst.value)
           + '. Weniger Volumen, mehr Schlaf — und im Shop steht Regeneration.';
    }
    return {
      key: worst.key, label: worst.label, value: worst.value,
      urgent: urgent, exercise: ex, text: text
    };
  }

  function splitToday() {
    var s = state();
    var idx = ((s.day - s.coach.planStart) % 3 + 3) % 3;
    return MF.data.abos.split[idx];
  }

  /* Das stärkste freigeschaltete Gerät einer Partie — oder null, wenn es
     noch keins gibt (frühe Level) oder die Partie gerade gezerrt ist. */
  function bestExercise(muscleId) {
    if (MF.game.training.isInjured(muscleId)) return null;
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
    /* Steht ein Gesundheitswert schlecht, ist die Kondition-Einheit das
       erste Tagesziel — Masse bringt nichts, wenn der Motor stottert. */
    var tip = healthTip();
    var healthTarget = tip && tip.exercise
      ? { muscle: tip.exercise.muscle, exercise: tip.exercise.id, health: true }
      : null;

    var ranked = MF.game.stats.weakestMuscles().filter(function (m) {
      if (healthTarget && m.id === healthTarget.muscle) return false;
      return s.muscles[m.id].fatigue < 0.7 && !!bestExercise(m.id);
    });

    var room = healthTarget ? 2 : 3;
    var picks = [];
    function add(m) {
      for (var i = 0; i < picks.length; i++) {
        if (picks[i].id === m.id) return;
      }
      if (picks.length < room) picks.push(m);
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
    if (healthTarget) {
      targets.unshift(healthTarget);
      title = title + ' + Kondition';
    }
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
  /* --- Der Trainer schickt einen einkaufen ------------------------------- */

  /* Kommt nur, was jetzt gekauft werden kann: freigeschaltet und nicht
     schon aktiv. Der Preis darf drueber liegen — dann ist es ein Sparziel. */
  function shopCandidates() {
    return MF.data.supplements.list.filter(function (def) {
      return MF.game.supplements.isUnlocked(def) && !MF.game.supplements.isActive(def.id);
    });
  }

  /* Bestes Mittel fuer eine Wirkung — nach Staerke, nicht nach Preis. */
  function bestFor(key) {
    var best = null;
    shopCandidates().forEach(function (def) {
      var v = def.effects[key] || 0;
      if (v <= 0) return;
      if (!best || v > (best.effects[key] || 0)) best = def;
    });
    return best;
  }

  /* Bestes Mittel, das einen Gesundheitswert wieder hochbringt. */
  function bestHealer(key) {
    var best = null;
    shopCandidates().forEach(function (def) {
      var v = def.health[key] || 0;
      if (v <= 0) return;
      if (!best || v > (best.health[key] || 0)) best = def;
    });
    return best;
  }

  /* Die Kaufempfehlung des Trainers: erst Gesundheit retten, dann die
     schwaechste Saeule des Index stuetzen. Gibt { def, reason } oder null. */
  function recommendations(worstKey, max) {
    var s = state();
    var out = [];
    var seen = {};

    function add(def, reason) {
      if (!def || seen[def.id]) return;
      seen[def.id] = true;
      out.push({
        def: def,
        reason: reason,
        afford: MF.game.economy.canAfford(def.price)
      });
    }

    /* 1. Jeder schwache Gesundheitswert kommt zuerst dran, vom schlechtesten
          aufwaerts — und der Trainer wartet nicht, bis er im Keller ist. */
    var low = [];
    Object.keys(HEALTH_LABELS).forEach(function (k) {
      if (s.health[k] < HEALTH_WATCH) low.push({ key: k, value: s.health[k] });
    });
    low.sort(function (a, b) { return a.value - b.value; });
    low.forEach(function (entry) {
      add(bestHealer(entry.key), HEALTH_LABELS[entry.key] + ' liegt bei '
        + Math.round(entry.value) + ' — das bremst dein Wachstum jede Nacht.');
    });

    /* 2. Danach die schwaechste Saeule des Index. */
    if (worstKey === 'technik') {
      add(bestFor('focus'), 'Breitere Trefferzone hilft dir, sauber zu ziehen.');
    }
    if (worstKey === 'masse' || worstKey === 'symmetrie') {
      add(bestFor('growth'), 'Mehr Aufbau pro Nacht aus demselben Training.');
    }
    if (worstKey === 'konstanz') {
      add(bestFor('energy'), 'Mehr Energie pro Tag — dann bleibt öfter ein Satz drin.');
    }

    /* 3. Und zum Schluss, was ohnehin jedem hilft: Aufbau, Erholung,
          Trefferzone, Energie — in dieser Reihenfolge. */
    add(bestFor('growth'), 'Solide Grundlage, solange nichts brennt.');
    add(bestFor('regen'), 'Bessere Erholung heißt: öfter mit frischer Partie ran.');
    add(bestFor('focus'), 'Breitere Zone, sauberere Sätze, mehr Reiz aus jedem Satz.');
    add(bestFor('energy'), 'Mehr Energie pro Tag — mehr Sätze, bevor Schluss ist.');

    return out.slice(0, max || 3);
  }

  /* Die wichtigste Empfehlung — der Rest steht in recommendations(). */
  function recommendation(worstKey) {
    var list = recommendations(worstKey, 1);
    return list.length ? list[0] : null;
  }

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
      var v = s.health[k];
      if (v >= HEALTH_WATCH) return;
      flags.push(HEALTH_LABELS[k] + (v < HEALTH_ALARM ? ' angeschlagen (' : ' im Sinkflug (')
        + Math.round(v) + ' von 100)'
        + (v < HEALTH_ALARM ? ' — schone dich.' : ' — jetzt gegensteuern, nicht später.'));
    });

    return {
      weakest3: ranked.slice(0, 3),
      componentAdvice: { name: worst.name, text: ADVICE[worst.key] || '' },
      healthFlags: flags,
      healthTip: healthTip(),
      shopTip: recommendation(worst.key),
      shopTips: recommendations(worst.key, 3)
    };
  }

  /* --- Die Ansprache am Eingang ------------------------------------------ */

  /* Wie viele Saetze das heutige Ziel ungefaehr kostet — als Anhaltspunkt,
     ob die Energie fuer den Plan reicht. */
  function planCost() {
    var plan = todayTargets();
    if (!plan || !plan.targets.length) return 0;
    var sum = 0;
    plan.targets.forEach(function (t) {
      var ex = MF.data.exercises.get(t.exercise);
      if (ex) sum += MF.game.training.energyCost(ex, 1);
    });
    return sum;
  }

  /* Der Trainer sagt am Eingang, was heute ansteht — dieselben Hinweise
     stehen im Koerper-Bildschirm. Ohne Trainer-Abo gibt es sie nicht:
     dafuer zahlt man schliesslich den Tagessatz.
     Gibt { hello, notes: [{ tone, text }], plan, analysis } oder null. */
  function briefing() {
    if (!MF.game.abos.trainerActive()) return null;
    var s = state();
    var a = analysis();
    var plan = todayTargets();
    var notes = [];

    /* 1. Was heute ansteht. */
    if (plan && plan.targets.length) {
      var names = [];
      plan.targets.forEach(function (t) {
        var ex = MF.data.exercises.get(t.exercise);
        var m = MF.data.muscles.get(t.muscle);
        if (ex && m) {
          names.push(m.name + ' (' + ex.name + ')'
            + (s.muscles[t.muscle].setsToday > 0 ? ' ✔' : ''));
        }
      });
      notes.push({ tone: 'good', text: 'Heute dran: ' + names.join(', ') + '.' });
    }

    /* 2. Gesundheit vor allem anderen. */
    if (a.healthTip) {
      notes.push({ tone: a.healthTip.urgent ? 'bad' : 'warn', text: a.healthTip.text });
    }

    /* 3. Zwangspausen — daran kommt heute niemand vorbei. */
    var hurt = [];
    MF.data.muscles.list.forEach(function (m) {
      var d = s.muscles[m.id].injuryDays;
      if (d > 0) hurt.push(m.name + ' (' + d + (d === 1 ? ' Tag' : ' Tage') + ')');
    });
    if (hurt.length) {
      notes.push({ tone: 'bad', text: 'Gezerrt und gesperrt: ' + hurt.join(', ')
        + '. Finger weg, das heilt nur mit Ruhe.' });
    }

    /* 4. Reicht die Energie fuer den Plan? */
    var cost = planCost();
    if (cost > 0) {
      notes.push({
        tone: s.energy >= cost ? 'flat' : 'warn',
        text: s.energy >= cost
          ? 'Für den Plan brauchst du ⚡ ' + cost + ', du hast ⚡ ' + Math.round(s.energy) + '.'
          : 'Der Plan kostet ⚡ ' + cost + ', du hast nur ⚡ ' + Math.round(s.energy)
            + '. Setz die erste Partie zuerst.'
      });
    }

    /* 5. Der Zettel vom Brett — er zahlt sofort. */
    var chal = MF.game.challenge.today();
    if (chal && !MF.game.challenge.isDone()) {
      notes.push({ tone: 'warn', text: 'Zettel am Brett: ' + chal.short + '.' });
    }

    /* 6. Die Serie haelt nur, wer heute etwas tut. */
    var st = MF.game.streak.status();
    if (st.days > 0 && !st.claimedToday) {
      notes.push({ tone: 'warn', text: 'Deine Serie steht bei ' + st.days
        + (st.days === 1 ? ' Tag' : ' Tagen') + ' — ein Satz heute, und sie bleibt.' });
    }

    /* 7. Zuletzt die groesste Baustelle am Index. */
    notes.push({ tone: 'flat', text: a.componentAdvice.name + ': ' + a.componentAdvice.text });

    var name = s.player.name || 'Sportsfreund';
    var hello;
    if (hurt.length) hello = 'Na, ' + name + '? Heute mit angezogener Handbremse.';
    else if (a.healthTip && a.healthTip.urgent) hello = name + ', wir müssen kurz reden.';
    else if (st.days >= 3) hello = name + ', ' + st.days + ' Tage in Folge — weiter so.';
    else hello = 'Moin, ' + name + '. Machen wir was draus.';

    return { hello: hello, notes: notes, plan: plan, analysis: a };
  }

  /* Eine frische Zerrung macht die Tagesziele ungueltig — die gezerrte
     Partie darf nicht weiter als Auftrag dastehen. */
  MF.core.events.on('muscle:injured', function () {
    var s = MF.game.state.get();
    if (s && s.coach) s.coach.todayPlan = null;
  });

  MF.game.coach = {
    HEALTH_WATCH: HEALTH_WATCH,
    HEALTH_ALARM: HEALTH_ALARM,
    splitToday: splitToday,
    bestExercise: bestExercise,
    healthTip: healthTip,
    todayTargets: todayTargets,
    isTargetMuscle: isTargetMuscle,
    isTargetExercise: isTargetExercise,
    evaluateDay: evaluateDay,
    recommendation: recommendation,
    recommendations: recommendations,
    analysis: analysis,
    planCost: planCost,
    briefing: briefing
  };
})(window.MacFit);
