/* Gym: Muskelgruppe wählen, Gerät wählen, Satz starten. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;

  var filter = 'alle';
  var weightIndex = 1;

  function state() { return MF.game.state.get(); }

  /* Schwierigkeit als Punkte — grob aus Tempo und Zonenbreite. */
  function difficultyDots(ex) {
    var score = (ex.speed / 1.05) * 0.6 + (1 - ex.zone / 0.30) * 0.4;
    var count = util.clamp(Math.round(score * 5), 1, 5);
    var wrap = el('div.dots');
    for (var i = 0; i < 5; i++) {
      wrap.appendChild(el('span.dot' + (i < count ? '.is-on' : '')));
    }
    return wrap;
  }

  function intensityControl() {
    var wrap = el('div.segmented', { id: 'gym-intensity' });
    MF.game.training.WEIGHTS.forEach(function (w, i) {
      var btn = el('button.segmented__btn' + (i === weightIndex ? '.is-active' : ''), {
        type: 'button', text: w.name
      });
      util.onTap(btn, function () {
        weightIndex = i;
        MF.ui.router.refresh('gym');
      });
      wrap.appendChild(btn);
    });
    return wrap;
  }

  function muscleFilter() {
    var row = el('div.chips');

    var all = el('button.chip' + (filter === 'alle' ? '.is-active' : ''), {
      type: 'button', text: 'Alle'
    });
    util.onTap(all, function () { filter = 'alle'; MF.ui.router.refresh('gym'); });
    row.appendChild(all);

    MF.data.muscles.list.forEach(function (m) {
      var data = state().muscles[m.id];
      var chip = el('button.chip' + (filter === m.id ? '.is-active' : ''), { type: 'button' }, [
        el('span', { text: m.name }),
        el('span.chip__fatigue', null, [
          el('i', { style: 'width:' + (data.fatigue * 100).toFixed(0) + '%' })
        ])
      ]);
      util.onTap(chip, function () { filter = m.id; MF.ui.router.refresh('gym'); });
      row.appendChild(chip);
    });

    return row;
  }

  function exerciseCard(ex) {
    var s = state();
    var muscle = MF.data.muscles.get(ex.muscle);
    var data = s.muscles[ex.muscle];
    var unlocked = MF.game.training.isUnlocked(ex);
    var check = MF.game.training.canTrain(ex, weightIndex);
    var cost = MF.game.training.energyCost(ex, weightIndex);

    var card = el('article.card' + (unlocked ? '' : '.card--locked'));

    var head = el('div.card__head', null, [
      el('div.card__icon', { text: ex.icon }),
      el('div.card__titles', null, [
        el('h3.card__title', { text: ex.name }),
        el('div.card__muscle', { text: muscle.name })
      ]),
      unlocked ? difficultyDots(ex) : el('div.card__lock', { text: 'Lv ' + ex.unlockLevel })
    ]);
    card.appendChild(head);

    if (unlocked) {
      card.appendChild(el('p.card__desc', { text: ex.desc }));

      card.appendChild(el('div.card__meta', null, [
        el('span.tag', { text: '⚡ ' + cost }),
        el('span.tag', { text: '↻ ' + ex.reps + ' Reps' }),
        el('span.tag', { text: '💪 ' + Math.round(ex.stimulus * MF.game.training.weightAt(weightIndex).stim) + ' Reiz' })
      ]));

      var fatiguePct = Math.round(data.fatigue * 100);
      card.appendChild(el('div.card__fatigue', null, [
        el('span.card__fatigue-label', { text: 'Ermüdung ' + muscle.name + ': ' + fatiguePct + '%' }),
        el('div.bar.bar--fatigue', null, [
          el('div.bar__fill', { style: 'width:' + fatiguePct + '%' })
        ])
      ]));

      var btn = el('button.btn.btn--primary.card__action', {
        type: 'button',
        text: check.ok ? 'Satz starten' : check.reason
      });
      if (!check.ok) btn.classList.add('is-disabled');
      util.onTap(btn, function () {
        if (!check.ok) {
          MF.ui.toast.show(check.reason, 'warn');
          return;
        }
        MF.ui.router.go('session', { exerciseId: ex.id, weightIndex: weightIndex });
      });
      card.appendChild(btn);
    } else {
      card.appendChild(el('p.card__desc', {
        text: 'Wird ab Level ' + ex.unlockLevel + ' freigeschaltet.'
      }));
    }

    return card;
  }

  function sleepPanel() {
    var s = state();
    var sets = MF.game.day.setsToday();
    var ratio = s.energy / MF.game.stats.energyMax();

    var panel = el('section.sleep' + (ratio < 0.2 ? '.sleep--urgent' : ''));
    panel.appendChild(el('div.sleep__info', null, [
      el('strong', { text: 'Tag ' + s.day + ' beenden' }),
      el('span', {
        text: sets === 0
          ? 'Heute noch kein Satz — ohne Reiz kein Wachstum.'
          : sets + ' Sätze trainiert. Gewachsen wird im Schlaf.'
      })
    ]));

    var btn = el('button.btn.btn--sleep', { type: 'button', text: '🛌 Schlafen' });
    util.onTap(btn, function () {
      MF.core.haptics.buzz('sleep');
      var report = MF.game.day.sleep();
      MF.ui.report.show(report);
    });
    panel.appendChild(btn);
    return panel;
  }

  function render(container) {
    util.clear(container);

    container.appendChild(el('div.section-title', { text: 'Intensität' }));
    container.appendChild(intensityControl());
    container.appendChild(el('p.hint', {
      text: MF.game.training.weightAt(weightIndex).name === 'Brutal'
        ? 'Maximaler Reiz — der Marker rast und die Zone ist winzig.'
        : 'Mehr Gewicht bringt mehr Reiz, macht das Timing aber schwerer.'
    }));

    container.appendChild(el('div.section-title', { text: 'Muskelgruppe' }));
    container.appendChild(muscleFilter());

    var list = MF.data.exercises.list.filter(function (ex) {
      return filter === 'alle' || ex.muscle === filter;
    });

    /* Freigeschaltetes zuerst, danach die Vorschau auf spaeteres. */
    list.sort(function (a, b) {
      var ua = MF.game.training.isUnlocked(a) ? 0 : 1;
      var ub = MF.game.training.isUnlocked(b) ? 0 : 1;
      if (ua !== ub) return ua - ub;
      return a.unlockLevel - b.unlockLevel;
    });

    var grid = el('div.grid');
    list.forEach(function (ex) { grid.appendChild(exerciseCard(ex)); });
    container.appendChild(grid);

    container.appendChild(sleepPanel());
  }

  MF.ui.router.register('gym', { elementId: 'screen-gym', render: render });

  /* Der Satz-Screen braucht die zuletzt gewaehlte Intensitaet. */
  MF.ui.gym = { weight: function () { return weightIndex; } };
})(window.MacFit);
