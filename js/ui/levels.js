/* Die Levelleiter als Fenster: was erreicht ist, was als Naechstes kommt —
   und ab wann nur noch eine Zahl dasteht.

   Gezeigt wird bewusst nicht alles. Die naechsten ZWEI Stufen stehen mit
   Titel, Werten und Freischaltungen da; alles darueber nur als Nummer mit
   Schloss. So sieht man, dass es weitergeht und wie weit noch, ohne dass
   das Spiel sich selbst vorwegnimmt.

   Aufgerufen wird das Fenster von zwei Stellen, beide ueber die Levelzahl:
   dem Lv-Chip in der Kopfleiste (also von jedem Bildschirm aus) und der
   Zeile unter der Muskelmasse im Koerper-Bildschirm. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;

  /* Wie viele Stufen im Voraus vollstaendig zu sehen sind. */
  var PREVIEW = 2;

  function state() { return MF.game.state.get(); }

  /* Was diese Stufe neu bringt — Geraete, Shop, Theke, Coaching. */
  function unlockText(level) {
    var items = MF.data.levels.unlocksAt(level);
    if (!items.length) return '';
    return items.map(function (i) { return i.icon + ' ' + i.name; }).join(' · ');
  }

  function row(def, current, xp) {
    var ahead = def.level - current;

    /* Ab drei Stufen im Voraus bleibt nur die Zahl. */
    if (ahead > PREVIEW) {
      return el('div.lvl-row.is-locked', null, [
        el('div.lvl-row__head', null, [
          el('span.lvl-row__no', { text: 'Lv ' + def.level }),
          el('span.lvl-row__lock', { text: '🔒' })
        ])
      ]);
    }

    var reached = ahead <= 0;
    var now = ahead === 0;

    var head = [
      el('span.lvl-row__no', { text: 'Lv ' + def.level }),
      el('span.lvl-row__title', { text: def.title })
    ];
    if (now) {
      head.push(el('span.lvl-row__badge', { text: 'jetzt' }));
    } else if (!reached) {
      head.push(el('span.lvl-row__xp', {
        text: 'noch ' + util.formatNum(Math.max(0, def.xp - xp)) + ' XP'
      }));
    }

    var cls = '.lvl-row' + (now ? '.is-now' : (reached ? '.is-done' : '.is-next'));
    var r = el('div' + cls, null, [el('div.lvl-row__head', null, head)]);

    /* Erledigte Stufen bleiben eine einzige Zeile. Ihre Geraete stehen im
       Gym und ihre Ware im Shop — sie hier noch einmal aufzuzaehlen macht
       die Leiter nur so lang, dass man an dem vorbeiscrollt, worum es
       geht: der eigenen Stufe und den beiden naechsten. */
    if (reached) return r;

    r.appendChild(el('span.lvl-row__meta', {
      text: def.energy + ' Energie · ' + util.formatMoney(def.income) + ' pro Tag'
    }));

    /* Nur was noch kommt — was die aktuelle Stufe gebracht hat, ist da. */
    if (!now) {
      var un = unlockText(def.level);
      if (un) r.appendChild(el('span.lvl-row__unlock', { text: un }));
    }

    return r;
  }

  function show() {
    var s = state();
    if (!s) return;

    var current = s.level;
    var max = MF.data.levels.MAX;
    var body = el('div');

    var list = el('div.lvl');
    MF.data.levels.list.forEach(function (def) {
      list.appendChild(row(def, current, s.xp));
    });
    body.appendChild(list);

    body.appendChild(el('p.hint', {
      text: MF.game.progression.isMaxLevel()
        ? 'Mehr geht nicht — Stufe ' + max + ' ist die letzte. Ab hier zählen '
          + 'nur noch Masse, Index und die Bühne.'
        : 'Die nächsten zwei Stufen stehen offen da. Was danach kommt, '
          + 'verrät das Studio erst, wenn du näher dran bist.'
    }));

    MF.ui.modal.open({
      title: 'Level ' + current + ' von ' + max,
      subtitle: MF.game.progression.currentTitle(),
      body: body,
      actions: [{ label: 'Alles klar', tone: 'primary' }]
    });
  }

  MF.ui.levels = { show: show, PREVIEW: PREVIEW };
})(window.MacFit);
