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
       jede Wiederholung kostet sichtbar etwas. Was sie kostet, fliegt am
       rechten Ende der Leiste als eigene Krume weg. */
    container.appendChild(el('div.session__energy', null, [
      el('span.session__energy-icon', { text: '⚡' }),
      el('div.bar.bar--energy', null, [
        el('div.bar__fill', { id: 'session-energy-fill' }),
        el('span.bar__label', { id: 'session-energy-label', text: '' })
      ]),
      el('div.poplayer.poplayer--right', { id: 'session-eplayer' })
    ]));

    /* Kondition zahlt nicht auf die Masse — dort steht statt des Reizes,
       was der Satz an Gesundheit zurueckholt. */
    var yieldLabel = ex.kind === 'kondition' ? 'Gesundheit' : 'Reiz';

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
      /* Der Ertrag des Satzes stand frueher erst im Ergebnis. Verrissene Reps
         zeigt jetzt die Kette unter der Leiste — der Platz ist besser
         angelegt fuer das, was man sich gerade erarbeitet. */
      el('div.score.score--stim', null, [
        el('span.score__value', { id: 'session-stim', text: '0,0' }),
        el('span.score__label', { text: yieldLabel })
      ])
    ]));

    var track = el('div.track', { id: 'session-track' }, [
      el('div.track__ok', { id: 'session-ok' }),
      el('div.track__zone', { id: 'session-zone' }),
      el('div.track__marker', { id: 'session-marker' })
    ]);
    container.appendChild(track);

    /* Die Kette: ein Punkt je Wiederholung, der sich im Moment des Tippens
       einfaerbt. So sieht man den ganzen Satz auf einen Blick, statt zwei
       Zaehler im Kopf gegeneinander zu halten. */
    container.appendChild(el('div.repchain', { id: 'session-chain' }));

    container.appendChild(el('div.timer', null, [
      el('div.timer__fill', { id: 'session-timer' })
    ]));

    /* Eigene, null Pixel hohe Ebene fuer alles, was am Treffer aufsteigt:
       die Bewertung der Wiederholung, die Erfahrung, der Reiz. Frueher stand
       die Bewertung in einer festen Zeile darunter — als Ballon am Ort des
       Tippens gehoert sie sichtbar zu der Rep, die man gerade gezogen hat. */
    container.appendChild(el('div.xplayer', { id: 'session-xplayer' }));

    /* Die Szene ist zugleich die Tippfläche — Blick und Daumen bleiben zusammen. */
    var stage = el('div.stage', { id: 'session-stage' });
    var hint = el('span.taparea__hint', { id: 'session-hint',
      text: 'Tippen, wenn der Marker in der grünen Zone ist' });
    var tap = el('button.taparea', { id: 'session-tap', type: 'button' }, [stage, hint]);
    /* Hier zaehlt der Moment des Aufsetzens, nicht des Loslassens — sonst
       laege jede Wiederholung um die Fingerzeit daneben. */
    util.onPress(tap, onTap);
    container.appendChild(tap);

    scene = MF.ui.scene.mountSession(stage, ex.id);

    nodes = {
      rep: util.byId('session-rep'),
      perfect: util.byId('session-perfect'),
      form: util.byId('session-form'),
      xp: util.byId('session-xp'),
      stim: util.byId('session-stim'),
      track: track,
      ok: util.byId('session-ok'),
      zone: util.byId('session-zone'),
      marker: util.byId('session-marker'),
      chain: util.byId('session-chain'),
      timer: util.byId('session-timer'),
      energyFill: util.byId('session-energy-fill'),
      energyLabel: util.byId('session-energy-label'),
      xplayer: util.byId('session-xplayer'),
      eplayer: util.byId('session-eplayer'),
      stage: stage,
      tap: tap,
      hint: hint,
      container: container
    };

    buildChain(run ? run.totalReps : ex.reps);
    measure();
  }

  /* --- Rueckmeldung: Kette, Krumen, Pump --------------------------------- */

  function buildChain(count) {
    util.clear(nodes.chain);
    for (var i = 0; i < count; i++) {
      nodes.chain.appendChild(el('span.repdot'));
    }
    markChainCurrent(0);
  }

  function chainDots() {
    return nodes.chain ? nodes.chain.childNodes : [];
  }

  function markChainCurrent(index) {
    var dots = chainDots();
    for (var i = 0; i < dots.length; i++) {
      if (i === index) dots[i].classList.add('is-now');
      else dots[i].classList.remove('is-now');
    }
  }

  function fillChain(index, kind) {
    var dots = chainDots();
    if (!dots[index]) return;
    dots[index].classList.remove('is-now');
    dots[index].classList.add('is-' + kind);
  }

  /* Die Extra-Rep des Spotters haengt hinten an der Kette — sie gehoert
     sichtbar dazu, zaehlt aber nicht in die Form. */
  function addExtraDot() {
    var dot = el('span.repdot.is-extra');
    nodes.chain.appendChild(dot);
    markChainCurrent(chainDots().length - 1);
  }

  /* Eine Krume steigen lassen. layer ist die nullhohe Ebene, x der Ort in
     Pixeln (nur wo die Ebene ueber die ganze Breite geht). Aufgeraeumt wird
     nach der Animation — die Ebene bleibt sonst voll mit toten Knoten. */
  function popNode(layer, node, x, ms) {
    if (!layer) return;
    if (x) node.style.left = x.toFixed(0) + 'px';
    layer.appendChild(node);
    window.setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, ms);
  }

  function pop(layer, text, cls, x) {
    popNode(layer, el('span.xppop' + (cls ? '.' + cls : ''), { text: text }), x, 700);
  }

  /* Zahlen und Bewertung starten am selben Punkt — die Zahlen weichen deshalb
     nach links und rechts aus, damit der Ballon dazwischen frei steht. */
  function sideX(offset) {
    if (!trackWidth) return 0;
    return util.clamp(run.pos * trackWidth + offset, 24, trackWidth - 24);
  }

  /* Die Bewertung der Wiederholung: steigt am Ort des Tippens auf, schaukelt
     dabei leicht hin und her und verblasst — der laengere Weg macht sie zum
     Hauptdarsteller, die Zahlen daneben bleiben klein. */
  function popRate(label, kind, x) {
    var long = label.length > 12;
    var node = el('span.ratepop.is-' + kind + (long ? '.is-long' : ''), { text: label });
    popNode(nodes.xplayer, node, x, 1250);
  }

  /* Eine Animation neu anstossen, ohne den Browser zu einer Zwischenrechnung
     zu zwingen: zwei gleichwertige Klassen im Wechsel. Der uebliche Weg —
     Klasse weg, Neuvermessung erzwingen, Klasse dran — kostet genau in dem
     Bild ein Neuvermessen, in dem der Ballon startet; mehrmals pro Tipp
     hintereinander sieht man das als Ruckler. */
  function restart(node, a, b) {
    if (!node) return;
    if (node.classList.contains(a)) {
      node.classList.remove(a);
      node.classList.add(b);
    } else {
      node.classList.remove(b);
      node.classList.add(a);
    }
  }

  /* Eine Zahl in der Score-Reihe hat sich geaendert — kurz aufpoppen, sonst
     uebersieht man den Zuwachs mitten im Tippen. */
  function bump(node) {
    restart(node, 'is-bump', 'is-bump2');
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
      stim: 0,           /* bis hierher erarbeiteter Reiz (bzw. Gesundheit) */
      pump: 0,           /* 0..1 — wie voll die Partie im Satz schon ist */
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

    /* Die Kette faerbt sich im selben Moment — gerettete Ausreisser bleiben
       das, was sie im Ergebnis auch sind: ein Treffer. */
    fillChain(run.repIndex, kind);

    /* Jede Wiederholung kostet ihren Anteil — sichtbar, waehrend man tippt.
       Der Abzug fliegt an der Energieleiste weg, damit man den Preis der
       Wiederholung sieht und nicht nur den Ertrag. */
    var cost = MF.game.training.chargeRep(run.ex, run.weightIndex, run.drop,
      run.repIndex, run.totalReps);
    updateEnergy();
    if (cost > 0) pop(nodes.eplayer, '−' + util.formatNum(cost, 1), 'is-cost');

    /* Der Ertrag des Satzes waechst mit: Reiz am Geraet, Gesundheit auf der
       Matte. Dieselbe Rechnung wie in der Auswertung — bei einem vollen Satz
       steht am Ende genau das da, was auch der Ergebnisschirm zeigt. */
    var yield_ = run.ex.kind === 'kondition'
      ? MF.game.training.repHealth(run.ex, kind, run.totalReps)
      : MF.game.training.repStimulus(run.ex, run.weightIndex, kind, run.totalReps);
    if (yield_ > 0) {
      run.stim += yield_;
      pop(nodes.xplayer, '+' + util.formatNum(yield_, 1)
        + (run.ex.kind === 'kondition' ? ' ❤' : ' Reiz'), 'is-stim', sideX(-34));
      bump(nodes.stim);
    }

    /* Pump: saubere Reps fuellen die Partie, verrissene lassen Luft raus.
       Die Figur in der Szene wird dadurch sichtbar praller. */
    run.pump = util.clamp(run.pump + (kind === 'miss' ? -0.12 : (kind === 'ok' ? 0.05 : 0.11)), 0, 1);
    if (scene && scene.setPump) scene.setPump(run.pump);
    updatePumpGlow();

    /* Erfahrung sofort sichtbar machen: die Zahl oben zaehlt hoch, und am
       Treffer selbst fliegt der Gewinn weg. Ab der Flow-Serie gibt es einen
       Aufschlag — deshalb lohnt sich die naechste saubere Rep doppelt. */
    var gain = kind === 'perfect' ? MF.game.training.XP_PERFECT
             : kind === 'ok' ? MF.game.training.XP_OK : 0;
    /* Kondition zahlt die Wiederholung halb — die Anzeige muss dasselbe
       sagen wie die Abrechnung am Satzende. */
    if (run.ex.kind === 'kondition') gain = Math.round(gain / 2);
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
        /* Der Beginn der Serie bekommt eine eigene Krume — danach steht die
           Serie ohnehin gross in der Rueckmeldezeile. */
        if (run.streak === 3) pop(nodes.xplayer, 'FLOW!', 'is-flow', sideX(0));
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

    popRate(label, kind, trackWidth ? run.pos * trackWidth : 0);

    nodes.track.classList.remove('is-perfect', 'is-ok', 'is-miss');
    void nodes.track.getBoundingClientRect();
    nodes.track.classList.add('is-' + kind);

    if (scene) scene.flash(kind);
    /* Ab "Schwer" bekommt der Treffer Wucht: die Szene setzt kurz auf. */
    if (kind !== 'miss' && run.weightIndex >= 2) restart(nodes.stage, 'is-hit', 'is-hit2');

    updateScores();

    run.repIndex += 1;
    markChainCurrent(run.repIndex);
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
    addExtraDot();
    nodes.rep.textContent = 'Extra-Rep!';
    MF.core.audio.sfx('rack');
  }

  function concludeExtra(forced, label) {
    run.done = true;
    if (ticker) ticker.stop();

    fillChain(chainDots().length - 1, forced === 'hit' ? 'perfect' : 'miss');
    popRate(label, forced === 'hit' ? 'perfect' : 'miss', trackWidth ? run.pos * trackWidth : 0);

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
    var perfect = 0, ok = 0;
    run.hits.forEach(function (h) {
      if (h === 'perfect') perfect++;
      else if (h === 'ok') ok++;
    });
    if (nodes.perfect.textContent !== String(perfect)) bump(nodes.perfect);
    nodes.perfect.textContent = perfect;
    var form = (perfect + ok * 0.5) / Math.max(1, run.hits.length);
    nodes.form.textContent = Math.round(form * 100) + '%';
    nodes.form.className = 'score__value is-' + (form >= 0.75 ? 'good' : (form >= 0.5 ? 'warn' : 'bad'));
    nodes.xp.textContent = run.xp;
    nodes.stim.textContent = util.formatNum(run.stim, 1);
  }

  /* Der Pump schlaegt sich auch ausserhalb der Figur nieder: die Tippflaeche
     glueht mit. Inline gesetzt, weil der Wert stufenlos ist. */
  function updatePumpGlow() {
    if (!nodes.tap) return;
    var p = run.pump;
    nodes.tap.style.boxShadow = p <= 0.02 ? ''
      : '0 0 ' + (16 * p).toFixed(0) + 'px rgba(255, 179, 92, ' + (0.45 * p).toFixed(2) + ')';
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
    pop(nodes.xplayer, '+' + amount + ' XP', 'is-' + kind, sideX(34));
    bump(nodes.xp);
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

    /* Jetzt erst stehen die Boni fest — die Zahl springt sichtbar auf den
       Wert, der gleich auch im Ergebnis steht. */
    var total = result.exercise.kind === 'kondition' ? healthSum(result) : result.stimulus;
    nodes.stim.textContent = util.formatNum(total, 1);
    bump(nodes.stim);
    if (result.flowBonus > 0) {
      pop(nodes.xplayer, '+' + Math.round(result.flowBonus * 100) + ' % FLOW', 'is-flow',
        trackWidth ? trackWidth * 0.5 : undefined);
    }

    nodes.rep.textContent = 'Satz beendet';
    nodes.hint.textContent = 'Satz beendet — sieh dir in Ruhe an, was du gedrückt hast.';
    nodes.tap.classList.add('is-done');
    nodes.timer.style.width = '0%';

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

  /* Was ein Konditionssatz an Gesundheit gebracht hat — alle vier Werte
     zusammen, dieselbe Zahl, die waehrend des Satzes hochlief. */
  function healthSum(result) {
    var sum = 0;
    if (result.healthGain) {
      Object.keys(result.healthGain).forEach(function (k) { sum += result.healthGain[k]; });
    }
    return sum;
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
    /* Kondition zahlt nicht auf die Masse, sondern auf die Werte. */
    if (result.healthGain) {
      var HEALTH_NAMES = { herz: 'Herz', leber: 'Leber', schlaf: 'Schlaf', laune: 'Laune' };
      Object.keys(HEALTH_NAMES).forEach(function (k) {
        var v = result.healthGain[k];
        if (v > 0) rows.appendChild(row(HEALTH_NAMES[k], '+' + util.formatNum(v, 1)));
      });
    }
    if (result.recovery > 0) {
      rows.appendChild(row('Verspannung gelöst',
        '−' + Math.round(result.recovery * 100) + ' % Ermüdung'));
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
