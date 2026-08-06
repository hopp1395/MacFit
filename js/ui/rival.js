/* Der Rivale, wie man ihn sieht: eine Ansprache am Eingang und ein Vergleich
   im Körper-Bildschirm. Gerechnet wird alles in game/rival.js.

   Hier steht bewusst nirgends, ob der Rivale ein NPC oder ein Freund ist —
   gelesen wird nur MF.game.rival.view(). Wenn später echte Freunde dazu
   kommen, ändert sich an dieser Datei nur der Sonderfall „redet nicht": ein
   Freund hat keine Sprüche, dafür ein Datum vom letzten Abgleich.

   Am Eingang gilt: ein Fenster gibt es nur, wenn wirklich etwas passiert ist
   — beim ersten Treffen und wenn sich die Führung gedreht hat. Sonst reicht
   ein Toast; drei Fenster hintereinander will beim Reinkommen niemand. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;

  var px = MF.ui.pixel;
  var C = px.colors;
  var SCENE = 180;   /* dieselbe Kantenlänge wie im Posenbild */

  function state() { return MF.game.state.get(); }

  /* ---------- Sein Posenbild ------------------------------------------------
     Der Rivale posiert mit seinen eigenen Maßen: aus seiner Masse werden die
     acht Partiegrößen zurückgerechnet (game/rival.js body()), verteilt nach
     der Figur — bei Kevin also viel Brust und wenig Bein. Gezeichnet wird
     mit demselben Code wie das eigene Posenbild. */

  /* Eine Wand mit Scheinwerferkegel, wie beim Teilen-Bild — nur ohne Plakat,
     das der Figur auf dem Kopf sitzt. */
  function backdrop(ctx) {
    var horizon = 128;
    px.rect(ctx, 0, 0, SCENE, horizon, C.wallDark);
    for (var x = 0; x < SCENE; x += 26) px.line(ctx, x, 0, x, horizon, 1, C.wall);
    px.dither(ctx, 34, 0, 112, horizon, C.wall, 3);
    px.dither(ctx, 56, 0, 68, horizon, C.wallLit, 4);
    px.rect(ctx, 0, horizon, SCENE, 2, C.ink);
    px.rect(ctx, 0, horizon + 2, SCENE, SCENE - horizon - 2, C.floorDark);
    px.dither(ctx, 0, horizon + 2, SCENE, SCENE - horizon - 2, C.floor, 3);
  }

  /* Zufällig, aber ohne die Kür: die ist die Belohnung des Spielers für
     Level 10 und soll nicht beim Vorstellen eines Rivalen verheizt werden. */
  function randomPose() {
    var pool = MF.ui.poses.list.filter(function (p) { return !p.level || p.level <= 1; });
    if (!pool.length) pool = MF.ui.poses.list;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function portrait() {
    var v = MF.game.rival.view();
    var body = MF.game.rival.body();
    if (!v || !body) return null;

    var pose = randomPose();
    var stage = el('div.rival__stage');
    var surface = px.create(stage, SCENE, SCENE, 'rival__pix');
    if (!surface.ctx) return stage;

    backdrop(surface.ctx);
    MF.ui.poses.draw(surface.ctx, pose.id, {
      shorts: MF.data.outfits.get(v.outfit).shirt,
      body: body
    });
    surface.present();

    stage.appendChild(el('span.rival__pose-name', { text: pose.name }));
    return stage;
  }

  /* Hat der Spieler am zuletzt abgeschlossenen Tag nichts gemacht? */
  function wasLazy() {
    var h = state().history;
    if (!h.length) return false;
    var last = h[h.length - 1];
    return last.day === state().day - 1 && last.sets === 0;
  }

  /* Die beiden Balken: Masse und Fitness-Index, jeweils Spieler gegen
     Rivale am gemeinsamen Maßstab. */
  function compare() {
    var v = MF.game.rival.view();
    var box = el('div.rival__cmp');

    function pair(label, mine, theirs, format) {
      var max = Math.max(mine, theirs, 0.001);
      var rows = [
        { name: 'Du', value: mine, mine: true },
        { name: v.short, value: theirs, mine: false }
      ];
      box.appendChild(el('div.rival__cmp-title', { text: label }));
      rows.forEach(function (r) {
        box.appendChild(el('div.rival__row' + (r.mine ? '.is-me' : ''), null, [
          el('span.rival__row-name', { text: r.name }),
          el('div.bar.bar--rival', null, [
            el('div.bar__fill', { style: 'width:' + (r.value / max * 100).toFixed(1) + '%' })
          ]),
          el('span.rival__row-value', { text: format(r.value) })
        ]));
      });
    }

    pair('Muskelmasse', MF.game.stats.muscleMass(), v.mass,
      function (m) { return util.formatKg(m); });
    pair('Fitness-Index', MF.game.fitness.index(), v.fit,
      function (m) { return String(Math.round(m)); });

    return box;
  }

  function standingText() {
    var st = MF.game.rival.standing();
    var v = MF.game.rival.view();
    var diff = Math.abs(st.diff);
    if (st.close) return 'Ihr liegt gleichauf — es entscheidet der nächste Trainingstag.';
    if (st.lead) {
      return 'Du liegst ' + util.formatKg(diff) + ' vor ' + v.short
        + '. Dranbleiben, der Abstand hält nicht von allein.';
    }
    return v.short + ' liegt ' + util.formatKg(diff)
      + ' vor dir. Aufholen geht nur über Sätze.';
  }

  /* Der Block im Körper-Bildschirm — oder null, solange es keinen Rivalen gibt. */
  function panel() {
    if (!MF.game.rival.active()) return null;
    var v = MF.game.rival.ensure();
    if (!v) return null;
    var s = state();

    var box = el('section.rival', { id: 'rival-panel' });
    box.appendChild(el('div.section-title', null, [
      el('span', { text: 'Dein Rivale' }),
      el('span.section-title__note', { text: 'seit Tag ' + v.since })
    ]));

    box.appendChild(el('div.rival__head', null, [
      el('div.rival__icon', { text: v.icon }),
      el('div.rival__who', null, [
        el('div.rival__name', { text: v.name }),
        el('div.rival__trait', { text: v.trait })
      ]),
      el('div.rival__sets', null, [
        el('strong', { text: String(v.sets) }),
        el('span', { text: 'Sätze' })
      ])
    ]));

    /* Ein NPC sagt etwas, ein Freund nicht — bei ihm steht dort, wie frisch
       die Zahlen sind. */
    var says = MF.game.rival.line();
    box.appendChild(says
      ? el('p.rival__quote', { text: '„' + says + '“' })
      : el('p.rival__quote', {
          text: v.synced === s.day ? 'Zahlen von heute.'
            : 'Stand von Tag ' + v.synced + '.'
        }));

    box.appendChild(compare());
    box.appendChild(el('p.hint', { text: standingText() }));
    return box;
  }

  /* Die Ansprache am Eingang. onDone läuft in jedem Fall — daran hängt die
     nächste Einblendung. Rückgabe: ob ein Fenster aufging. */
  function greet(onDone) {
    var go = onDone || function () {};
    if (!MF.game.rival.active()) { go(); return false; }

    var v = MF.game.rival.ensure();
    var s = state();
    if (!v || s.rival.greetedDay === s.day) { go(); return false; }

    var first = !s.rival.greetedDay;
    var flip = MF.game.rival.takeFlip();
    s.rival.greetedDay = s.day;
    MF.game.state.saveSoon();

    var key = flip || (first ? 'first' : (wasLazy() ? 'lazy' : MF.game.rival.standing().key));
    var text = MF.game.rival.line(key);

    /* Alltag: ein Toast reicht. Nur Erstbegegnung und Führungswechsel sind
       ein Fenster wert. Ein Freund sagt nichts — dann bleibt der Alltag
       ganz still. */
    if (!first && !flip) {
      if (text) MF.ui.toast.show(v.icon + ' ' + v.short + ': „' + text + '“');
      go();
      return false;
    }

    var body = el('div');
    /* Erst das Bild: beim Vorstellen soll man sehen, gegen wen man antritt. */
    var pic = portrait();
    if (pic) body.appendChild(pic);
    if (text) body.appendChild(el('p.rival__quote', { text: '„' + text + '“' }));
    if (first) body.appendChild(el('p.card__desc', { text: v.trait }));
    body.appendChild(compare());
    body.appendChild(el('p.hint', { text: standingText() }));

    MF.ui.modal.open({
      title: v.icon + ' ' + v.name,
      subtitle: first ? 'Ab heute trainiert ihr nebeneinander'
        : (flip === 'passed' ? 'Du hast die Führung übernommen' : 'Führungswechsel'),
      body: body,
      actions: [
        { label: 'Na dann', tone: 'primary', onTap: go },
        { label: 'Vergleich ansehen', onTap: function () { MF.ui.router.go('stats'); go(); } }
      ]
    });
    return true;
  }

  MF.ui.rival = {
    greet: greet, panel: panel, compare: compare,
    portrait: portrait, randomPose: randomPose
  };
})(window.MacFit);
