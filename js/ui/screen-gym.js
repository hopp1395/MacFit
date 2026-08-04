/* Gym: alles auf einen Bildschirm, ohne Scrollen.

   Aufbau von oben nach unten — Muskelgruppe wählen, Gerät antippen, fertig.
   Antippen einer Gerätezeile startet den Satz direkt; der Umweg über eine
   Karte mit eigenem Knopf entfällt. Nur die Geräteliste darf im Notfall
   scrollen, damit Auswahl und Schlafen-Knopf immer sichtbar bleiben. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;

  function state() { return MF.game.state.get(); }

  /* Auswahl und Intensität gehören in den Spielstand — sonst steht man nach
     dem Neuladen wieder bei Brust und "Normal". */
  function filterId() { return state().settings.muscle || 'brust'; }
  function weightIdx() {
    var w = state().settings.weight;
    return typeof w === 'number' ? w : 1;
  }
  function remember(key, value) {
    state().settings[key] = value;
    MF.game.state.saveSoon();
  }

  /* Schwierigkeit als Punkte — grob aus Tempo und Zonenbreite. */
  function difficultyDots(ex) {
    var score = (ex.speed / 1.05) * 0.6 + (1 - ex.zone / 0.30) * 0.4;
    var count = util.clamp(Math.round(score * 5), 1, 5);
    var wrap = el('span.dots');
    for (var i = 0; i < 5; i++) {
      wrap.appendChild(el('span.dot' + (i < count ? '.is-on' : '')));
    }
    return wrap;
  }

  /* ---------- Tagesziel aus Trainingsplan oder Trainer -------------------- */

  function planBanner() {
    var plan = MF.game.coach.todayTargets();
    if (!plan || !plan.targets.length) return null;

    var s = state();
    var head = plan.source === 'trainer'
      ? '🎯 Trainer: ' + plan.title
      : '📋 ' + plan.title;

    var bar = el('div.planbar');
    bar.appendChild(el('span.planbar__title', { text: head }));

    plan.targets.forEach(function (t) {
      var ex = MF.data.exercises.get(t.exercise);
      var m = MF.data.muscles.get(t.muscle);
      if (!ex || !m) return;
      var done = s.muscles[t.muscle].setsToday > 0;
      var chip = el('button.planbar__chip' + (done ? '.is-done' : ''), {
        type: 'button',
        text: (done ? '✔ ' : '') + ex.icon + ' ' + m.name
      });
      util.onTap(chip, function () {
        remember('muscle', t.muscle);
        MF.ui.router.refresh('gym');
      });
      bar.appendChild(chip);
    });

    return bar;
  }

  /* ---------- Muskelgruppen als Kachelraster ------------------------------ */

  function muscleGrid() {
    var s = state();
    var weakest = MF.game.stats.weakestMuscle();
    var grid = el('div.mgrid');

    MF.data.muscles.list.forEach(function (m) {
      var data = s.muscles[m.id];
      var available = MF.data.exercises.byMuscle(m.id).filter(function (ex) {
        return MF.game.training.isUnlocked(ex);
      }).length;

      var tile = el('button.mtile' + (filterId() === m.id ? '.is-active' : ''), { type: 'button' }, [
        el('span.mtile__name', { text: m.name }),
        el('span.mtile__sub', { text: available + ' Gerät' + (available === 1 ? '' : 'e') }),
        el('span.mtile__bar', null, [
          el('i', { style: 'width:' + (data.fatigue * 100).toFixed(0) + '%' })
        ])
      ]);

      if (m.id === weakest.id) tile.classList.add('is-weak');
      if (MF.game.coach.isTargetMuscle(m.id)) tile.classList.add('is-planned');

      util.onTap(tile, function () {
        remember('muscle', m.id);
        MF.ui.router.refresh('gym');
      });
      grid.appendChild(tile);
    });

    return grid;
  }

  /* ---------- Geräte der gewählten Partie --------------------------------- */

  function exerciseRow(ex) {
    var s = state();
    var unlocked = MF.game.training.isUnlocked(ex);
    var check = MF.game.training.canTrain(ex, weightIdx());
    var cost = MF.game.training.energyCost(ex, weightIdx());

    var row = el('button.exrow', { type: 'button' });
    if (!unlocked) row.classList.add('is-locked');
    else if (!check.ok) row.classList.add('is-blocked');

    row.appendChild(el('span.exrow__icon', { text: ex.icon }));
    var bodyKids = [el('span.exrow__name', { text: ex.name })];
    if (unlocked && MF.game.coach.isTargetExercise(ex.id)) {
      var plan = MF.game.coach.todayTargets();
      bodyKids.push(el('span.tag.tag--good.exrow__tag', {
        text: plan && plan.source === 'trainer' ? 'Trainer-Tipp' : 'Plan'
      }));
    }
    bodyKids.push(el('span.exrow__meta', {
      text: unlocked
        ? '⚡ ' + cost + ' · ' + ex.reps + ' Reps'
        : 'gesperrt'
    }));
    row.appendChild(el('span.exrow__body', null, bodyKids));

    if (unlocked) {
      row.appendChild(difficultyDots(ex));
      row.appendChild(el('span.exrow__go', { text: '▶' }));
    } else {
      row.appendChild(el('span.exrow__lock', { text: 'Lv ' + ex.unlockLevel }));
    }

    util.onTap(row, function () {
      if (!unlocked) {
        MF.ui.toast.show(ex.name + ' gibt es ab Level ' + ex.unlockLevel + '.', 'warn');
        return;
      }
      if (!check.ok) {
        MF.ui.toast.show(check.reason, 'warn');
        return;
      }
      MF.ui.router.go('session', { exerciseId: ex.id, weightIndex: weightIdx() });
    });

    return row;
  }

  function exerciseList() {
    var list = MF.data.exercises.byMuscle(filterId()).slice();
    list.sort(function (a, b) {
      var ua = MF.game.training.isUnlocked(a) ? 0 : 1;
      var ub = MF.game.training.isUnlocked(b) ? 0 : 1;
      if (ua !== ub) return ua - ub;
      return a.unlockLevel - b.unlockLevel;
    });

    var wrap = el('div.exlist');
    list.forEach(function (ex) { wrap.appendChild(exerciseRow(ex)); });
    return wrap;
  }

  /* ---------- Intensität und Tagesabschluss ------------------------------- */

  function intensityControl() {
    var wrap = el('div.segmented.segmented--compact', { id: 'gym-intensity' });
    MF.game.training.WEIGHTS.forEach(function (w, i) {
      var btn = el('button.segmented__btn' + (i === weightIdx() ? '.is-active' : ''), {
        type: 'button', text: w.name
      });
      util.onTap(btn, function () {
        remember('weight', i);
        MF.ui.router.refresh('gym');
      });
      wrap.appendChild(btn);
    });
    return wrap;
  }

  function footer() {
    var s = state();
    var sets = MF.game.day.setsToday();
    var ratio = s.energy / MF.game.stats.energyMax();

    var bar = el('div.gymfoot' + (ratio < 0.2 ? '.gymfoot--urgent' : ''));
    bar.appendChild(el('div.gymfoot__info', null, [
      el('strong', { text: 'Tag ' + s.day }),
      el('span', {
        text: sets === 0 ? 'noch kein Satz' : sets + ' Sätze heute'
      })
    ]));

    var btn = el('button.btn.btn--sleep.btn--slim', { type: 'button', text: '🛌 Schlafen' });
    util.onTap(btn, function () {
      MF.core.haptics.buzz('sleep');
      MF.core.audio.sfx('sleep');
      /* Erst den Tag abschließen, dann den Feierabend zeigen: der Report muss
         die Werte der Nacht kennen, wenn der Film durch ist. */
      var report = MF.game.day.sleep();
      MF.ui.intro.playLeave(function () { MF.ui.report.show(report); });
    });
    bar.appendChild(btn);
    return bar;
  }

  /* ---------- Aufbau ------------------------------------------------------ */

  function render(container) {
    util.clear(container);
    var muscle = MF.data.muscles.get(filterId());
    var data = state().muscles[filterId()];

    /* Blick in die Halle — nur wenn genug Platz da ist. Auf kurzen Displays
       hat die Geräteauswahl Vorrang; dann wird auch nichts gezeichnet. */
    MF.ui.scene.stopAmbient();
    if (window.innerHeight >= 700) {
      var hall = el('div.hall');
      container.appendChild(hall);
      MF.ui.scene.mountAmbient(hall);
    }

    var banner = planBanner();
    if (banner) container.appendChild(banner);

    container.appendChild(muscleGrid());

    container.appendChild(el('div.exhead', null, [
      el('span.exhead__title', { text: muscle.name }),
      el('span.exhead__note', {
        text: 'Ermüdung ' + Math.round(data.fatigue * 100) + '%'
      })
    ]));

    container.appendChild(exerciseList());
    container.appendChild(intensityControl());
    container.appendChild(footer());
  }

  MF.ui.router.register('gym', {
    elementId: 'screen-gym',
    render: render,
    /* Beim Verlassen die Animation anhalten — sonst läuft sie unsichtbar weiter. */
    leave: function () { MF.ui.scene.stopAmbient(); }
  });

  /* Der Satz-Screen braucht die zuletzt gewählte Intensität. */
  MF.ui.gym = { weight: weightIdx };
})(window.MacFit);
