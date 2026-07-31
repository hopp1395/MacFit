/* Spielstand im localStorage. Faellt sauber zurueck, wenn Storage blockiert ist
   (privater Modus, blockierte Website-Daten) — dann wird eben nicht gespeichert,
   aber der Spieler erfaehrt davon, statt seinen Fortschritt still zu verlieren. */
(function (MF) {
  'use strict';

  var KEY = 'macfit.save.v1';
  var VERSION = 1;
  var available = null;

  var lastPayload = null;   /* zuletzt geschriebener Text — spart doppelte Schreibvorgaenge */
  var lastSavedAt = 0;
  var lastError = null;
  var saveCount = 0;

  function now() { return +new Date(); }

  function isAvailable() {
    if (available !== null) return available;
    try {
      window.localStorage.setItem('macfit.probe', '1');
      window.localStorage.removeItem('macfit.probe');
      available = true;
    } catch (err) {
      console.warn('[MacFit] localStorage nicht verfügbar — es wird nicht gespeichert.');
      available = false;
      lastError = 'blockiert';
    }
    return available;
  }

  /* Gibt zurueck: 'saved' | 'unchanged' | 'unavailable' | 'error' */
  function save(state) {
    if (!isAvailable()) {
      MF.core.events.emit('save:failed', { reason: 'unavailable' });
      return 'unavailable';
    }
    try {
      var payload = MF.core.util.deepCopy(state);
      payload.version = VERSION;
      var text = JSON.stringify(payload);

      /* Hat sich nichts geaendert, muss auch nichts geschrieben werden. */
      if (text === lastPayload) return 'unchanged';

      window.localStorage.setItem(KEY, text);
      lastPayload = text;
      lastSavedAt = now();
      saveCount += 1;
      lastError = null;
      MF.core.events.emit('save:done', { at: lastSavedAt, bytes: text.length });
      return 'saved';
    } catch (err) {
      /* Kann bei vollem Speicher passieren (QuotaExceeded). */
      console.error('[MacFit] Speichern fehlgeschlagen', err);
      lastError = 'fehler';
      MF.core.events.emit('save:failed', { reason: 'error', error: err });
      return 'error';
    }
  }

  function load() {
    if (!isAvailable()) return null;
    var raw;
    try {
      raw = window.localStorage.getItem(KEY);
    } catch (err) {
      return null;
    }
    if (!raw) return null;

    try {
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      lastPayload = raw;
      lastSavedAt = now();
      return migrate(data);
    } catch (err) {
      console.warn('[MacFit] Spielstand defekt — es wird neu gestartet.', err);
      return null;
    }
  }

  /* Platz fuer spaetere Save-Formate. Version 1 braucht noch nichts. */
  function migrate(data) {
    var v = data.version || 1;
    if (v > VERSION) {
      console.warn('[MacFit] Spielstand stammt aus einer neueren Version.');
      return null;
    }
    data.version = VERSION;
    return data;
  }

  function reset() {
    if (!isAvailable()) return;
    try {
      window.localStorage.removeItem(KEY);
      lastPayload = null;
    } catch (err) {
      /* egal */
    }
  }

  /* Fuer die Anzeige: wann wurde zuletzt geschrieben, und klappt es ueberhaupt? */
  function status() {
    return {
      available: isAvailable(),
      lastSavedAt: lastSavedAt,
      secondsAgo: lastSavedAt ? Math.round((now() - lastSavedAt) / 1000) : null,
      saveCount: saveCount,
      error: lastError
    };
  }

  MF.core.storage = {
    save: save,
    load: load,
    reset: reset,
    isAvailable: isAvailable,
    status: status,
    VERSION: VERSION
  };
})(window.MacFit);
