/* Neue Fassung holen, ohne den Spieler zu stoeren.

   GitHub Pages liefert das HTML mit max-age=600 — wer die Seite offen laesst,
   spielt sonst tagelang auf einer alten Fassung weiter. Nach dem Schlafen ist
   der ruhigste Moment fuer einen Neustart: der Tag ist abgerechnet, der Stand
   gespeichert, und der Vorspann laeuft ohnehin gleich.

   Geprueft wird die Versionszeile in js/core/namespace.js, mit Cache-Sperre.
   Faellt die Pruefung aus (offline, altes Geraet), passiert einfach nichts. */
(function (MF) {
  'use strict';

  var SRC = 'js/core/namespace.js';
  var TRIED_KEY = 'macfit.update.tried';

  function readTried() {
    try {
      return window.localStorage.getItem(TRIED_KEY) || '';
    } catch (err) {
      return '';
    }
  }

  function writeTried(v) {
    try {
      if (v) window.localStorage.setItem(TRIED_KEY, v);
      else window.localStorage.removeItem(TRIED_KEY);
    } catch (err) {
      /* ohne Speicher eben ohne Gedaechtnis */
    }
  }

  /* done(serverVersion oder null) */
  function check(done) {
    if (!window.fetch) { done(null); return; }
    var url = SRC + '?fresh=' + new Date().getTime();
    var req;
    try {
      req = window.fetch(url, { cache: 'no-store' });
    } catch (err) {
      done(null);
      return;
    }
    if (!req || !req.then) { done(null); return; }

    req.then(function (res) {
      return res && res.ok ? res.text() : '';
    }).then(function (text) {
      var m = /version:\s*'([^']+)'/.exec(text || '');
      done(m ? m[1] : null);
    })['catch'](function () {
      done(null);
    });
  }

  /* Liegt eine neue Fassung bereit, wird die Seite neu geladen — sonst geht
     es normal weiter. next() laeuft immer, wenn NICHT neu geladen wird. */
  function reloadIfNew(next) {
    var go = next || function () {};
    check(function (server) {
      if (!server || server === MF.version) {
        writeTried('');
        go();
        return;
      }
      /* Schon einmal vergeblich versucht? Dann haengt ein Cache dazwischen —
         nicht in eine Schleife laufen. */
      if (readTried() === server) { go(); return; }

      writeTried(server);
      MF.ui.toast.show('Neue Fassung ' + server + ' — wird geladen …', 'good');
      MF.game.state.saveNow();
      if (MF.core.cloud && MF.core.cloud.pushNow) MF.core.cloud.pushNow();
      window.setTimeout(function () { window.location.reload(); }, 400);
    });
  }

  MF.core.update = {
    check: check,
    reloadIfNew: reloadIfNew
  };
})(window.MacFit);
