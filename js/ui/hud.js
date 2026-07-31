/* Kopfleiste: Tag, Level, Geld, Energie. Wird einmal gebaut und danach
   nur noch mit Werten gefuettert. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;
  var nodes = null;

  function build() {
    var hud = util.byId('hud');
    util.clear(hud);

    var top = el('div.hud__top');
    var brand = el('div.hud__brand', null, [
      el('span.hud__logo', { text: 'Mac' }),
      el('span.hud__logo.hud__logo--alt', { text: 'Fit' })
    ]);
    var day = el('div.hud__day', { id: 'hud-day', text: 'Tag 1' });
    var fit = el('div.hud__fit', { id: 'hud-fit' }, [
      el('span.hud__fit-label', { text: 'FIT' }),
      el('span.hud__fit-value', { id: 'hud-fit-value', text: '0' })
    ]);
    var money = el('div.hud__money', { id: 'hud-money', text: '0 €' });
    var save = el('div.hud__save', {
      id: 'hud-save', title: 'Spielstand wird automatisch gespeichert'
    });
    top.appendChild(brand);
    top.appendChild(save);
    top.appendChild(day);
    top.appendChild(fit);
    top.appendChild(money);

    var levelRow = el('div.hud__row');
    var levelChip = el('div.hud__level', { id: 'hud-level', text: 'Lv 1' });
    var xpTrack = el('div.bar.bar--xp', null, [
      el('div.bar__fill', { id: 'hud-xp-fill' }),
      el('span.bar__label', { id: 'hud-xp-label', text: '' })
    ]);
    levelRow.appendChild(levelChip);
    levelRow.appendChild(xpTrack);

    var energyRow = el('div.hud__row');
    energyRow.appendChild(el('div.hud__icon', { text: '⚡' }));
    energyRow.appendChild(el('div.bar.bar--energy', null, [
      el('div.bar__fill', { id: 'hud-energy-fill' }),
      el('span.bar__label', { id: 'hud-energy-label', text: '' })
    ]));

    hud.appendChild(top);
    hud.appendChild(levelRow);
    hud.appendChild(energyRow);

    nodes = {
      day: util.byId('hud-day'),
      fit: util.byId('hud-fit'),
      fitValue: util.byId('hud-fit-value'),
      money: util.byId('hud-money'),
      level: util.byId('hud-level'),
      xpFill: util.byId('hud-xp-fill'),
      xpLabel: util.byId('hud-xp-label'),
      energyFill: util.byId('hud-energy-fill'),
      energyLabel: util.byId('hud-energy-label')
    };
  }

  function render() {
    if (!nodes) build();
    var s = MF.game.state.get();
    if (!s) return;

    nodes.day.textContent = 'Tag ' + s.day;
    nodes.money.textContent = util.formatMoney(s.money);
    nodes.level.textContent = 'Lv ' + s.level;

    var fit = MF.game.fitness.index();
    nodes.fitValue.textContent = fit;
    nodes.fit.className = 'hud__fit is-' + MF.game.fitness.rank(fit).tone;

    var progress = MF.data.levels.progress(s.xp);
    nodes.xpFill.style.width = (progress * 100).toFixed(1) + '%';
    nodes.xpLabel.textContent = MF.game.progression.isMaxLevel()
      ? MF.game.progression.currentTitle()
      : MF.data.levels.xpToNext(s.xp) + ' XP bis Level ' + (s.level + 1);

    var max = MF.game.stats.energyMax();
    var ratio = util.clamp(s.energy / max, 0, 1);
    nodes.energyFill.style.width = (ratio * 100).toFixed(1) + '%';
    nodes.energyFill.classList.toggle('is-low', ratio < 0.25);
    nodes.energyLabel.textContent = Math.round(s.energy) + ' / ' + max;
  }

  /* Der Punkt blinkt kurz auf, wenn geschrieben wurde — sonst weiß niemand,
     dass automatisch gespeichert wird. Bleibt rot, wenn es nicht geht. */
  var flashTimer = null;

  function flashSave(ok) {
    var node = util.byId('hud-save');
    if (!node) return;

    if (!ok) {
      node.className = 'hud__save is-error';
      node.setAttribute('title', 'Spielstand kann nicht gespeichert werden');
      return;
    }

    node.className = 'hud__save is-on';
    node.setAttribute('title', 'Spielstand gespeichert');
    if (flashTimer) window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(function () {
      flashTimer = null;
      var n = util.byId('hud-save');
      if (n && n.className.indexOf('is-error') < 0) n.className = 'hud__save';
    }, 900);
  }

  MF.core.events.on('save:done', function () { flashSave(true); });
  MF.core.events.on('save:failed', function () { flashSave(false); });

  MF.ui.hud = { render: render, flashSave: flashSave };
})(window.MacFit);
