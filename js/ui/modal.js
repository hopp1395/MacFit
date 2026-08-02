/* Modale Dialoge: Tagesreport, Levelaufstieg, Bestätigungen.
   Bewusst kein window.confirm/alert — das blockiert den Browser. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;
  var openCount = 0;

  /* Zeigt statt des Knopfes einen Countdown und tauscht ihn erst am Ende aus.
     Gerechnet wird gegen die Uhr, nicht über gezählte Ticks — so läuft die Zeit
     auch weiter, während die App im Hintergrund liegt.

     auto (optional): { label, on, onToggle } — legt während des Wartens einen
     an- und abwählbaren Knopf unter den Balken. Ist er beim Ablauf aktiv,
     wird die Aktion sofort ausgelöst statt den Knopf zu zeigen. */
  function countdown(slot, button, seconds, waitText, auto, fire) {
    var endsAt = (+new Date()) + seconds * 1000;
    var total = seconds * 1000;

    var label = el('div.modal__wait-label');
    var bar = el('div.bar.bar--wait', null, [el('div.bar__fill')]);
    var fill = bar.firstChild;
    var wait = el('div.modal__wait', null, [label, bar]);

    if (auto) {
      var armBtn = el('button.btn.btn--ghost.modal__auto', { type: 'button' });
      var paint = function () {
        armBtn.textContent = (auto.on ? '✓ ' : '') + auto.label;
        armBtn.classList.toggle('is-on', !!auto.on);
      };
      util.onTap(armBtn, function () {
        auto.on = !auto.on;
        if (auto.onToggle) auto.onToggle(auto.on);
        paint();
      });
      paint();
      wait.appendChild(armBtn);
    }
    slot.appendChild(wait);

    function tick() {
      var left = endsAt - (+new Date());
      if (left <= 0) {
        window.clearInterval(handle);
        if (wait.parentNode) wait.parentNode.removeChild(wait);
        if (auto && auto.on) { fire(); return; }
        slot.appendChild(button);
        return;
      }
      label.textContent = waitText + ' — noch ' + Math.ceil(left / 1000) + ' s';
      fill.style.width = ((1 - left / total) * 100).toFixed(1) + '%';
    }

    var handle = window.setInterval(tick, 250);
    tick();
    return handle;
  }

  /* opts: { title, subtitle, body:Node, actions:[{label,tone,onTap,close,delaySeconds,waitText}], dismissible } */
  function open(opts) {
    var root = util.byId('modal-root');
    if (!root) return function () {};

    var overlay = el('div.modal-overlay');
    var box = el('div.modal');
    var timers = [];

    if (opts.title) {
      box.appendChild(el('h2.modal__title', { text: opts.title }));
    }
    if (opts.subtitle) {
      box.appendChild(el('p.modal__subtitle', { text: opts.subtitle }));
    }
    if (opts.body) {
      box.appendChild(el('div.modal__body', null, [opts.body]));
    }

    function close() {
      for (var t = 0; t < timers.length; t++) window.clearInterval(timers[t]);
      timers = [];
      overlay.classList.remove('is-in');
      window.setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
      openCount = Math.max(0, openCount - 1);
      document.body.classList.toggle('is-modal-open', openCount > 0);
    }

    var actions = el('div.modal__actions');
    (opts.actions || [{ label: 'Weiter' }]).forEach(function (action) {
      var btn = el('button.btn' + (action.tone ? '.btn--' + action.tone : ''), {
        type: 'button', text: action.label
      });
      function trigger() {
        if (action.onTap) action.onTap();
        if (action.close !== false) close();
      }
      util.onTap(btn, trigger);

      if (action.delaySeconds > 0) {
        var slot = el('div.modal__slot');
        actions.appendChild(slot);
        timers.push(countdown(slot, btn, action.delaySeconds,
          action.waitText || 'Bitte warten', action.auto, trigger));
      } else {
        actions.appendChild(btn);
      }
    });
    box.appendChild(actions);

    if (opts.dismissible !== false) {
      util.onTap(overlay, function (ev) {
        if (ev.target === overlay) close();
      });
    }

    overlay.appendChild(box);
    root.appendChild(overlay);
    openCount += 1;
    document.body.classList.add('is-modal-open');
    window.requestAnimationFrame(function () { overlay.classList.add('is-in'); });

    return close;
  }

  function confirm(opts) {
    return open({
      title: opts.title,
      subtitle: opts.text,
      dismissible: true,
      actions: [
        { label: opts.cancelLabel || 'Abbrechen', tone: 'ghost' },
        { label: opts.confirmLabel || 'OK', tone: opts.tone || 'danger', onTap: opts.onConfirm }
      ]
    });
  }

  MF.ui.modal = { open: open, confirm: confirm };
})(window.MacFit);
