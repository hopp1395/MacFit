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

  /* Laeuft gerade irgendetwas — Kur, Einbruch oder Abo? */
  function hasRunning() {
    var s = state();
    return MF.game.stats.activeCourses().length > 0 || !!s.crash
        || MF.game.abos.planActive() || MF.game.abos.trainerActive();
  }

  function shopTab() {
    var tab = state().settings.shopTab || 'alle';
    /* Der Laufend-Chip verschwindet, wenn nichts mehr laeuft — die
       gespeicherte Auswahl darf dann nicht ins Leere zeigen. */
    if (tab === 'laufend' && !hasRunning()) return 'alle';
    return tab;
  }

  function shopTabs() {
    var wrap = el('div.segmented.segmented--compact.shoptabs', { id: 'shop-tabs' });
    var tabs = [{ key: 'alle', name: 'Alle' }];
    if (hasRunning()) tabs.push({ key: 'laufend', name: 'Laufend' });
    Object.keys(MF.data.supplements.tiers)
      .sort(function (a, b) {
        return MF.data.supplements.tiers[a].order - MF.data.supplements.tiers[b].order;
      })
      .forEach(function (tier) {
        tabs.push({ key: tier, name: MF.data.supplements.tiers[tier].name });
      });
    tabs.push({ key: 'coaching', name: 'Coaching' });

    tabs.forEach(function (t) {
      var btn = el('button.segmented__btn' + (shopTab() === t.key ? '.is-active' : ''), {
        type: 'button', text: t.name
      });
      util.onTap(btn, function () {
        state().settings.shopTab = t.key;
        MF.game.state.saveSoon();
        MF.ui.router.refresh('shop');
      });
      wrap.appendChild(btn);
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
     Shop-Karte, nur als Fenster: Beschreibung, Wirkungen, Restlaufzeit. */
  function showInfo(def, statusText) {
    var body = el('div');
    body.appendChild(el('p.card__desc', { text: def.desc }));
    if (def.effects) body.appendChild(effectTags(def));
    if (def.crash) {
      body.appendChild(el('p.card__warning', {
        text: '⚠ Danach ' + def.crash + ' Tage Einbruch: Wachstum halbiert, Masse geht zurück.'
      }));
    }
    if (statusText) body.appendChild(el('p.hint', { text: statusText }));
    MF.ui.modal.open({
      title: def.icon + ' ' + def.name,
      body: body,
      actions: [{ label: 'Alles klar', tone: 'primary' }]
    });
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
        showInfo(plan, 'Noch ' + state().coach.planDays + ' von ' + plan.days + ' Tagen — '
          + (state().coach.planAuto
              ? 'verlängert sich danach automatisch für ' + util.formatMoney(plan.price) + '.'
              : 'läuft danach aus (Verlängerung ist abgewählt).'));
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
        showInfo(trainer, util.formatMoney(trainer.price) + ' pro Nacht, solange er engagiert ist. '
          + 'Kündigen jederzeit über die Coaching-Karte.');
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
        showInfo(c.def, 'Noch ' + c.daysLeft + ' von ' + c.total + ' Tagen.');
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

    /* Laufendes stoert beim Stoebern — es hat seinen eigenen Chip und
       taucht im Sortiment nicht mehr auf. */
    if (tab === 'laufend') {
      container.appendChild(activePanel());
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
})(window.MacFit);
