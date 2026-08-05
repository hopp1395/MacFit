/* Der Satz: Marker läuft, du tippst. Grün = saubere Wiederholung.
   Die gesamte untere Bildschirmhälfte ist die Tippfläche. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;

  var REP_TIMEOUT = 4.0;   /* Sekunden pro Wiederholung, dann gilt sie als verrissen */
  var LOCK_AFTER_TAP = 0.16;
  var WOBBLE_WARN_AT = 0.6;   /* Sekunden bis zur Vorwarnung */
  var WOBBLE_FLIP_AT = 1.1;   /* danach dreht der Marker um */

  var ticker = null;
  var run = null;          /* laufender Satz */
  var pending = null;      /* fertiger Satz, dessen Ergebnis noch aussteht */
  var scene = null;        /* Pixel-Szene mit Gerät und Figur */
  var nodes = {};
  var trackWidth = 0;

  function state() { return MF.game.state.get(); }

  function measure() {
    if (nodes.track) trackWidth = nodes.track.getBoundingClientRect().width;
  }

  /* --- Aufbau ------------------------------------------------------------ */

  function buildSetUi(container, ex, weight, drop) {
    util.clear(container);

    var top = el('div.session__top');
    var back = el('button.session__close', { type: 'button', text: '✕', 'aria-label': 'Satz abbrechen' });
    util.onTap(back, abort);
    top.appendChild(back);
    top.appendChild(el('div.session__name', null, [
      el('strong', { text: ex.name }),
      el('span', {
        text: (drop ? '↓ Dropset ' + drop + ' · ' : '') + weight.name
            + ' · ' + MF.data.muscles.get(ex.muscle).name
      })
    ]));
    top.appendChild(el('div.session__rep', { id: 'session-rep', text: '' }));
    container.appendChild(top);

    /* Energie bleibt im Blick: die Kopfleiste ist im Satz ausgeblendet, und
       jede Wiederholung kostet sichtbar etwas. */
    container.appendChild(el('div.session__energy', null, [
      el('span.session__energy-icon', { text: '⚡' }),
      el('div.bar.bar--energy', null, [
        el('div.bar__fill', { id: 'session-energy-fill' }),
        el('span.bar__label', { id: 'session-energy-label', text: '' })
      ])
    ]));

    container.appendChild(el('div.session__scores', null, [
      el('div.score', null, [
        el('span.score__value', { id: 'session-perfect', text: '0' }),
        el('span.score__label', { text: 'perfekt' })
      ]),
      el('div.score', null, [
        el('span.score__value', { id: 'session-form', text: '–' }),
        el('span.score__label', { text: 'Form' })
      ]),
      /* Die Erfahrung waechst sichtbar mit jeder Wiederholung — das ist der
         Grund, warum man den naechsten Rep noch sauber ziehen will. */
      el('div.score.score--xp', null, [
        el('span.score__value', { id: 'session-xp', text: '0' }),
        el('span.score__label', { text: 'XP' })
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

    /* Eigene, null Pixel hohe Ebene fuer die XP-Krumen: die Leiste schneidet
       ab, und die Feedback-Zeile wird bei jeder Rep neu beschriftet. */
    container.appendChild(el('div.xplayer', { id: 'session-xplayer' }));
    container.appendChild(el('div.session__feedback', { id: 'session-feedback', text: '' }));

    /* Die Szene ist zugleich die Tippfläche — Blick und Daumen bleiben zusammen. */
    var stage = el('div.stage', { id: 'session-stage' });
    var hint = el('span.taparea__hint', { id: 'session-hint',
      text: 'Tippen, wenn der Marker in der grünen Zone ist' });
    var tap = el('button.taparea', { id: 'session-tap', type: 'button' }, [stage, hint]);
    util.onTap(tap, onTap);
    container.appendChild(tap);

    scene = MF.ui.scene.mountSession(stage, ex.id);

    nodes = {
      rep: util.byId('session-rep'),
      perfect: util.byId('session-perfect'),
      form: util.byId('session-form'),
      xp: util.byId('session-xp'),
      miss: util.byId('session-miss'),
      track: track,
      ok: util.byId('session-ok'),
      zone: util.byId('session-zone'),
      marker: util.byId('session-marker'),
      timer: util.byId('session-timer'),
      energyFill: util.byId('session-energy-fill'),
      energyLabel: util.byId('session-energy-label'),
      xplayer: util.byId('session-xplayer'),
      feedback: util.byId('session-feedback'),
      tap: tap,
      hint: hint,
      container: container
    };

    measure();
  }

  /* --- Ablauf ------------------------------------------------------------ */

  function start(exerciseId, weightIndex, container, dropStep) {
    var ex = MF.data.exercises.get(exerciseId);
    if (!ex) {
      MF.ui.router.go('gym');
      return;
    }

    var drop = dropStep || 0;
    var check = MF.game.training.canTrain(ex, weightIndex, drop);
    if (!check.ok) {
      MF.ui.toast.show(check.reason, 'warn');
      MF.ui.router.go('gym');
      return;
    }

    MF.game.training.beginSet();
    MF.ui.hud.render();

    run = {
      ex: ex,
      weightIndex: weightIndex,
      weight: MF.game.training.weightAt(weightIndex),
      drop: drop,
      totalReps: MF.game.training.repCount(ex, drop),
      repIndex: 0,
      hits: [],
      pos: 0.5,
      dir: 1,
      center: 0.5,
      baseCenter: 0.5,   /* Ruhelage — bei Drift schwankt center darum */
      amp: 0,            /* Drift-Amplitude der instabilen Hantel */
      zone: 0.3,
      streak: 0,         /* perfekte Reps in Folge (Pump-Flow) */
      xp: 0,             /* bis hierher verdiente Erfahrung, live sichtbar */
      wobble: false,     /* kippt die Hantel in dieser Wiederholung? */
      warned: false,     /* Vorwarnung schon gezeigt */
      flipped: false,    /* Richtung schon gedreht */
      lastWobble: false, /* nie zweimal hintereinander */
      wobbleHits: 0,     /* gerettete Ausreisser-Reps */
      extra: false,      /* laeuft gerade die Spotter-Extra-Rep? */
      awaiting: false,   /* Spotter-Frage offen — Satz pausiert */
      repTime: 0,
      lock: 0,
      done: false
    };

    buildSetUi(container, ex, run.weight, drop);
    updateEnergy();
    nextRep();
    MF.core.audio.sfx('rack');   /* Gewicht aufgelegt */

    if (!ticker) ticker = MF.core.ticker.create(frame);
    ticker.start();
  }

  /* Zone und Okay-Band an die aktuelle Mitte setzen — bei Drift jedes Frame. */
  function placeZone() {
    var okWidth = Math.min(1, run.zone * 2.1);
    nodes.zone.style.left = ((run.center - run.zone / 2) * 100).toFixed(2) + '%';
    nodes.zone.style.width = (run.zone * 100).toFixed(2) + '%';
    nodes.ok.style.left = ((run.center - okWidth / 2) * 100).toFixed(2) + '%';
    nodes.ok.style.width = (okWidth * 100).toFixed(2) + '%';
  }

  function nextRep() {
    if (!run) return;
    run.zone = MF.game.training.zoneWidth(run.ex, run.weightIndex, run.repIndex);
    run.amp = MF.game.training.driftAmp(run.ex, run.weightIndex);
    /* Zonenmitte zufaellig, aber nicht direkt am Rand — die Drift-Amplitude
       zaehlt zum Rand dazu, sonst wandert die Zone aus der Leiste. */
    var margin = run.zone / 2 + 0.06 + run.amp;
    run.baseCenter = margin + Math.random() * (1 - margin * 2);
    run.center = run.baseCenter;
    run.repTime = 0;
    run.lock = LOCK_AFTER_TAP;

    /* Ausreisser wuerfeln — aber nie zweimal hintereinander. */
    run.wobble = !run.lastWobble && !run.extra
      && Math.random() < MF.game.training.wobbleChance(run.ex, run.repIndex);
    run.warned = false;
    run.flipped = false;
    nodes.track.classList.remove('is-wobble');

    placeZone();

    nodes.rep.textContent = 'Rep ' + (run.repIndex + 1) + '/' + run.totalReps;
  }

  function frame(dt) {
    if (!run || run.done || run.awaiting) return;

    var speed = MF.game.training.markerSpeed(run.ex, run.weightIndex, run.repIndex);
    if (run.extra) speed *= 1.15;   /* die Extra-Rep hat mehr Zug drauf */
    run.pos += run.dir * speed * dt;
    if (run.pos >= 1) { run.pos = 1; run.dir = -1; }
    if (run.pos <= 0) { run.pos = 0; run.dir = 1; }

    if (run.lock > 0) run.lock -= dt;

    run.repTime += dt;
    var left = util.clamp(1 - run.repTime / REP_TIMEOUT, 0, 1);
    nodes.timer.style.width = (left * 100).toFixed(1) + '%';
    nodes.timer.classList.toggle('is-low', left < 0.3);

    /* Ausreisser-Rep: erst wackelt die Leiste sichtbar und spuerbar, eine
       halbe Sekunde spaeter dreht der Marker um. Nur mit dieser Vorwarnung
       ist der Wechsel am Handy fair zu treffen. */
    if (run.wobble && !run.flipped) {
      if (!run.warned && run.repTime >= WOBBLE_WARN_AT) {
        run.warned = true;
        nodes.track.classList.add('is-wobble');
        MF.core.haptics.buzz('ok');
        MF.core.audio.sfx('rack');
      }
      if (run.repTime >= WOBBLE_FLIP_AT) {
        run.flipped = true;
        run.dir *= -1;
        nodes.track.classList.remove('is-wobble');
      }
    }

    /* Instabile Hantel: die Zone schwankt langsam (0,4 Hz) um die Ruhelage —
       vorhersehbar wie eine pendelnde Langhantel, kein Reaktionstest. */
    if (run.amp > 0) {
      run.center = run.baseCenter + run.amp * Math.sin(run.repTime * 2 * Math.PI * 0.4);
      placeZone();
    }

    if (run.repTime >= REP_TIMEOUT) {
      if (run.extra) { concludeExtra('fail', 'ZU LANGSAM'); return; }
      register('miss', 'ZU LANGSAM');
      return;
    }

    if (!trackWidth) measure();
    nodes.marker.style.transform = 'translate3d(' + (run.pos * trackWidth).toFixed(1) + 'px,0,0)';

    /* Die Figur folgt dem Marker: rechts = Gewicht runter, links = drücken. */
    if (scene) scene.update(run.pos, dt);
  }

  function onTap() {
    if (!run || run.done || run.awaiting || run.lock > 0) return;

    var dist = Math.abs(run.pos - run.center);
    if (run.extra) {
      /* Die Extra-Rep kennt nur Treffer oder Verriss — auch "okay" zaehlt. */
      if (dist <= run.zone * 1.05) concludeExtra('hit', 'GESCHAFFT!');
      else concludeExtra('fail', 'VERRISSEN');
      return;
    }
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

    /* Wer die gekippte Hantel noch trifft, bekommt Kredit — auch ein
       "okay" zaehlt dort voll, sonst waere der Ausreisser reine Strafe. */
    var saved = run.flipped && (kind === 'perfect' || kind === 'ok');
    if (saved) {
      run.wobbleHits += 1;
      label = 'AUSREISSER GERETTET';
    }
    run.lastWobble = run.wobble;
    run.wobble = false;
    nodes.track.classList.remove('is-wobble');

    /* Jede Wiederholung kostet ihren Anteil — sichtbar, waehrend man tippt. */
    MF.game.training.chargeRep(run.ex, run.weightIndex, run.drop,
      run.repIndex, run.totalReps);
    updateEnergy();

    /* Erfahrung sofort sichtbar machen: die Zahl oben zaehlt hoch, und am
       Treffer selbst fliegt der Gewinn weg. Ab der Flow-Serie gibt es einen
       Aufschlag — deshalb lohnt sich die naechste saubere Rep doppelt. */
    var gain = kind === 'perfect' ? MF.game.training.XP_PERFECT
             : kind === 'ok' ? MF.game.training.XP_OK : 0;
    if (kind === 'perfect' && run.streak >= 2) gain += 2;   /* ab der dritten in Folge */
    if (saved) gain += 3;                                  /* gerettete Ausreisser-Rep */
    if (gain > 0) {
      run.xp += gain;
      popXp(gain, kind);
    }

    /* Pump-Flow: ab drei perfekten Reps in Folge glueht die Leiste und der
       Zaehler steht im Feedback — ein Verriss beendet die Serie. */
    if (kind === 'perfect') {
      run.streak += 1;
      if (run.streak >= 3) {
        label = 'PERFEKT ×' + run.streak;
        nodes.track.classList.add('is-flow');
        MF.core.haptics.buzz('flow');
        MF.core.audio.sfx('combo', run.streak);
      } else {
        MF.core.haptics.buzz('perfect');
        MF.core.audio.sfx('perfect');
      }
    } else {
      run.streak = 0;
      nodes.track.classList.remove('is-flow');
      MF.core.haptics.buzz(kind === 'ok' ? 'ok' : 'miss');
      MF.core.audio.sfx(kind);
    }

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
    if (run.repIndex >= run.totalReps) {
      if (!run.drop && MF.game.training.spotterOffer(run.ex, run.weightIndex, run.hits)) {
        offerSpotter();
      }
      else finish();
    } else {
      nextRep();
    }
  }

  /* --- Der Spotter -------------------------------------------------------- */

  /* Die Form des laufenden Satzes — fuer Angebote, die vor der Auswertung
     entschieden werden muessen. */
  function currentForm() {
    var perfect = 0, ok = 0;
    run.hits.forEach(function (h) {
      if (h === 'perfect') perfect++;
      else if (h === 'ok') ok++;
    });
    return (perfect + ok * 0.5) / Math.max(1, run.hits.length);
  }

  function offerSpotter() {
    run.awaiting = true;

    /* Wer keine Extra-Rep will, soll trotzdem direkt weiterkoennen: das
       Dropset steht gleich hier zur Wahl, statt ueber den Ergebnisschirm. */
    var drop = MF.game.training.dropOffer({
      exercise: run.ex,
      weightIndex: run.weightIndex,
      formScore: currentForm(),
      dropStep: run.drop
    });

    var body = el('div');
    body.appendChild(el('p.card__desc', {
      text: 'Eine Extra-Rep mit enger Zone und mehr Zug: Treffer bringt +30 % '
          + 'Reiz und 10 XP obendrauf — ein Verriss kostet Kraft und Laune.'
    }));
    if (drop) {
      body.appendChild(el('p.hint', {
        text: 'Oder du gehst runter im Gewicht: ' + drop.weight.name + ', '
            + drop.reps + ' Reps für ⚡ ' + drop.cost + ' — mit 25 % mehr Reiz.'
      }));
    }

    var actions = [{
      label: 'Noch eine!',
      tone: 'primary',
      onTap: function () { startExtraRep(); }
    }];
    if (drop) {
      actions.push({
        label: '↓ Dropset: ' + drop.weight.name,
        tone: 'drop',
        onTap: function () {
          run.awaiting = false;
          finishInto(drop.step);
        }
      });
    }
    actions.push({
      label: 'Reicht für heute',
      onTap: function () {
        run.awaiting = false;
        finish();
      }
    });

    MF.ui.modal.open({
      title: '💪 Der Spotter taucht auf',
      subtitle: '„Jede Rep sauber. Eine geht noch — ALLES DU!“',
      body: body,
      dismissible: false,
      actions: actions
    });
  }

  /* Satz werten und ohne Umweg ueber das Ergebnis ins Dropset starten. */
  function finishInto(step) {
    run.done = true;
    if (ticker) ticker.stop();

    var ex = run.ex;
    var result = MF.game.training.finishSet(ex, run.weightIndex, run.hits, null, run.drop, run.wobbleHits);
    var drop = MF.game.training.dropOffer(result);

    /* Zwischendurch etwas dazwischengekommen (Zerrung, Energie)? Dann bleibt
       es beim normalen Weg ueber den Ergebnisschirm. */
    if (!drop || drop.step !== step) {
      showEndBar(result);
      return;
    }

    MF.ui.router.go('session', {
      exerciseId: ex.id,
      weightIndex: drop.weightIndex,
      dropStep: drop.step
    });
    showAftermath(result);
  }

  function startExtraRep() {
    run.awaiting = false;
    run.extra = true;

    /* Enge Zone, aber nie unter 8 % der Leiste — kein unfaires Fenster. */
    run.zone = Math.max(0.08,
      MF.game.training.zoneWidth(run.ex, run.weightIndex, run.repIndex) * 0.6);
    run.amp = MF.game.training.driftAmp(run.ex, run.weightIndex);
    var margin = run.zone / 2 + 0.06 + run.amp;
    run.baseCenter = margin + Math.random() * (1 - margin * 2);
    run.center = run.baseCenter;
    run.repTime = 0;
    run.lock = LOCK_AFTER_TAP;

    placeZone();
    nodes.rep.textContent = 'Extra-Rep!';
    MF.core.audio.sfx('rack');
  }

  function concludeExtra(forced, label) {
    run.done = true;
    if (ticker) ticker.stop();

    nodes.feedback.textContent = label;
    nodes.feedback.className = 'session__feedback is-shown is-' + (forced === 'hit' ? 'perfect' : 'miss');

    var result = MF.game.training.finishSet(run.ex, run.weightIndex, run.hits, forced, run.drop, run.wobbleHits);
    if (forced === 'hit') {
      MF.core.haptics.buzz('levelUp');
      if (!result.levelUp) MF.core.audio.sfx('done');
    } else {
      MF.core.haptics.buzz('miss');
      MF.core.audio.sfx('miss');
      MF.ui.toast.show('Der Spotter hat mehr gedrückt als du.', 'warn');
    }
    showEndBar(result);
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
    nodes.xp.textContent = run.xp;
  }

  /* Energieleiste im Satz — dieselbe Optik wie in der Kopfleiste. */
  function updateEnergy() {
    if (!nodes.energyFill) return;
    var s = state();
    var max = MF.game.stats.energyMax();
    var ratio = util.clamp(s.energy / max, 0, 1);
    nodes.energyFill.style.width = (ratio * 100).toFixed(1) + '%';
    nodes.energyFill.classList.toggle('is-low', ratio < 0.25);
    nodes.energyLabel.textContent = Math.round(s.energy) + ' / ' + max;
  }

  /* Die verdiente Erfahrung fliegt am Ort des Treffers nach oben weg —
     ein kurzer, klarer Moment pro Wiederholung. */
  function popXp(amount, kind) {
    var pop = el('span.xppop.is-' + kind, { text: '+' + amount + ' XP' });
    if (trackWidth) pop.style.left = (run.pos * trackWidth).toFixed(0) + 'px';
    nodes.xplayer.appendChild(pop);
    window.setTimeout(function () {
      if (pop.parentNode) pop.parentNode.removeChild(pop);
    }, 700);
  }

  function finish() {
    run.done = true;
    if (ticker) ticker.stop();

    var result = MF.game.training.finishSet(run.ex, run.weightIndex, run.hits, null, run.drop, run.wobbleHits);
    /* Beim Aufstieg spielt gleich die laengere Fanfare aus dem Modal — zwei
       Melodien uebereinander waeren Krach. */
    if (!result.levelUp) MF.core.audio.sfx('done');
    showEndBar(result);
  }

  /* Der Satz ist durch, das Bild bleibt aber stehen: Leiste, Zahlen und die
     letzte Rueckmeldung kann man in Ruhe ansehen. Weiter geht es erst per
     Schaltflaeche — nichts wechselt von selbst. */
  function showEndBar(result) {
    pending = result;

    nodes.rep.textContent = 'Satz beendet';
    nodes.hint.textContent = 'Satz beendet — sieh dir in Ruhe an, was du gedrückt hast.';
    nodes.tap.classList.add('is-done');
    nodes.timer.style.width = '0%';
    nodes.feedback.classList.add('is-shown');   /* letzte Meldung stehen lassen */

    var bar = el('div.session__end', { id: 'session-end' });
    var resultBtn = el('button.btn.btn--primary', { type: 'button', text: '📊 Ergebnis ansehen' });
    util.onTap(resultBtn, function () { showResult(result); });
    bar.appendChild(resultBtn);

    var gymBtn = el('button.btn.btn--ghost', { type: 'button', text: 'Zurück ins Gym' });
    util.onTap(gymBtn, function () {
      pending = null;
      MF.ui.router.go('gym');
      showAftermath(result);
    });
    bar.appendChild(gymBtn);

    nodes.container.appendChild(bar);
    MF.ui.hud.render();
  }

  /* Abbruch: gezaehlte Reps werden gewertet — bezahlt hat man ohnehin nur
     die Wiederholungen, die man wirklich gezogen hat. */
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
    var result = MF.game.training.finishSet(run.ex, run.weightIndex, run.hits, null, run.drop, run.wobbleHits);
    showResult(result);
  }

  function showResult(result) {
    var container = util.byId('screen-session');
    pending = null;
    util.clear(container);
    scene = null;

    var panel = el('div.result');
    panel.appendChild(el('div.result__icon', { text: result.exercise.icon }));
    panel.appendChild(el('h2.result__grade.is-' + result.grade.tone, { text: result.grade.text }));
    panel.appendChild(el('div.result__form', { text: Math.round(result.formScore * 100) + '% Form' }));

    var rows = el('div.result__rows', null, [
      row('Perfekt', result.perfect + ' / ' + result.reps),
      row('Verrissen', String(result.miss)),
      row('Reiz auf ' + MF.data.muscles.get(result.exercise.muscle).name,
          '+' + util.formatNum(result.stimulus, 1)),
      row('Erfahrung', '+' + result.xp + ' XP')
    ]);
    if (result.flowBonus > 0) {
      rows.appendChild(row('Flow-Bonus (beste Serie ×' + result.bestStreak + ')',
        '+' + Math.round(result.flowBonus * 100) + ' %'));
    }
    if (result.forced === 'hit') rows.appendChild(row('Spotter-Rep', '+30 % Reiz'));
    if (result.forced === 'fail') rows.appendChild(row('Spotter-Rep', 'verrissen'));
    if (result.dropStep) rows.appendChild(row('↓ Dropset ' + result.dropStep, '+25 % Reiz'));
    if (result.wobbleHits) {
      rows.appendChild(row('Ausreißer gerettet', result.wobbleHits + '×'));
    }
    if (result.board) {
      rows.appendChild(row('📌 ' + result.board.def.title,
        '+' + util.formatMoney(result.board.reward.money)));
    }
    panel.appendChild(rows);

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

    /* Dropset: sofort eine Stufe leichter weiter, ohne Pause. Nur wenn der
       Satz sauber war und die Kette noch nicht am Ende ist. */
    var drop = MF.game.training.dropOffer(result);
    if (drop) {
      var dropBtn = el('button.btn.btn--drop', {
        type: 'button',
        text: '↓ Dropset: ' + drop.weight.name + ' · ' + drop.reps + ' Reps · ⚡ ' + drop.cost
      });
      util.onTap(dropBtn, function () {
        MF.ui.router.go('session', {
          exerciseId: result.exercise.id,
          weightIndex: drop.weightIndex,
          dropStep: drop.step
        });
      });
      actions.appendChild(dropBtn);
    }

    var backBtn = el('button.btn.btn--ghost', { type: 'button', text: 'Zurück ins Gym' });
    util.onTap(backBtn, function () { MF.ui.router.go('gym'); });
    actions.appendChild(backBtn);

    panel.appendChild(actions);
    container.appendChild(panel);

    MF.ui.hud.render();
    showAftermath(result);
  }

  /* Was nach dem Satz noch gesagt werden muss. Laeuft auf beiden Wegen —
     ueber das Ergebnis oder direkt zurueck ins Gym. */
  function showAftermath(result) {
    var s = state();
    /* Immer abholen, auch wenn der Satz selbst schon aufsteigen liess —
       sonst poppt der geparkte Aufstieg beim naechsten Satz auf. */
    var boardLevelUp = MF.game.challenge.takeLevelUp();

    /* Die Zerrung geht vor: sie sperrt die Partie und muss ankommen. */
    if (result.injured) {
      MF.core.haptics.buzz('miss');
      MF.ui.modal.open({
        title: '🤕 Muskelzerrung',
        subtitle: 'Zu viel Schwung, zu wenig Kontrolle.',
        body: el('p.card__desc', {
          text: 'Es hat dich in der ' + MF.data.muscles.get(result.exercise.muscle).name
              + ' erwischt. ' + result.injuryDays + ' Tage Pause für diese Partie — '
              + 'der Reiz aus diesem Satz ist dahin. Andere Partien darfst du weiter '
              + 'trainieren; ausgeheilt wird über Nacht.'
        }),
        actions: [{ label: 'Verstanden', tone: 'primary' }]
      });
    } else if (result.levelUp || boardLevelUp) {
      MF.ui.report.showLevelUp(result.levelUp || boardLevelUp);
    } else if (s.energy <= 0) {
      MF.ui.toast.show('Energie leer — Zeit zu schlafen.', 'warn');
    }
  }

  function row(label, value) {
    return el('div.result__row', null, [
      el('span', { text: label }),
      el('strong', { text: value })
    ]);
  }

  function render(container, params) {
    if (params && params.exerciseId) {
      start(params.exerciseId,
        params.weightIndex === undefined ? 1 : params.weightIndex,
        container, params.dropStep);
    } else if (!run || run.done) {
      MF.ui.router.go('gym');
    }
  }

  function leave() {
    if (ticker) ticker.stop();
    run = null;
    pending = null;
    scene = null;
  }

  window.addEventListener('resize', measure);

  MF.ui.router.register('session', {
    elementId: 'screen-session',
    render: render,
    leave: leave
  });
})(window.MacFit);
