/* Shop: Kategorie-Chips oben, dann laufende Kuren und Abos, darunter das
   Sortiment. Die Chips filtern auf eine Stufe — bei sechs Kategorien findet
   man sonst nichts mehr wieder. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;

  var EFFECT_LABELS = {
    growth: 'Wachstum',
    regen: 'Erholung',
    energy: 'Energie',
    focus: 'Trefferzone'
  };
  var HEALTH_LABELS = { herz: 'Herz', leber: 'Leber', schlaf: 'Schlaf', laune: 'Laune' };

  function state() { return MF.game.state.get(); }

  /* ---------- Kategorie-Chips ---------------------------------------------- */

  function shopTab() {
    return state().settings.shopTab || 'alle';
  }

  /* Wie viele Posten laufen gerade — fuer den Untertitel der Laufend-Kachel. */
  function runningCount() {
    var s = state();
    var n = MF.game.stats.activeCourses().length;
    if (s.crash) n += 1;
    if (MF.game.abos.planActive()) n += 1;
    if (MF.game.abos.trainerActive()) n += 1;
    return n;
  }

  /* Die Bereiche als Kachelraster — dieselbe Bauart wie die Muskelgruppen
     im Gym, damit sich beide Auswahlflaechen gleich anfuehlen. */
  function shopTabs() {
    var wrap = el('div.mgrid.shopgrid', { id: 'shop-tabs' });
    var total = MF.data.supplements.list.length + MF.data.abos.list.length;

    var board = MF.game.challenge.today();
    var tabs = [
      { key: 'alle', name: 'Alle', sub: total + ' Artikel' },
      { key: 'laufend', name: 'Laufend', sub: runningCount() + ' aktiv' },
      { key: 'brett', name: 'Brett',
        sub: MF.game.challenge.isDone()
          ? 'erledigt'
          : '+' + util.formatMoney(MF.game.challenge.reward(board).money) }
    ];
    Object.keys(MF.data.supplements.tiers)
      .sort(function (a, b) {
        return MF.data.supplements.tiers[a].order - MF.data.supplements.tiers[b].order;
      })
      .forEach(function (tier) {
        var n = MF.data.supplements.byTier(tier).length;
        tabs.push({
          key: tier,
          name: MF.data.supplements.tiers[tier].name,
          sub: n + ' Artikel'
        });
      });
    tabs.push({
      key: 'coaching', name: 'Coaching',
      sub: MF.data.abos.list.length + ' Angebote'
    });

    tabs.forEach(function (t) {
      var tile = el('button.mtile' + (shopTab() === t.key ? '.is-active' : ''),
        { type: 'button' }, [
          el('span.mtile__name', { text: t.name }),
          el('span.mtile__sub', { text: t.sub })
        ]);
      util.onTap(tile, function () {
        state().settings.shopTab = t.key;
        MF.game.state.saveSoon();
        MF.ui.router.refresh('shop');
      });
      wrap.appendChild(tile);
    });
    return wrap;
  }

  function effectTags(def) {
    var wrap = el('div.card__meta');
    Object.keys(EFFECT_LABELS).forEach(function (k) {
      var v = def.effects[k];
      if (!v) return;
      var text = EFFECT_LABELS[k] + ' ' + (v > 0 ? '+' : '') +
        (k === 'energy' ? Math.round(v) : Math.round(v * 100) + '%');
      wrap.appendChild(el('span.tag' + (v > 0 ? '.tag--good' : '.tag--bad'), { text: text }));
    });
    Object.keys(HEALTH_LABELS).forEach(function (k) {
      var v = def.health[k];
      if (!v) return;
      wrap.appendChild(el('span.tag' + (v > 0 ? '.tag--good' : '.tag--bad'), {
        text: HEALTH_LABELS[k] + ' ' + (v > 0 ? '+' : '') + util.formatNum(v, 1) + '/Nacht'
      }));
    });
    return wrap;
  }

  /* Erklaerung eines laufenden Postens — dieselben Infos wie auf der
     Shop-Karte, nur als Fenster. Die Restlaufzeit steht abgesetzt in einem
     eigenen Block unter einer Trennlinie, mit Balken wie in der Liste.
     status: { text, daysLeft, total } — ohne total gibt es nur den Text. */
  function showInfo(def, status) {
    var body = el('div');
    body.appendChild(el('p.card__desc', { text: def.desc }));
    if (def.effects) body.appendChild(effectTags(def));
    if (def.crash) {
      body.appendChild(el('p.card__warning', {
        text: '⚠ Danach ' + def.crash + ' Tage Einbruch: Wachstum halbiert, Masse geht zurück.'
      }));
    }
    if (status && status.text) {
      var block = el('div.runinfo');
      if (status.total) {
        var pct = (status.daysLeft / status.total) * 100;
        block.appendChild(el('div.bar.bar--course', null, [
          el('div.bar__fill', { style: 'width:' + pct.toFixed(0) + '%' })
        ]));
      }
      block.appendChild(el('p.runinfo__text', { text: status.text }));
      body.appendChild(block);
    }
    MF.ui.modal.open({
      title: def.icon + ' ' + def.name,
      body: body,
      actions: [{ label: 'Alles klar', tone: 'primary' }]
    });
  }

  /* Der Zettel vom Schwarzen Brett. Er haengt im Shop statt im Gym — dort
     soll nur stehen, was fuers Training selbst zaehlt. Eine Zeile, alles
     Weitere im Fenster hinter dem Tipp. */
  function boardNote() {
    var def = MF.game.challenge.today();
    if (!def) return null;
    var done = MF.game.challenge.isDone();
    var pay = MF.game.challenge.reward(def);

    var note = el('div.board' + (done ? '.is-done' : ''), null, [
      el('span.board__pin', { text: done ? '✔' : '📌' }),
      el('span.board__text', { text: def.short || def.title }),
      el('span.board__prize', {
        text: done ? 'kassiert' : '+' + util.formatMoney(pay.money)
      })
    ]);
    util.onTap(note, function () { showBoardInfo(def, done, pay); });
    return note;
  }

  function showBoardInfo(def, done, pay, onClose) {
    var body = el('div');
    body.appendChild(el('p.card__desc', { text: def.text }));

    body.appendChild(el('div.card__meta', null, [
      el('span.tag.tag--good', { text: '+' + util.formatMoney(pay.money) }),
      el('span.tag.tag--good', { text: '+' + pay.xp + ' XP' }),
      el('span.tag.tag--good', { text: 'Laune +3' })
    ]));

    var status;
    if (done) {
      status = 'Erledigt und kassiert. Morgen früh hängt der nächste Zettel aus.';
    } else if (def.kind === 'sets') {
      status = 'Bisher heute: ' + MF.game.day.setsToday() + ' von ' + def.n + ' Sätzen.';
    } else {
      status = 'Noch offen — es zählt jeder Satz an jedem Gerät. '
             + 'Entscheidend ist die Ausführung, nicht die Muskelgruppe.';
    }

    body.appendChild(el('div.runinfo', null, [
      el('p.runinfo__text', {
        text: status + ' Jeden Tag hängt genau ein Zettel aus; schwerere kommen '
            + 'mit steigendem Fitness-Index dazu.'
      })
    ]));

    MF.ui.modal.open({
      title: (done ? '✔ ' : '📌 ') + def.title,
      subtitle: 'Schwarzes Brett',
      body: body,
      /* onClose haengt am Eingang dran: dort folgt danach ggf. der Hinweis
         auf die E-Mail. */
      actions: [{ label: 'Alles klar', tone: 'primary', onTap: onClose || null }]
    });
  }

  /* Eigener Bereich fuers Brett — ein Zettel, mehr haengt da nicht. */
  function boardPanel() {
    var panel = el('section.active-panel');
    panel.appendChild(el('div.section-title', { text: 'Schwarzes Brett' }));

    var note = boardNote();
    if (note) panel.appendChild(note);

    var def = MF.game.challenge.today();
    panel.appendChild(el('p.hint', {
      text: MF.game.challenge.isDone()
        ? 'Heute erledigt und kassiert. Morgen früh hängt der nächste Zettel aus.'
        : def.text + ' Es zählt jeder Satz an jedem Gerät — antippen für Prämie '
          + 'und Fortschritt.'
    }));

    return panel;
  }

  function activePanel() {
    var courses = MF.game.stats.activeCourses();
    var s = state();
    var panel = el('section.active-panel');

    panel.appendChild(el('div.section-title', { text: 'Laufend' }));

    /* Abos zuerst — sie laufen laenger als jede Kur. */
    if (MF.game.abos.planActive()) {
      var plan = MF.data.abos.get('trainingsplan');
      var ppct = (s.coach.planDays / plan.days) * 100;
      var planRow = el('div.course', null, [
        el('div.course__icon', { text: plan.icon }),
        el('div.course__body', null, [
          el('div.course__name', { text: plan.name }),
          el('div.bar.bar--course', null, [
            el('div.bar__fill', { style: 'width:' + ppct.toFixed(0) + '%' })
          ])
        ]),
        el('div.course__days', { text: s.coach.planDays + ' T' })
      ]);
      util.onTap(planRow, function () {
        showInfo(plan, {
          text: 'Noch ' + state().coach.planDays + ' von ' + plan.days + ' Tagen — '
            + (state().coach.planAuto
                ? 'verlängert sich danach automatisch für ' + util.formatMoney(plan.price) + '.'
                : 'läuft danach aus (Verlängerung ist abgewählt).'),
          daysLeft: state().coach.planDays,
          total: plan.days
        });
      });
      panel.appendChild(planRow);
    }
    if (MF.game.abos.trainerActive()) {
      var trainer = MF.data.abos.get('trainer');
      var trainerRow = el('div.course', null, [
        el('div.course__icon', { text: trainer.icon }),
        el('div.course__body', null, [
          el('div.course__name', { text: trainer.name }),
          el('div.course__sub', { text: util.formatMoney(trainer.price) + ' pro Tag, jederzeit kündbar.' })
        ]),
        el('div.course__days', { text: '∞' })
      ]);
      util.onTap(trainerRow, function () {
        showInfo(trainer, {
          text: util.formatMoney(trainer.price) + ' pro Nacht, solange er engagiert ist. '
            + 'Kündigen jederzeit über die Coaching-Karte.'
        });
      });
      panel.appendChild(trainerRow);
    }

    if (!courses.length && !s.crash) {
      if (MF.game.abos.planActive() || MF.game.abos.trainerActive()) return panel;
      panel.appendChild(el('p.hint', {
        text: s.stats.natural
          ? 'Nichts aktiv. Der Natural-Bonus läuft: +15 % Wachstum, +10 % Erholung.'
          : 'Nichts aktiv. Der Körper erholt sich schneller als sonst.'
      }));
      return panel;
    }

    courses.forEach(function (c) {
      var pct = (c.daysLeft / c.total) * 100;
      var row = el('div.course', null, [
        el('div.course__icon', { text: c.def.icon }),
        el('div.course__body', null, [
          el('div.course__name', { text: c.def.name }),
          el('div.bar.bar--course', null, [
            el('div.bar__fill', { style: 'width:' + pct.toFixed(0) + '%' })
          ])
        ]),
        el('div.course__days', { text: c.daysLeft + ' T' })
      ]);
      util.onTap(row, function () {
        showInfo(c.def, {
          text: 'Noch ' + c.daysLeft + ' von ' + c.total + ' Tagen.',
          daysLeft: c.daysLeft,
          total: c.total
        });
      });
      panel.appendChild(row);
    });

    if (s.crash) {
      var crashRow = el('div.course.course--crash', null, [
        el('div.course__icon', { text: '📉' }),
        el('div.course__body', null, [
          el('div.course__name', { text: 'Einbruch nach ' + s.crash.name }),
          el('div.course__sub', { text: 'Weniger Wachstum, Masse geht zurück.' })
        ]),
        el('div.course__days', { text: s.crash.daysLeft + ' T' })
      ]);
      util.onTap(crashRow, function () {
        MF.ui.modal.open({
          title: '📉 Einbruch',
          body: el('p.card__desc', {
            text: 'Nach ' + state().crash.name + ' zieht der Körper die Notbremse: '
                + 'halbes Wachstum, ein Teil der Masse geht jede Nacht verloren. '
                + 'Noch ' + state().crash.daysLeft + ' Tage — durchhalten.'
          }),
          actions: [{ label: 'Alles klar', tone: 'primary' }]
        });
      });
      panel.appendChild(crashRow);
    }

    return panel;
  }

  function itemCard(def) {
    var check = MF.game.supplements.canBuy(def);
    var unlocked = MF.game.supplements.isUnlocked(def);
    var active = MF.game.supplements.isActive(def.id);

    var card = el('article.card.card--shop' + (unlocked ? '' : '.card--locked'));

    card.appendChild(el('div.card__head', null, [
      el('div.card__icon', { text: def.icon }),
      el('div.card__titles', null, [
        el('h3.card__title', { text: def.name }),
        el('div.card__muscle', { text: def.days + ' Tage · ' + MF.data.supplements.tiers[def.tier].name })
      ]),
      el('div.card__price' + (MF.game.economy.canAfford(def.price) ? '' : '.is-bad'), {
        text: util.formatMoney(def.price)
      })
    ]));

    if (!unlocked) {
      card.appendChild(el('p.card__desc', { text: 'Wird ab Level ' + def.unlockLevel + ' freigeschaltet.' }));
      return card;
    }

    card.appendChild(el('p.card__desc', { text: def.desc }));
    card.appendChild(effectTags(def));

    if (def.crash) {
      card.appendChild(el('p.card__warning', {
        text: '⚠ Danach ' + def.crash + ' Tage Einbruch: Wachstum halbiert, Masse geht zurück.'
      }));
    }

    var btn = el('button.btn.btn--primary.card__action', {
      type: 'button',
      text: active ? 'Läuft bereits' : (check.ok ? 'Kaufen & starten' : check.reason)
    });
    if (!check.ok) btn.classList.add('is-disabled');

    util.onTap(btn, function () {
      if (!check.ok) {
        MF.ui.toast.show(check.reason, 'warn');
        return;
      }
      if (def.tier === 'anabol' && state().stats.natural) {
        MF.ui.modal.confirm({
          title: 'Sicher?',
          text: 'Mit der ersten anabolen Kur ist der Natural-Bonus für diesen Spielstand '
              + 'endgültig weg. Die Gains werden groß, die Werte schlecht.',
          confirmLabel: 'Trotzdem kaufen',
          cancelLabel: 'Lieber nicht',
          onConfirm: function () { doBuy(def); }
        });
        return;
      }
      doBuy(def);
    });
    card.appendChild(btn);

    return card;
  }

  function doBuy(def) {
    var res = MF.game.supplements.buy(def);
    if (!res.ok) {
      MF.ui.toast.show(res.reason, 'warn');
      return;
    }
    MF.core.audio.sfx('coin');
    MF.ui.toast.show(def.name + ' gestartet — ' + def.days + ' Tage.', 'good');
    MF.ui.hud.render();
    MF.ui.router.refresh('shop');
  }

  /* ---------- Coaching-Abos ------------------------------------------------ */

  function aboCard(def) {
    var s = state();
    var check = MF.game.abos.canBuy(def);
    var unlocked = MF.game.abos.isUnlocked(def);
    var active = MF.game.abos.isActive(def.id);
    var isPlan = def.id === 'trainingsplan';

    var card = el('article.card.card--shop'
      + (unlocked ? '' : '.card--locked')
      + (active ? '.card--running' : ''));

    card.appendChild(el('div.card__head', null, [
      el('div.card__icon', { text: def.icon }),
      el('div.card__titles', null, [
        el('h3.card__title', { text: def.name }),
        el('div.card__muscle', { text: isPlan ? 'Abo · verlängert sich' : 'Tagessatz · kündbar' })
      ]),
      el('div.card__price' + (MF.game.economy.canAfford(def.price) ? '' : '.is-bad'), {
        text: util.formatMoney(def.price) + (isPlan ? ' / ' + def.days + ' Tage' : ' / Tag')
      })
    ]));

    if (!unlocked) {
      card.appendChild(el('p.card__desc', { text: 'Wird ab Level ' + def.unlockLevel + ' freigeschaltet.' }));
      return card;
    }

    card.appendChild(el('p.card__desc', { text: def.desc }));

    if (active && isPlan) {
      /* Laufendes Plan-Abo: kein Kauf-Knopf, dafuer der Verlaengerungs-Schalter. */
      card.appendChild(el('button.btn.btn--primary.card__action.is-disabled', {
        type: 'button', text: 'Läuft noch ' + s.coach.planDays + ' Tage'
      }));
      var autoBtn = el('button.btn.btn--ghost.btn--slim', {
        type: 'button',
        text: (s.coach.planAuto ? '✓ ' : '✕ ') + 'Automatisch verlängern'
      });
      util.onTap(autoBtn, function () {
        MF.game.abos.setPlanAuto(!s.coach.planAuto);
        MF.ui.router.refresh('shop');
      });
      card.appendChild(autoBtn);
      return card;
    }

    if (active && !isPlan) {
      /* Laufender Trainer: kuendigen statt kaufen. */
      var cancelBtn = el('button.btn.btn--ghost.card__action', { type: 'button', text: 'Kündigen' });
      util.onTap(cancelBtn, function () {
        MF.ui.modal.confirm({
          title: 'Trainer kündigen?',
          text: 'Ab sofort keine Analyse und kein angepasster Plan mehr. '
              + 'Der heutige Tagessatz ist weg.',
          confirmLabel: 'Kündigen',
          cancelLabel: 'Behalten',
          onConfirm: function () {
            MF.game.abos.cancelTrainer();
            MF.ui.toast.show('Trainer gekündigt.', 'warn');
            MF.ui.router.refresh('shop');
          }
        });
      });
      card.appendChild(cancelBtn);
      return card;
    }

    var btn = el('button.btn.btn--primary.card__action', {
      type: 'button',
      text: check.ok ? (isPlan ? 'Abo starten' : 'Engagieren') : check.reason
    });
    if (!check.ok) btn.classList.add('is-disabled');
    util.onTap(btn, function () {
      if (!check.ok) {
        MF.ui.toast.show(check.reason, 'warn');
        return;
      }
      var res = MF.game.abos.buy(def);
      if (!res.ok) {
        MF.ui.toast.show(res.reason, 'warn');
        return;
      }
      MF.core.audio.sfx('coin');
      MF.ui.toast.show(isPlan
        ? 'Trainingsplan läuft — ' + def.days + ' Tage, verlängert sich automatisch.'
        : 'Trainer engagiert — der erste Tagessatz ist bezahlt.', 'good');
      MF.ui.hud.render();
      MF.ui.router.refresh('shop');
    });
    card.appendChild(btn);

    return card;
  }

  function render(container) {
    util.clear(container);
    var tab = shopTab();
    container.appendChild(shopTabs());

    /* Laufendes und der Zettel stoeren beim Stoebern — beide haben ihre
       eigene Kachel und tauchen im Sortiment nicht mehr auf. */
    if (tab === 'laufend') {
      container.appendChild(activePanel());
      return;
    }
    if (tab === 'brett') {
      container.appendChild(boardPanel());
      return;
    }

    Object.keys(MF.data.supplements.tiers)
      .sort(function (a, b) {
        return MF.data.supplements.tiers[a].order - MF.data.supplements.tiers[b].order;
      })
      .forEach(function (tier) {
        if (tab !== 'alle' && tab !== tier) return;
        var meta = MF.data.supplements.tiers[tier];
        var items = MF.data.supplements.byTier(tier);
        if (!items.length) return;

        container.appendChild(el('div.section-title', { text: meta.name }));
        container.appendChild(el('p.hint', { text: meta.hint }));

        var grid = el('div.grid');
        items.forEach(function (def) { grid.appendChild(itemCard(def)); });
        container.appendChild(grid);
      });

    if (tab === 'alle' || tab === 'coaching') {
      container.appendChild(el('div.section-title', { text: 'Coaching' }));
      container.appendChild(el('p.hint', {
        text: 'Wissen statt Pulver. Läuft, bis du kündigst oder das Geld ausgeht.'
      }));
      var cgrid = el('div.grid');
      MF.data.abos.list.forEach(function (def) { cgrid.appendChild(aboCard(def)); });
      container.appendChild(cgrid);
    }
  }

  MF.ui.router.register('shop', { elementId: 'screen-shop', render: render });

  /* Der Zettel wird auch am Eingang gezeigt (siehe main.js) — deshalb liegt
     die Darstellung hier offen. */
  MF.ui.shop = {
    showBoard: function (onClose) {
      var def = MF.game.challenge.today();
      if (!def) { if (onClose) onClose(); return; }
      showBoardInfo(def, MF.game.challenge.isDone(), MF.game.challenge.reward(def), onClose);
    }
  };
})(window.MacFit);
