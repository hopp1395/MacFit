/* Der Rivale, wie man ihn sieht: eine Ansprache am Eingang und ein Vergleich
   im Körper-Bildschirm. Gerechnet wird alles in game/rival.js.

   Am Eingang gilt: ein Fenster gibt es nur, wenn wirklich etwas passiert ist
   — beim ersten Treffen und wenn sich die Führung gedreht hat. Sonst reicht
   ein Toast; drei Fenster hintereinander will beim Reinkommen niemand. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;

  function state() { return MF.game.state.get(); }

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
    var box = el('div.rival__cmp');

    function pair(label, mine, theirs, format) {
      var max = Math.max(mine, theirs, 0.001);
      var rows = [
        { name: 'Du', value: mine, mine: true },
        { name: MF.game.rival.def().short, value: theirs, mine: false }
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

    pair('Muskelmasse', MF.game.stats.muscleMass(), MF.game.rival.mass(),
      function (v) { return util.formatKg(v); });
    pair('Fitness-Index', MF.game.fitness.index(), MF.game.rival.fit(),
      function (v) { return String(Math.round(v)); });

    return box;
  }

  function standingText() {
    var st = MF.game.rival.standing();
    var d = MF.game.rival.def();
    var diff = Math.abs(st.diff);
    if (st.close) return 'Ihr liegt gleichauf — es entscheidet der nächste Trainingstag.';
    if (st.lead) {
      return 'Du liegst ' + util.formatKg(diff) + ' vor ' + d.short
        + '. Dranbleiben, der Abstand hält nicht von allein.';
    }
    return d.short + ' liegt ' + util.formatKg(diff)
      + ' vor dir. Aufholen geht nur über Sätze.';
  }

  /* Der Block im Körper-Bildschirm — oder null, solange es keinen Rivalen gibt. */
  function panel() {
    if (!MF.game.rival.active()) return null;
    var d = MF.game.rival.ensure();
    if (!d) return null;
    var s = state();

    var box = el('section.rival', { id: 'rival-panel' });
    box.appendChild(el('div.section-title', null, [
      el('span', { text: 'Dein Rivale' }),
      el('span.section-title__note', { text: 'seit Tag ' + s.rival.since })
    ]));

    box.appendChild(el('div.rival__head', null, [
      el('div.rival__icon', { text: d.icon }),
      el('div.rival__who', null, [
        el('div.rival__name', { text: d.name }),
        el('div.rival__trait', { text: d.trait })
      ]),
      el('div.rival__sets', null, [
        el('strong', { text: String(s.rival.sets) }),
        el('span', { text: 'Sätze' })
      ])
    ]));

    box.appendChild(el('p.rival__quote', { text: '„' + MF.game.rival.line() + '“' }));
    box.appendChild(compare());
    box.appendChild(el('p.hint', { text: standingText() }));
    return box;
  }

  /* Die Ansprache am Eingang. onDone läuft in jedem Fall — daran hängt die
     nächste Einblendung. Rückgabe: ob ein Fenster aufging. */
  function greet(onDone) {
    var go = onDone || function () {};
    if (!MF.game.rival.active()) { go(); return false; }

    var d = MF.game.rival.ensure();
    var s = state();
    if (!d || s.rival.greetedDay === s.day) { go(); return false; }

    var first = !s.rival.greetedDay;
    var flip = MF.game.rival.takeFlip();
    s.rival.greetedDay = s.day;
    MF.game.state.saveSoon();

    var key = flip || (first ? 'first' : (wasLazy() ? 'lazy' : MF.game.rival.standing().key));
    var text = MF.game.rival.line(key);

    /* Alltag: ein Toast reicht. Nur Erstbegegnung und Führungswechsel sind
       ein Fenster wert. */
    if (!first && !flip) {
      /* Ohne Farbton: der Rivale ist weder Lob noch Warnung. */
      MF.ui.toast.show(d.icon + ' ' + d.short + ': „' + text + '“');
      go();
      return false;
    }

    var body = el('div');
    body.appendChild(el('p.rival__quote', { text: '„' + text + '“' }));
    if (first) {
      body.appendChild(el('p.card__desc', { text: d.trait }));
    }
    body.appendChild(compare());
    body.appendChild(el('p.hint', { text: standingText() }));

    MF.ui.modal.open({
      title: d.icon + ' ' + d.name,
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

  MF.ui.rival = { greet: greet, panel: panel, compare: compare };
})(window.MacFit);
