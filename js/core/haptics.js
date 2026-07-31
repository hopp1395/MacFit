/* Vibration am Handy. Abschaltbar ueber die Einstellungen im Stats-Screen. */
(function (MF) {
  'use strict';

  var enabled = true;
  var supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  var PATTERNS = {
    perfect: 18,
    ok: 10,
    miss: [0, 30, 40, 30],
    levelUp: [0, 40, 60, 40, 60, 80],
    sleep: [0, 25, 80, 25]
  };

  function buzz(kind) {
    if (!enabled || !supported) return;
    var pattern = PATTERNS[kind];
    if (!pattern) return;
    try {
      navigator.vibrate(pattern);
    } catch (err) {
      /* manche Browser werfen ohne Nutzergeste */
    }
  }

  MF.core.haptics = {
    buzz: buzz,
    setEnabled: function (v) { enabled = !!v; },
    isEnabled: function () { return enabled; },
    isSupported: function () { return supported; }
  };
})(window.MacFit);
