/* Shop: laufende Kuren oben, darunter das Sortiment nach Stufen. */
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

  function activePanel() {
    var courses = MF.game.stats.activeCourses();
    var s = state();
    var panel = el('section.active-panel');

    panel.appendChild(el('div.section-title', { text: 'Laufende Kuren' }));

    if (!courses.length && !s.crash) {
      panel.appendChild(el('p.hint', {
        text: s.stats.natural
          ? 'Nichts aktiv. Der Natural-Bonus läuft: +15 % Wachstum, +10 % Erholung.'
          : 'Nichts aktiv. Der Körper erholt sich schneller als sonst.'
      }));
      return panel;
    }

    courses.forEach(function (c) {
      var pct = (c.daysLeft / c.total) * 100;
      panel.appendChild(el('div.course', null, [
        el('div.course__icon', { text: c.def.icon }),
        el('div.course__body', null, [
          el('div.course__name', { text: c.def.name }),
          el('div.bar.bar--course', null, [
            el('div.bar__fill', { style: 'width:' + pct.toFixed(0) + '%' })
          ])
        ]),
        el('div.course__days', { text: c.daysLeft + ' T' })
      ]));
    });

    if (s.crash) {
      panel.appendChild(el('div.course.course--crash', null, [
        el('div.course__icon', { text: '📉' }),
        el('div.course__body', null, [
          el('div.course__name', { text: 'Einbruch nach ' + s.crash.name }),
          el('div.course__sub', { text: 'Weniger Wachstum, Masse geht zurück.' })
        ]),
        el('div.course__days', { text: s.crash.daysLeft + ' T' })
      ]));
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

  function render(container) {
    util.clear(container);
    container.appendChild(activePanel());

    Object.keys(MF.data.supplements.tiers)
      .sort(function (a, b) {
        return MF.data.supplements.tiers[a].order - MF.data.supplements.tiers[b].order;
      })
      .forEach(function (tier) {
        var meta = MF.data.supplements.tiers[tier];
        var items = MF.data.supplements.byTier(tier);
        if (!items.length) return;

        container.appendChild(el('div.section-title', { text: meta.name }));
        container.appendChild(el('p.hint', { text: meta.hint }));

        var grid = el('div.grid');
        items.forEach(function (def) { grid.appendChild(itemCard(def)); });
        container.appendChild(grid);
      });
  }

  MF.ui.router.register('shop', { elementId: 'screen-shop', render: render });
})(window.MacFit);
