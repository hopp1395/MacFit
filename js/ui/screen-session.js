/* Der Satz: Marker läuft, du tippst. Grün = saubere Wiederholung.
   Die gesamte untere Bildschirmhälfte ist die Tippfläche. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;

  var REP_TIMEOUT = 4.0;   /* Sekunden pro Wiederholung, dann gilt sie als verrissen */
  var LOCK_AFTER_TAP = 0.16;

  var ticker = null;
  var run = null;          /* laufender Satz */
  var scene = null;        /* Pixel-Szene mit Gerät und Figur */
  var nodes = {};
  var trackWidth = 0;

  function state() { return MF.game.state.get(); }

  function measure() {
    if (nodes.track) trackWidth = nodes.track.getBoundingClientRect().width;
  }

  /* --- Aufbau ------------------------------------------------------------ */

  function buildSetUi(container, ex, weight) {
    util.clear(container);

    var top = el('div.session__top');
    var back = el('button.session__close', { type: 'button', text: '✕', 'aria-label': 'Satz abbrechen' });
    util.onTap(back, abort);
    top.appendChild(back);
    top.appendChild(el('div.session__name', null, [
      el('strong', { text: ex.name }),
      el('span', { text: weight.name + ' · ' + MF.data.muscles.get(ex.muscle).name })
    ]));
    top.appendChild(el('div.session__rep', { id: 'session-rep', text: '' }));
    container.appendChild(top);

    container.appendChild(el('div.session__scores', null, [
      el('div.score', null, [
        el('span.score__value', { id: 'session-perfect', text: '0' }),
        el('span.score__label', { text: 'perfekt' })
      ]),
      el('div.score', null, [
        el('span.score__value', { id: 'session-form', text: '–' }),
        el('span.score__label', { text: 'Form' })
      ]),
      el('div.score', null, [
        el('span.score__value', { id: 'session-miss', text: '0' }),
        el('span.score__label', { text: 'verrissen' })
      ])
    ]));

    var track = el('div.track', { id: 'session-track' }, [
      el('div.track__ok', { id: 'session-ok' }),
      el('div.track__zone', { id: 'session-zone' }),
      el('div.track__marker', { id: 'session-marker' })
    ]);
    container.appendChild(track);

    container.appendChild(el('div.timer', null, [
      el('div.timer__fill', { id: 'session-timer' })
    ]));

    container.appendChild(el('div.session__feedback', { id: 'session-feedback', text: '' }));

    /* Die Szene ist zugleich die Tippfläche — Blick und Daumen bleiben zusammen. */
    var stage = el('div.stage', { id: 'session-stage' });
    var tap = el('button.taparea', { id: 'session-tap', type: 'button' }, [
      stage,
      el('span.taparea__hint', { text: 'Tippen, wenn der Marker in der grünen Zone ist' })
    ]);
    util.onTap(tap, onTap);
    container.appendChild(tap);

    scene = MF.ui.scene.mountSession(stage, ex.id);

    nodes = {
      rep: util.byId('session-rep'),
      perfect: util.byId('session-perfect'),
      form: util.byId('session-form'),
      miss: util.byId('session-miss'),
      track: track,
      ok: util.byId('session-ok'),
      zone: util.byId('session-zone'),
      marker: util.byId('session-marker'),
      timer: util.byId('session-timer'),
      feedback: util.byId('session-feedback'),
      tap: tap
    };

    measure();
  }

  /* --- Ablauf ------------------------------------------------------------ */

  function start(exerciseId, weightIndex, container) {
    var ex = MF.data.exercises.get(exerciseId);
    if (!ex) {
      MF.ui.router.go('gym');
      return;
    }

    var check = MF.game.training.canTrain(ex, weightIndex);
    if (!check.ok) {
      MF.ui.toast.show(check.reason, 'warn');
      MF.ui.router.go('gym');
      return;
    }

    MF.game.training.beginSet(ex, weightIndex);
    MF.ui.hud.render();

    run = {
      ex: ex,
      weightIndex: weightIndex,
      weight: MF.game.training.weightAt(weightIndex),
      repIndex: 0,
      hits: [],
      pos: 0.5,
      dir: 1,
      center: 0.5,
      zone: 0.3,
      repTime: 0,
      lock: 0,
      done: false
    };

    buildSetUi(container, ex, run.weight);
    nextRep();
    MF.core.audio.sfx('rack');   /* Gewicht aufgelegt */

    if (!ticker) ticker = MF.core.ticker.create(frame);
    ticker.start();
  }

  function nextRep() {
    if (!run) return;
    run.zone = MF.game.training.zoneWidth(run.ex, run.weightIndex, run.repIndex);
    /* Zonenmitte zufaellig, aber nicht direkt am Rand. */
    var margin = run.zone / 2 + 0.06;
    run.center = margin + Math.random() * (1 - margin * 2);
    run.repTime = 0;
    run.lock = LOCK_AFTER_TAP;

    var okWidth = Math.min(1, run.zone * 2.1);
    nodes.zone.style.left = ((run.center - run.zone / 2) * 100).toFixed(2) + '%';
    nodes.zone.style.width = (run.zone * 100).toFixed(2) + '%';
    nodes.ok.style.left = ((run.center - okWidth / 2) * 100).toFixed(2) + '%';
    nodes.ok.style.width = (okWidth * 100).toFixed(2) + '%';

    nodes.rep.textContent = 'Rep ' + (run.repIndex + 1) + '/' + run.ex.reps;
  }

  function frame(dt) {
    if (!run || run.done) return;

    var speed = MF.game.training.markerSpeed(run.ex, run.weightIndex, run.repIndex);
    run.pos += run.dir * speed * dt;
    if (run.pos >= 1) { run.pos = 1; run.dir = -1; }
    if (run.pos <= 0) { run.pos = 0; run.dir = 1; }

    if (run.lock > 0) run.lock -= dt;

    run.repTime += dt;
    var left = util.clamp(1 - run.repTime / REP_TIMEOUT, 0, 1);
    nodes.timer.style.width = (left * 100).toFixed(1) + '%';
    nodes.timer.classList.toggle('is-low', left < 0.3);

    if (run.repTime >= REP_TIMEOUT) {
      register('miss', 'ZU LANGSAM');
      return;
    }

    if (!trackWidth) measure();
    nodes.marker.style.transform = 'translate3d(' + (run.pos * trackWidth).toFixed(1) + 'px,0,0)';

    /* Die Figur folgt dem Marker: rechts = Gewicht runter, links = drücken. */
    if (scene) scene.update(run.pos, dt);
  }

  function onTap() {
    if (!run || run.done || run.lock > 0) return;

    var dist = Math.abs(run.pos - run.center);
    if (dist <= run.zone / 2) {
      register('perfect', 'PERFEKT');
    } else if (dist <= run.zone * 1.05) {
      register('ok', 'OKAY');
    } else {
      register('miss', 'VERRISSEN');
    }
  }

  function register(kind, label) {
    run.hits.push(kind);
    run.lock = LOCK_AFTER_TAP;

    MF.core.haptics.buzz(kind === 'perfect' ? 'perfect' : (kind === 'ok' ? 'ok' : 'miss'));
    MF.core.audio.sfx(kind);

    nodes.feedback.textContent = label;
    nodes.feedback.className = 'session__feedback is-shown is-' + kind;
    window.setTimeout(function () {
      if (nodes.feedback) nodes.feedback.classList.remove('is-shown');
    }, 380);

    nodes.track.classList.remove('is-perfect', 'is-ok', 'is-miss');
    void nodes.track.getBoundingClientRect();
    nodes.track.classList.add('is-' + kind);

    if (scene) scene.flash(kind);

    updateScores();

    run.repIndex += 1;
    if (run.repIndex >= run.ex.reps) finish();
    else nextRep();
  }

  function updateScores() {
    var perfect = 0, miss = 0, ok = 0;
    run.hits.forEach(function (h) {
      if (h === 'perfect') perfect++;
      else if (h === 'ok') ok++;
      else miss++;
    });
    nodes.perfect.textContent = perfect;
    nodes.miss.textContent = miss;
    var form = (perfect + ok * 0.5) / Math.max(1, run.hits.length);
    nodes.form.textContent = Math.round(form * 100) + '%';
  }

  function finish() {
    run.done = true;
    if (ticker) ticker.stop();

    var result = MF.game.training.finishSet(run.ex, run.weightIndex, run.hits);
    /* Beim Aufstieg spielt gleich die laengere Fanfare aus dem Modal — zwei
       Melodien uebereinander waeren Krach. */
    if (!result.levelUp) MF.core.audio.sfx('done');
    showResult(result);
  }

  /* Abbruch: gezaehlte Reps werden gewertet, die Energie ist ohnehin weg. */
  function abort() {
    if (!run || run.done) {
      MF.ui.router.go('gym');
      return;
    }
    run.done = true;
    if (ticker) ticker.stop();

    if (run.hits.length === 0) {
      MF.ui.toast.show('Satz abgebrochen.', 'warn');
      MF.ui.router.go('gym');
      return;
    }
    var result = MF.game.training.finishSet(run.ex, run.weightIndex, run.hits);
    showResult(result);
  }

  function showResult(result) {
    var container = util.byId('screen-session');
    util.clear(container);
    scene = null;

    var s = state();
    var panel = el('div.result');
    panel.appendChild(el('div.result__icon', { text: result.exercise.icon }));
    panel.appendChild(el('h2.result__grade.is-' + result.grade.tone, { text: result.grade.text }));
    panel.appendChild(el('div.result__form', { text: Math.round(result.formScore * 100) + '% Form' }));

    panel.appendChild(el('div.result__rows', null, [
      row('Perfekt', result.perfect + ' / ' + result.reps),
      row('Verrissen', String(result.miss)),
      row('Reiz auf ' + MF.data.muscles.get(result.exercise.muscle).name,
          '+' + util.formatNum(result.stimulus, 1)),
      row('Erfahrung', '+' + result.xp + ' XP')
    ]));

    if (result.levelUp) {
      panel.appendChild(el('div.result__levelup', {
        text: 'Level ' + result.levelUp.level + ': ' + result.levelUp.title
      }));
    }

    var nextWeight = MF.ui.gym.weight();
    var again = MF.game.training.canTrain(result.exercise, nextWeight);
    var actions = el('div.result__actions');

    var againBtn = el('button.btn.btn--primary', {
      type: 'button',
      text: again.ok ? 'Noch ein Satz' : again.reason
    });
    if (!again.ok) againBtn.classList.add('is-disabled');
    util.onTap(againBtn, function () {
      if (!again.ok) return;
      MF.ui.router.go('session', {
        exerciseId: result.exercise.id,
        weightIndex: nextWeight
      });
    });
    actions.appendChild(againBtn);

    var backBtn = el('button.btn.btn--ghost', { type: 'button', text: 'Zurück ins Gym' });
    util.onTap(backBtn, function () { MF.ui.router.go('gym'); });
    actions.appendChild(backBtn);

    panel.appendChild(actions);
    container.appendChild(panel);

    MF.ui.hud.render();

    if (result.levelUp) MF.ui.report.showLevelUp(result.levelUp);
    else if (s.energy <= 0) MF.ui.toast.show('Energie leer — Zeit zu schlafen.', 'warn');
  }

  function row(label, value) {
    return el('div.result__row', null, [
      el('span', { text: label }),
      el('strong', { text: value })
    ]);
  }

  function render(container, params) {
    if (params && params.exerciseId) {
      start(params.exerciseId, params.weightIndex === undefined ? 1 : params.weightIndex, container);
    } else if (!run || run.done) {
      MF.ui.router.go('gym');
    }
  }

  function leave() {
    if (ticker) ticker.stop();
    run = null;
    scene = null;
  }

  window.addEventListener('resize', measure);

  MF.ui.router.register('session', {
    elementId: 'screen-session',
    render: render,
    leave: leave
  });
})(window.MacFit);
