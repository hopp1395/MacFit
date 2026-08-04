/* Meldungen am oberen Rand.

   Sie verschwinden NICHT von selbst: nach einem Satz kommen schnell mehrere
   Nachrichten auf einmal (Praemie, Serie, Zettel), und die waren nach zwei
   Sekunden weg, bevor man sie gelesen hatte. Jede Meldung bleibt stehen, bis
   sie angetippt wird — deshalb traegt sie sichtbar ein Kreuz. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;

  var MAX_OPEN = 4;   /* darueber verdraengen neue Meldungen die aeltesten */

  function close(node) {
    node.classList.remove('is-in');
    window.setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 250);
  }

  function show(text, tone) {
    var root = util.byId('toasts');
    if (!root) return;

    var node = el('div.toast' + (tone ? '.toast--' + tone : ''), null, [
      el('span.toast__text', { text: text }),
      el('span.toast__close', { text: '✕', 'aria-hidden': 'true' })
    ]);
    util.onTap(node, function () { close(node); });
    root.appendChild(node);

    window.requestAnimationFrame(function () { node.classList.add('is-in'); });

    /* Der Bildschirm darf nicht zulaufen — die aeltesten weichen. */
    while (root.children.length > MAX_OPEN) root.removeChild(root.firstChild);
  }

  /* Alles wegraeumen — etwa wenn ein Bildschirm gewechselt wird. */
  function clear() {
    var root = util.byId('toasts');
    if (!root) return;
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  MF.ui.toast = { show: show, clear: clear };
})(window.MacFit);
