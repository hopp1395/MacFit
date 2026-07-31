/* Winziger Event-Bus. Die Spiellogik kennt die UI nicht — sie meldet nur,
   was passiert ist, und die UI hoert zu. */
(function (MF) {
  'use strict';

  var listeners = {};

  function on(name, fn) {
    if (!listeners[name]) listeners[name] = [];
    listeners[name].push(fn);
    return function off() {
      listeners[name] = listeners[name].filter(function (f) { return f !== fn; });
    };
  }

  function emit(name, payload) {
    (listeners[name] || []).forEach(function (fn) {
      try {
        fn(payload);
      } catch (err) {
        console.error('[MacFit] Fehler im Listener für "' + name + '"', err);
      }
    });
  }

  MF.core.events = { on: on, emit: emit };
})(window.MacFit);
