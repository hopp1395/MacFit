/* Die Wettkampfbühne. Ein Bildschirm, vier Schritte:

     anmeldung   Klasse wählen — hier greift die Dopingkontrolle
     posen       drei Posen aus den freigeschalteten aussuchen
     buehne      jede Pose halten: Marker in die Zone tippen, drei Versuche
     ergebnis    Wertung, Rangliste, Preisgeld

   Das Halten der Pose benutzt dieselbe Mechanik wie ein Satz (Marker,
   Zone, Tippen), aber nicht denselben Code: im Satz hängt alles an Gerät,
   Gewicht und Ermüdung, hier an der Pose. Die Zone wird von Pose zu Pose
   enger — die Kür soll gegen Ende wirklich etwas kosten. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;
  var px = MF.ui.pixel;
  var C = px.colors;

  var SCENE = 180;
  var HOLDS = 3;             /* Versuche je Pose */
  var HOLD_TIMEOUT = 3.4;    /* Sekunden je Versuch */
  var LOCK_AFTER_TAP = 0.16;

  var ticker = null;
  var run = null;            /* laufende Kür */
  var nodes = {};
  var trackWidth = 0;
  var step = 'anmeldung';
  var chosen = [];           /* gewählte Posen-IDs */
  var klasse = null;

  function state() { return MF.game.state.get(); }
  function data() { return MF.data.contest; }

  function measure() {
    if (nodes.track) trackWidth = nodes.track.getBoundingClientRect().width;
  }

  /* ---------- Bühnenbild ---------------------------------------------------- */

  function backdrop(ctx) {
    var horizon = 128;
    px.rect(ctx, 0, 0, SCENE, horizon, C.wallDark);
    for (var x = 0; x < SCENE; x += 26) px.line(ctx, x, 0, x, horizon, 1, C.wall);
    px.dither(ctx, 30, 0, 120, horizon, C.wall, 3);
    px.dither(ctx, 52, 0, 76, horizon, C.wallLit, 4);
    px.rect(ctx, 0, horizon, SCENE, 2, C.ink);
    px.rect(ctx, 0, horizon + 2, SCENE, SCENE - horizon - 2, C.floorDark);
    px.dither(ctx, 0, horizon + 2, SCENE, SCENE - horizon - 2, C.floor, 3);
  }

  /* Die eigene Figur in der gewählten Pose — der eigene Körper, keine
     Ableitung: auf der Bühne steht, was trainiert wurde. */
  function poseStage(poseId, cls) {
    var stage = el('div.rival__stage' + (cls ? '.' + cls : ''));
    var surface = px.create(stage, SCENE, SCENE, 'rival__pix');
    if (!surface.ctx) return stage;
    backdrop(surface.ctx);
    MF.ui.poses.draw(surface.ctx, poseId, {
      shorts: MF.data.outfits.get(state().player.outfit).shirt
    });
    surface.present();
    return stage;
  }

  /* ---------- Schritt 1: Anmeldung ------------------------------------------ */

  function classCard(def) {
    var check = MF.game.contest.canEnter(def);
    var s = state();
    var blocked = def.naturalOnly && !s.stats.natural;

    var card = el('article.card.card--shop' + (blocked ? '.card--locked' : ''));
    card.appendChild(el('div.card__head', null, [
      el('div.card__icon', { text: def.icon }),
      el('div.card__titles', null, [
        el('h3.card__title', { text: def.name }),
        el('div.card__muscle', {
          text: 'Preisgeld ' + util.formatMoney(def.purse[0]) + ' · '
              + def.purse.length + ' bezahlte Plätze'
        })
      ]),
      el('div.card__price' + (MF.game.economy.canAfford(def.fee) ? '' : '.is-bad'), {
        text: util.formatMoney(def.fee)
      })
    ]));
    card.appendChild(el('p.card__desc', { text: def.desc }));

    if (blocked) {
      card.appendChild(el('p.card__warning', {
        text: '⚠ Die Kontrolle am Eingang schlägt an. Für diesen Spielstand ist '
            + 'die Natural-Klasse zu — es bleibt die offene.'
      }));
      return card;
    }

    var btn = el('button.btn.btn--primary.card__action', {
      type: 'button',
      text: check.ok ? 'Starten für ' + util.formatMoney(def.fee) : check.reason
    });
    if (!check.ok) btn.classList.add('is-disabled');
    util.onTap(btn, function () {
      if (!check.ok) { MF.ui.toast.show(check.reason, 'warn'); return; }
      klasse = def;
      step = 'posen';
      chosen = [];
      MF.ui.router.refresh('contest');
    });
    card.appendChild(btn);
    return card;
  }

  function fieldPreview(def) {
    var box = el('div.grid');
    MF.game.contest.opponents(def).forEach(function (o) {
      box.appendChild(el('div.savebox' + (o.rival ? '.is-rival' : ''), null, [
        el('div.savebox__head', null, [
          el('strong', { text: (o.rival ? '★ ' : '') + o.name }),
          el('span.savebox__price', { text: o.gym })
        ])
      ]));
    });
    return box;
  }

  function renderAnmeldung(container) {
    var s = state();

    container.appendChild(el('div.section-title', null, [
      el('span', { text: '🏆 Meisterschaft' }),
      el('span.section-title__note', { text: 'Tag ' + s.day })
    ]));

    if (MF.game.contest.doneToday()) {
      container.appendChild(el('p.hint', {
        text: 'Für heute ist die Bühne durch. Die nächste Meisterschaft steigt an Tag '
            + MF.game.contest.nextDay() + '.'
      }));
      container.appendChild(backButton());
      return;
    }

    container.appendChild(el('p.hint', {
      text: 'Drei Posen, eine Wertung: Masse, Posenwahl, Symmetrie und Ausführung. '
          + 'Das Startgeld ist weg, egal wie es ausgeht.'
    }));

    var grid = el('div.grid');
    data().classes.forEach(function (def) { grid.appendChild(classCard(def)); });
    container.appendChild(grid);

    /* Gezeigt wird das Feld der Klasse, in der man antreten darf — jede
       Klasse hat ihr eigenes. */
    var shown = s.stats.natural ? data().classes[0] : data().classes[1];
    container.appendChild(el('div.section-title', null, [
      el('span', { text: 'Gemeldetes Feld' }),
      el('span.section-title__note', { text: shown.name })
    ]));
    container.appendChild(el('p.hint', {
      text: 'Wer heute sonst noch antritt. Dein Rivale steht mit auf der Liste — '
          + 'mit seinen echten Zahlen.'
    }));
    container.appendChild(fieldPreview(shown));
    container.appendChild(backButton());
  }

  function backButton() {
    var btn = el('button.btn.btn--ghost', { type: 'button', text: 'Zurück ins Gym' });
    util.onTap(btn, function () { MF.ui.router.go('gym'); });
    return btn;
  }

  /* ---------- Schritt 2: Posen wählen --------------------------------------- */

  function poseRow(pose) {
    var picked = chosen.indexOf(pose.id) >= 0;
    var value = MF.game.contest.poseScore(pose.id);

    var row = el('div.savebox.posepick' + (picked ? '.is-picked' : ''));
    row.appendChild(el('div.savebox__head', null, [
      el('span.savebox__dot' + (picked ? '.is-ok' : '')),
      el('strong', { text: pose.name }),
      el('span.savebox__price', { text: Math.round(value * 100) + ' %' })
    ]));
    row.appendChild(el('span.savebox__text', {
      text: 'Zeigt ' + pose.focus.map(function (id) {
        return MF.data.muscles.get(id).name;
      }).join(', ') + '.'
    }));
    row.appendChild(el('div.bar.bar--fit-part', null, [
      el('div.bar__fill', { style: 'width:' + (value * 100).toFixed(0) + '%' })
    ]));

    util.onTap(row, function () {
      var at = chosen.indexOf(pose.id);
      if (at >= 0) chosen.splice(at, 1);
      else if (chosen.length < data().POSES_NEEDED) chosen.push(pose.id);
      else MF.ui.toast.show('Drei Posen, mehr geht nicht.', 'warn');
      MF.ui.router.refresh('contest');
    });
    return row;
  }

  function renderPosen(container) {
    container.appendChild(el('div.section-title', null, [
      el('span', { text: klasse.icon + ' ' + klasse.name }),
      el('span.section-title__note', { text: chosen.length + ' von ' + data().POSES_NEEDED })
    ]));
    container.appendChild(el('p.hint', {
      text: 'Wähle die drei Posen für die Kür. Der Prozentwert sagt, wie viel '
          + 'die Pose bei deinem Körper hergibt — sie zeigt nur die Partien, '
          + 'die dahinter stehen.'
    }));

    var list = el('div.grid');
    MF.ui.poses.list.forEach(function (p) {
      if (!MF.ui.poses.isUnlocked(p.id)) return;
      list.appendChild(poseRow(p));
    });
    container.appendChild(list);

    var go = el('button.btn.btn--primary', {
      type: 'button',
      text: chosen.length === data().POSES_NEEDED ? 'Auf die Bühne'
        : 'Noch ' + (data().POSES_NEEDED - chosen.length) + ' wählen'
    });
    if (chosen.length !== data().POSES_NEEDED) go.classList.add('is-disabled');
    util.onTap(go, function () {
      if (chosen.length !== data().POSES_NEEDED) return;
      var res = MF.game.contest.enter(klasse);
      if (!res.ok) { MF.ui.toast.show(res.reason, 'warn'); return; }
      state().contest.poses = chosen.slice();
      startRun();
    });
    container.appendChild(go);
  }

  /* ---------- Schritt 3: Bühne ---------------------------------------------- */

  function startRun() {
    run = {
      poses: chosen.slice(),
      index: 0,
      hold: 0,
      hits: [],
      pos: 0, dir: 1, center: 0.5, zone: 0.3, time: 0, lock: 0,
      done: false
    };
    step = 'buehne';
    MF.ui.router.refresh('contest');
  }

  /* Von Pose zu Pose enger: 0,30 / 0,24 / 0,19 — und innerhalb einer Pose
     bleibt es gleich, damit man sich einstellen kann. */
  function zoneFor(index) {
    return Math.max(0.12, 0.30 - index * 0.055);
  }

  function nextHold() {
    run.zone = zoneFor(run.index);
    var margin = run.zone / 2 + 0.06;
    run.center = margin + Math.random() * (1 - margin * 2);
    run.time = 0;
    run.lock = LOCK_AFTER_TAP;
    placeZone();
    updateHud();
  }

  function placeZone() {
    if (!nodes.zone) return;
    nodes.zone.style.left = ((run.center - run.zone / 2) * 100).toFixed(2) + '%';
    nodes.zone.style.width = (run.zone * 100).toFixed(2) + '%';
    var okWidth = Math.min(1, run.zone * 2.1);
    nodes.ok.style.left = ((run.center - okWidth / 2) * 100).toFixed(2) + '%';
    nodes.ok.style.width = (okWidth * 100).toFixed(2) + '%';
  }

  function updateHud() {
    var pose = MF.ui.poses.get(run.poses[run.index]);
    nodes.poseName.textContent = pose.name;
    nodes.poseCount.textContent = 'Pose ' + (run.index + 1) + '/' + run.poses.length;
    nodes.holdCount.textContent = 'Halten ' + (run.hold + 1) + '/' + HOLDS;
    var good = 0;
    run.hits.forEach(function (h) { if (h !== 'miss') good++; });
    nodes.quality.textContent = run.hits.length
      ? Math.round(MF.game.contest.execution(run.hits) * 100) + ' %' : '–';
  }

  function frame(dt) {
    if (!run || run.done) return;

    run.pos += run.dir * 0.62 * dt * (1 + run.index * 0.14);
    if (run.pos >= 1) { run.pos = 1; run.dir = -1; }
    if (run.pos <= 0) { run.pos = 0; run.dir = 1; }
    if (run.lock > 0) run.lock -= dt;

    run.time += dt;
    var left = util.clamp(1 - run.time / HOLD_TIMEOUT, 0, 1);
    nodes.timer.style.width = (left * 100).toFixed(1) + '%';
    nodes.timer.classList.toggle('is-low', left < 0.3);
    if (run.time >= HOLD_TIMEOUT) { register('miss', 'GEWACKELT'); return; }

    if (!trackWidth) measure();
    nodes.marker.style.transform = 'translate3d(' + (run.pos * trackWidth).toFixed(1) + 'px,0,0)';
  }

  function onTap() {
    if (!run || run.done || run.lock > 0) return;
    var dist = Math.abs(run.pos - run.center);
    if (dist <= run.zone / 2) register('perfect', 'STEHT');
    else if (dist <= run.zone * 1.05) register('ok', 'WACKELT LEICHT');
    else register('miss', 'VERWACKELT');
  }

  function register(kind, label) {
    run.hits.push(kind);
    run.lock = LOCK_AFTER_TAP;
    nodes.feedback.textContent = label;
    nodes.feedback.className = 'session__feedback is-' + kind;

    if (kind === 'perfect') { MF.core.haptics.buzz('perfect'); MF.core.audio.sfx('rack'); }
    else if (kind === 'miss') { MF.core.haptics.buzz('miss'); }

    run.hold += 1;
    if (run.hold < HOLDS) { nextHold(); return; }

    /* Pose fertig — Energie kostet sie unabhängig vom Ergebnis. */
    MF.game.contest.spendPose();
    run.hold = 0;
    run.index += 1;
    if (run.index >= run.poses.length) { finishRun(); return; }
    MF.ui.router.refresh('contest');
  }

  function finishRun() {
    run.done = true;
    if (ticker) ticker.stop();
    var result = MF.game.contest.finish(klasse, run.poses, run.hits);
    step = 'ergebnis';
    run.result = result;
    MF.ui.hud.render();
    MF.ui.router.refresh('contest');

    if (result.levelUp) {
      window.setTimeout(function () { MF.ui.report.showLevelUp(result.levelUp); }, 600);
    }
  }

  function renderBuehne(container) {
    var pose = MF.ui.poses.get(run.poses[run.index]);

    container.appendChild(el('div.contest__head', null, [
      el('span.contest__pose', { id: 'contest-pose', text: pose.name }),
      el('span.contest__count', { id: 'contest-count', text: '' }),
      el('span.contest__hold', { id: 'contest-hold', text: '' }),
      el('span.contest__quality', { id: 'contest-quality', text: '–' })
    ]));

    container.appendChild(poseStage(pose.id, 'rival__stage--wide'));

    var track = el('div.track', { id: 'contest-track' }, [
      el('div.track__ok', { id: 'contest-ok' }),
      el('div.track__zone', { id: 'contest-zone' }),
      el('div.track__marker', { id: 'contest-marker' })
    ]);
    container.appendChild(track);
    container.appendChild(el('div.timer', null, [
      el('div.timer__fill', { id: 'contest-timer' })
    ]));
    container.appendChild(el('div.session__feedback', { id: 'contest-feedback', text: '' }));

    var hint = el('span.taparea__hint', { text: 'Tippen, wenn der Marker in der Zone steht' });
    var tap = el('button.taparea.taparea--flat', { type: 'button' }, [hint]);
    util.onPress(tap, onTap);
    container.appendChild(tap);

    nodes = {
      poseName: util.byId('contest-pose'),
      poseCount: util.byId('contest-count'),
      holdCount: util.byId('contest-hold'),
      quality: util.byId('contest-quality'),
      track: track,
      ok: util.byId('contest-ok'),
      zone: util.byId('contest-zone'),
      marker: util.byId('contest-marker'),
      timer: util.byId('contest-timer'),
      feedback: util.byId('contest-feedback')
    };

    trackWidth = 0;
    nextHold();
    if (!ticker) ticker = MF.core.ticker.create(frame);
    ticker.start();
  }

  /* ---------- Schritt 4: Ergebnis ------------------------------------------- */

  function renderErgebnis(container) {
    var r = run.result;
    var medal = r.rank === 1 ? '🥇' : (r.rank === 2 ? '🥈' : (r.rank === 3 ? '🥉' : '🎽'));

    container.appendChild(el('div.report__hero', null, [
      el('span.report__hero-value.is-' + (r.rank <= 3 ? 'good' : 'flat'), {
        text: medal + ' Platz ' + r.rank
      }),
      el('span.report__hero-label', {
        text: 'von ' + r.starters + ' Startern · ' + r.klasse.name
      })
    ]));

    var block = el('div.report__block');
    r.score.parts.forEach(function (p) {
      block.appendChild(el('div.report__row', null, [
        el('span.report__label', { text: p.name }),
        el('strong.report__value.is-flat', {
          text: Math.round(p.value) + ' / ' + p.max
        })
      ]));
    });
    block.appendChild(el('div.report__row', null, [
      el('span.report__label', { text: 'Gesundheit' }),
      el('strong.report__value.is-' + (r.score.health > 0.95 ? 'good' : 'warn'), {
        text: '×' + util.formatNum(r.score.health, 2)
      })
    ]));
    block.appendChild(el('div.report__row', null, [
      el('span.report__label', { text: 'Wertung' }),
      el('strong.report__value.is-good', { text: String(r.score.total) })
    ]));
    container.appendChild(block);

    container.appendChild(el('div.report__title', { text: 'Rangliste' }));
    var board = el('div.report__block');
    r.board.forEach(function (o, i) {
      board.appendChild(el('div.report__row' + (o.me ? '.is-me' : ''), null, [
        el('span.report__label', {
          text: (i + 1) + '. ' + (o.rival ? '★ ' : '') + o.name
        }),
        el('strong.report__value.is-' + (o.me ? 'good' : 'flat'), { text: String(o.total) })
      ]));
    });
    container.appendChild(board);

    var pay = el('div.report__block', null, [
      el('div.report__row', null, [
        el('span.report__label', { text: 'Preisgeld' }),
        el('strong.report__value.is-' + (r.money ? 'good' : 'flat'), {
          text: r.money ? '+' + util.formatMoney(r.money) : 'leer ausgegangen'
        })
      ]),
      el('div.report__row', null, [
        el('span.report__label', { text: 'Erfahrung' }),
        el('strong.report__value.is-good', { text: '+' + r.xp + ' XP' })
      ])
    ]);
    container.appendChild(pay);

    if (r.rank === 1) {
      container.appendChild(el('p.hint', {
        text: '🏆 Gewonnen. ' + (r.title ? 'Titel: ' + r.title + ' — er steht ab sofort '
          + 'auf deiner Mitgliedskarte.' : '')
      }));
    }

    var btn = el('button.btn.btn--primary', { type: 'button', text: 'Zurück ins Gym' });
    util.onTap(btn, function () {
      step = 'anmeldung';
      run = null;
      MF.ui.router.go('gym');
    });
    container.appendChild(btn);
  }

  /* ---------- Einstieg ------------------------------------------------------ */

  function render(container, params) {
    util.clear(container);
    if (params && params.reset) {
      step = 'anmeldung';
      chosen = [];
      run = null;
    }
    if (!MF.game.contest.unlocked()) { MF.ui.router.go('gym'); return; }

    if (step === 'posen' && klasse) { renderPosen(container); return; }
    if (step === 'buehne' && run && !run.done) { renderBuehne(container); return; }
    if (step === 'ergebnis' && run && run.result) { renderErgebnis(container); return; }
    renderAnmeldung(container);
  }

  function leave() {
    if (ticker) ticker.stop();
    /* Eine angefangene Kür bricht ab — das Startgeld ist trotzdem weg. */
    if (run && !run.done) { run = null; step = 'anmeldung'; }
  }

  window.addEventListener('resize', measure);

  MF.ui.router.register('contest', {
    elementId: 'screen-contest',
    render: render,
    leave: leave
  });
})(window.MacFit);
