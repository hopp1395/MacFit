/* Spielstand im localStorage. Faellt sauber zurueck, wenn Storage blockiert ist
   (Privatmodus, file:// mit strengen Einstellungen) — dann wird eben nicht gespeichert. */
(function (MF) {
  'use strict';

  var KEY = 'macfit.save.v1';
  var VERSION = 1;
  var available = null;

  function isAvailable() {
    if (available !== null) return available;
    try {
      window.localStorage.setItem('macfit.probe', '1');
      window.localStorage.removeItem('macfit.probe');
      available = true;
    } catch (err) {
      console.warn('[MacFit] localStorage nicht verfügbar — es wird nicht gespeichert.');
      available = false;
    }
    return available;
  }

  function save(state) {
    if (!isAvailable()) return false;
    try {
      var payload = MF.core.util.deepCopy(state);
      payload.version = VERSION;
      window.localStorage.setItem(KEY, JSON.stringify(payload));
      return true;
    } catch (err) {
      console.error('[MacFit] Speichern fehlgeschlagen', err);
      return false;
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
    } catch (err) {
      /* egal */
    }
  }

  MF.core.storage = {
    save: save,
    load: load,
    reset: reset,
    isAvailable: isAvailable,
    VERSION: VERSION
  };
})(window.MacFit);
