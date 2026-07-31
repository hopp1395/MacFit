/* Kurze Meldungen am oberen Rand. */
(function (MF) {
  'use strict';

  var el = MF.core.util.el;

  function show(text, tone) {
    var root = MF.core.util.byId('toasts');
    if (!root) return;

    var node = el('div.toast' + (tone ? '.toast--' + tone : ''), { text: text });
    root.appendChild(node);

    /* Anzeigen, kurz stehen lassen, ausblenden. */
    window.requestAnimationFrame(function () { node.classList.add('is-in'); });
    window.setTimeout(function () {
      node.classList.remove('is-in');
      window.setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 250);
    }, 2200);

    /* Nie mehr als drei gleichzeitig. */
    while (root.children.length > 3) root.removeChild(root.firstChild);
  }

  MF.ui.toast = { show: show };
})(window.MacFit);
