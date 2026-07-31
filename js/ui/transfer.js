/* Profil sichern und wieder einspielen.

   Der Spielstand liegt im localStorage und damit an genau einem Browser auf
   genau einem Geraet. Ein Handywechsel, ein geleerter Browserspeicher oder der
   Wunsch, am Rechner weiterzuspielen, kosten sonst alles. Hier wird der
   komplette Stand als JSON-Datei ausgegeben und laesst sich ueberall wieder
   laden — mit Fortschritt, Kur, Geld, Statistik und Mitgliedskarte samt Foto.

   Angeboten wird das an zwei Stellen: unter Koerper -> Einstellungen und
   gleich bei der Neuanmeldung, damit ein Umzug nicht bei Tag 1 anfaengt. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;

  var FORMAT = 1;

  /* ---------- Ausgeben ----------------------------------------------------- */

  function stamp() {
    try {
      return new Date().toISOString();
    } catch (err) {
      return '';
    }
  }

  /* Dateinamen bleiben bei ASCII — Umlaute ueberleben nicht jeden Umweg
     ueber Mail, Messenger und fremde Dateisysteme. */
  function safeName(name) {
    var s = String(name || 'spieler');
    s = s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
         .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
         .replace(/ß/g, 'ss');
    s = s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
    return s.toLowerCase() || 'spieler';
  }

  function filename() {
    var s = MF.game.state.get();
    return 'macfit-' + safeName(s.player && s.player.name) + '-tag' + (s.day || 1) + '.json';
  }

  /* Name und Tag stehen zusaetzlich obenauf: so sieht man beim Oeffnen im
     Texteditor sofort, welches Profil in der Datei steckt. */
  function toText() {
    var s = MF.game.state.get();
    return JSON.stringify({
      app: 'MacFit',
      format: FORMAT,
      exportedAt: stamp(),
      name: (s.player && s.player.name) || '',
      day: s.day || 1,
      save: util.deepCopy(s)
    }, null, 1);
  }

  function download(text, name) {
    var url = null, revoke = false;
    try {
      if (window.Blob && window.URL && window.URL.createObjectURL) {
        url = window.URL.createObjectURL(new window.Blob([text], { type: 'application/json' }));
        revoke = true;
      } else {
        url = 'data:application/json;charset=utf-8,' + encodeURIComponent(text);
      }
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (revoke) window.setTimeout(function () { window.URL.revokeObjectURL(url); }, 5000);
      return true;
    } catch (err) {
      return false;
    }
  }

  /* Am Handy landet eine heruntergeladene Datei irgendwo im Dateisystem und
     ist von dort schwer weiterzureichen. Wo das Teilen-Blatt Dateien kann,
     ist es der brauchbarere Weg: Mail an sich selbst, Cloud, Messenger. */
  function canSendFile() {
    var nav = window.navigator;
    if (!nav || !nav.share || !nav.canShare || !window.File) return false;
    try {
      return nav.canShare({ files: [new window.File(['{}'], 'p.json', { type: 'application/json' })] });
    } catch (err) {
      return false;
    }
  }

  function sendFile() {
    var nav = window.navigator;
    try {
      var file = new window.File([toText()], filename(), { type: 'application/json' });
      var p = nav.share({
        files: [file],
        title: 'MacFit-Profil',
        text: 'Mein MacFit-Profil zum Weiterspielen.'
      });
      if (p && p['catch']) p['catch'](function () { /* abgebrochen ist kein Fehler */ });
      return true;
    } catch (err) {
      return false;
    }
  }

  /* Gibt 'file' | 'download' | 'error'. */
  function exportProfile(preferShare) {
    if (preferShare && canSendFile() && sendFile()) return 'file';
    return download(toText(), filename()) ? 'download' : 'error';
  }

  /* ---------- Einlesen ----------------------------------------------------- */

  /* { ok:true, save, name, day } oder { ok:false, reason } */
  function parse(text) {
    var data;
    try {
      data = JSON.parse(String(text));
    } catch (err) {
      return { ok: false, reason: 'Das ist keine MacFit-Datei.' };
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, reason: 'Das ist keine MacFit-Datei.' };
    }

    /* Zwei Formen werden angenommen: die Exportdatei mit Umschlag und ein
       nackter Spielstand, wie er im Browserspeicher steht. Wer sich den von
       Hand herauskopiert hat, soll ihn auch einspielen koennen. */
    var save = (data.save && typeof data.save === 'object') ? data.save : data;

    if (!save.muscles || typeof save.muscles !== 'object' || !save.player) {
      return { ok: false, reason: 'In der Datei steckt kein Spielstand.' };
    }
    if (save.version && save.version > MF.core.storage.VERSION) {
      return { ok: false, reason: 'Die Datei stammt aus einer neueren Version des Spiels.' };
    }

    return {
      ok: true,
      save: save,
      name: (save.player && save.player.name) || '',
      day: save.day || 1
    };
  }

  /* done(ergebnis, fehlertext) — genau eines der beiden ist gesetzt. */
  function readFile(file, done) {
    if (!file) { done(null, 'Keine Datei gewählt.'); return; }
    if (!window.FileReader) { done(null, 'Dieser Browser kann keine Dateien einlesen.'); return; }

    var reader = new window.FileReader();
    reader.onerror = function () { done(null, 'Die Datei ließ sich nicht lesen.'); };
    reader.onload = function () {
      var res = parse(reader.result);
      if (res.ok) done(res, null);
      else done(null, res.reason);
    };
    reader.readAsText(file);
  }

  /* Uebernimmt den Stand. hydrate ergaenzt, was in einer aelteren Datei fehlt;
     das Level wird aus den XP neu bestimmt, falls sich die Schwellen seither
     geaendert haben. Die Einstellungen aus der Datei muessen an die Module
     weitergereicht werden, sonst vibriert und toent es nach dem Import
     anders als eingestellt. */
  function apply(save) {
    var s = MF.game.state.hydrate(save);
    s.level = MF.data.levels.levelForXp(s.xp);
    MF.game.state.set(s);
    MF.core.haptics.setEnabled(s.settings.haptics);
    MF.core.audio.setEnabled(s.settings.music);
    MF.core.audio.setSfxEnabled(s.settings.sound);
    return MF.game.state.saveNow();
  }

  /* Einspielen mit Rueckfrage, wenn schon ein Spieler da ist — der Stand auf
     diesem Geraet ist danach weg. onDone() laeuft nur bei Uebernahme. */
  function useResult(res, onDone) {
    var s = MF.game.state.get();
    var occupied = !!(s && s.player && s.player.created);
    var done = onDone || function () {};

    function go() {
      var written = apply(res.save);
      MF.ui.hud.render();
      MF.ui.router.refresh();
      MF.ui.toast.show(
        'Profil geladen: ' + (res.name || 'ohne Namen') + ', Tag ' + res.day + '.',
        'good'
      );
      if (written === 'error') {
        MF.ui.toast.show('Achtung: Speichern auf diesem Gerät hat nicht geklappt.', 'warn');
      }
      done(res);
    }

    if (!occupied) { go(); return; }

    MF.ui.modal.confirm({
      title: 'Profil ersetzen?',
      text: 'Auf diesem Gerät steht bereits ' + (s.player.name || 'ein Spieler')
          + ' bei Tag ' + (s.day || 1) + '. Die Datei überschreibt das vollständig. '
          + 'Sichere den bisherigen Stand vorher, wenn du ihn behalten willst.',
      confirmLabel: 'Ersetzen',
      onConfirm: go
    });
  }

  /* Ein verstecktes Dateifeld in einem <label> — derselbe Weg wie beim Foto
     auf der Mitgliedskarte. Am Handy oeffnet das zuverlaessig die
     Dateiauswahl, ohne dass JavaScript einen Klick nachbauen muss. */
  function pickButton(id, label, onDone) {
    var input = el('input.mcard__file', {
      type: 'file', accept: '.json,application/json', id: id
    });
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      readFile(file, function (res, error) {
        /* Zuruecksetzen, sonst loest dieselbe Datei kein zweites Mal aus. */
        try { input.value = ''; } catch (err) { /* egal */ }
        if (error) { MF.ui.toast.show(error, 'warn'); return; }
        useResult(res, onDone);
      });
    });
    return el('span.filepick', null, [
      input,
      el('label.btn.btn--ghost', { 'for': id, text: label })
    ]);
  }

  MF.ui.transfer = {
    toText: toText,
    filename: filename,
    exportProfile: exportProfile,
    canSendFile: canSendFile,
    parse: parse,
    readFile: readFile,
    apply: apply,
    useResult: useResult,
    pickButton: pickButton
  };
})(window.MacFit);
