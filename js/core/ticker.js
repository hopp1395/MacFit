/* rAF-Schleife. Laeuft nur waehrend eines Satzes, sonst steht sie still. */
(function (MF) {
  'use strict';

  function create(onFrame) {
    var running = false;
    var handle = null;
    var last = 0;

    function frame(now) {
      if (!running) return;
      var dt = last ? (now - last) / 1000 : 0;
      last = now;
      /* Nach Tab-Wechsel koennen riesige Spruenge kommen — deckeln.
         Rueckwaerts darf die Zeit nie laufen. */
      if (dt > 0.1) dt = 0.1;
      if (dt < 0) dt = 0;
      onFrame(dt, now);
      handle = window.requestAnimationFrame(frame);
    }

    return {
      start: function () {
        if (running) return;
        running = true;
        last = 0;
        handle = window.requestAnimationFrame(frame);
      },
      stop: function () {
        running = false;
        if (handle) window.cancelAnimationFrame(handle);
        handle = null;
      },
      isRunning: function () { return running; }
    };
  }

  MF.core.ticker = { create: create };
})(window.MacFit);
