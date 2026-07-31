/* Modale Dialoge: Tagesreport, Levelaufstieg, Bestätigungen.
   Bewusst kein window.confirm/alert — das blockiert den Browser. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;
  var openCount = 0;

  /* opts: { title, subtitle, body:Node, actions:[{label,tone,onTap,close}], dismissible } */
  function open(opts) {
    var root = util.byId('modal-root');
    if (!root) return function () {};

    var overlay = el('div.modal-overlay');
    var box = el('div.modal');

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
      util.onTap(btn, function () {
        if (action.onTap) action.onTap();
        if (action.close !== false) close();
      });
      actions.appendChild(btn);
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
