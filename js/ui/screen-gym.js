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

  /* Das Tagesziel stand hier fruher als eigenes Banner ueber dem Raster —
     zusammen mit Halle, Kacheln, Geraeteliste und Fussleiste war der
     Bildschirm damit voll. Die Ziele stehen jetzt in der Ansage des Trainers
     am Eingang und im Koerper-Bildschirm; im Gym bleiben nur die stillen
     Markierungen: die Ziel-Kachel traegt is-planned, die Ziel-Uebung ein
     kleines Schild in der Zeile. */

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

      var hurt = data.injuryDays > 0;
      var tile = el('button.mtile' + (filterId() === m.id ? '.is-active' : ''), { type: 'button' }, [
        el('span.mtile__name', { text: (hurt ? '🤕 ' : '') + m.name }),
        el('span.mtile__sub', {
          text: hurt
            ? 'gezerrt · ' + data.injuryDays + (data.injuryDays === 1 ? ' Tag' : ' Tage')
            : available + ' Gerät' + (available === 1 ? '' : 'e')
        }),
        el('span.mtile__bar', null, [
          el('i', { style: 'width:' + (data.fatigue * 100).toFixed(0) + '%' })
        ])
      ]);

      if (hurt) tile.classList.add('is-hurt');
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

  /* Was eine Kondition-Einheit bringt, in einer Zeile: "+3 Herz, +1 Laune". */
  var HEALTH_NAMES = { herz: 'Herz', leber: 'Leber', schlaf: 'Schlaf', laune: 'Laune' };

  function healthSummary(ex) {
    var parts = [];
    Object.keys(HEALTH_NAMES).forEach(function (k) {
      var v = ex.health && ex.health[k];
      if (v > 0) parts.push('+' + util.formatNum(v, 1) + ' ' + HEALTH_NAMES[k]);
    });
    if (ex.recovery) parts.push('−Ermüdung');
    return parts.join(', ');
  }

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
    /* Kondition sieht man der Zeile an — sie kostet Energie und bringt
       kaum Reiz, dafuer Gesundheit. Ohne Hinweis waere sie nur schlecht. */
    if (unlocked && ex.kind === 'kondition') {
      bodyKids.push(el('span.tag.tag--health.exrow__tag', { text: '❤️ Kondition' }));
    }
    bodyKids.push(el('span.exrow__meta', {
      text: unlocked
        ? '⚡ ' + cost + ' · ' + ex.reps + ' Reps'
          + (ex.kind === 'kondition' ? ' · ' + healthSummary(ex) : '')
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

  /* ---------- Feierabend: erst der Tag, dann die Tuer -------------------- */

  function sumRow(label, value, tone) {
    return el('div.report__row', null, [
      el('span.report__label', { text: label }),
      el('strong.report__value.is-' + (tone || 'flat'), { text: value })
    ]);
  }

  /* Was der Tag gebracht hat — steht vor dem Schlafen, damit man noch
     umkehren kann, wenn etwas offen ist (Zettel, Tagesziel, Energie). */
  function summaryBody() {
    var s = state();
    var sets = MF.game.day.setsToday();
    var tally = MF.game.training.todayTally();
    var body = el('div.report');

    var block = el('div.report__block', null, [
      sumRow('Sätze', String(sets), sets > 0 ? 'good' : 'warn'),
      sumRow('Wiederholungen', tally.reps
        ? tally.reps + ' (' + Math.round(tally.perfect / tally.reps * 100) + ' % perfekt)'
        : '0'),
      sumRow('Erfahrung', '+' + util.formatNum(tally.xp) + ' XP', tally.xp ? 'good' : 'flat'),
      sumRow('Energie übrig', Math.round(s.energy) + ' von ' + MF.game.stats.energyMax(),
             s.energy > MF.game.stats.energyMax() * 0.25 ? 'warn' : 'flat')
    ]);
    body.appendChild(block);

    /* Welche Partien heute dran waren — mit dem, was nachts daraus wird. */
    var trained = MF.data.muscles.list.filter(function (m) {
      return s.muscles[m.id].setsToday > 0;
    });
    if (trained.length) {
      body.appendChild(el('div.report__title', { text: 'Heute trainiert' }));
      var tblock = el('div.report__block');
      var ceiling = MF.game.stats.sizeCeiling();
      var growth = MF.game.stats.growthMultiplier();
      trained.forEach(function (def) {
        var m = s.muscles[def.id];
        var gain = MF.game.day.nightGain(def, m, ceiling, growth);
        tblock.appendChild(sumRow(def.name,
          m.setsToday + (m.setsToday === 1 ? ' Satz' : ' Sätze')
            + ' · +' + util.formatNum(gain, 2) + ' kg über Nacht',
          'good'));
      });
      body.appendChild(tblock);
    } else {
      body.appendChild(el('p.report__empty', {
        text: 'Kein einziger Satz heute — ohne Reiz wächst über Nacht nichts.'
      }));
    }

    /* Offene Posten: Tagesziel, Zettel, Serie. */
    var open = el('div.report__block');
    var plan = MF.game.coach.todayTargets();
    if (plan && plan.targets.length) {
      var done = 0;
      plan.targets.forEach(function (t) {
        if (s.muscles[t.muscle].setsToday > 0) done += 1;
      });
      open.appendChild(sumRow('Tagesziel (' + plan.title + ')',
        done + ' von ' + plan.targets.length,
        done >= plan.targets.length ? 'good' : (done ? 'warn' : 'bad')));
    }

    var chal = MF.game.challenge.today();
    if (chal) {
      var chalDone = MF.game.challenge.isDone();
      open.appendChild(sumRow('📌 ' + chal.short,
        chalDone ? 'erfüllt ✔' : 'noch offen',
        chalDone ? 'good' : 'warn'));
    }

    var st = MF.game.streak.status();
    open.appendChild(sumRow('🔥 Serie',
      st.claimedToday
        ? st.days + (st.days === 1 ? ' Tag' : ' Tage') + ' — heute gesichert'
        : 'heute noch nicht gesichert',
      st.claimedToday ? 'good' : 'warn'));
    body.appendChild(open);

    /* Energie verfaellt ueber Nacht — wer viel uebrig hat, verschenkt sie. */
    if (s.energy > MF.game.stats.energyMax() * 0.25) {
      body.appendChild(el('p.hint', {
        text: 'Ein guter Teil deiner Energie ist noch übrig — sie verfällt heute Nacht. '
            + 'Ein Satz mehr geht locker.'
      }));
    }

    var hurt = MF.data.muscles.list.filter(function (m) {
      return s.muscles[m.id].injuryDays > 0;
    });
    if (hurt.length) {
      body.appendChild(el('div.report__warning', {
        text: 'Gezerrt: ' + hurt.map(function (m) {
          var d = s.muscles[m.id].injuryDays;
          return m.name + ' (noch ' + d + (d === 1 ? ' Tag' : ' Tage') + ')';
        }).join(', ') + '.'
      }));
    }

    return body;
  }

  /* Der eigentliche Feierabend: Tag abschliessen, Film, Report. */
  function goHome() {
    MF.core.haptics.buzz('sleep');
    MF.core.audio.sfx('sleep');
    /* Erst den Tag abschließen, dann den Feierabend zeigen: der Report muss
       die Werte der Nacht kennen, wenn der Film durch ist. */
    var report = MF.game.day.sleep();
    MF.ui.intro.playLeave(function () { MF.ui.report.show(report); });
  }

  function askLeave() {
    MF.ui.modal.open({
      title: 'Feierabend — Tag ' + state().day,
      subtitle: 'Das ist heute zusammengekommen.',
      body: summaryBody(),
      actions: [
        { label: '🛌 Schlafen gehen', tone: 'primary', onTap: goHome },
        { label: 'Noch bleiben' }
      ]
    });
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
    util.onTap(btn, askLeave);
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

    container.appendChild(muscleGrid());

    container.appendChild(el('div.exhead', null, [
      el('span.exhead__title', { text: muscle.name }),
      el('span.exhead__note' + (data.injuryDays > 0 ? '.is-bad' : ''), {
        text: data.injuryDays > 0
          ? '🤕 gezerrt — noch ' + data.injuryDays + (data.injuryDays === 1 ? ' Tag' : ' Tage')
          : 'Ermüdung ' + Math.round(data.fatigue * 100) + '%'
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
