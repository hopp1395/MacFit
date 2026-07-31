/* Erfolge teilen — per WhatsApp oder über das Teilen-Menü des Geräts.

   Zwei Wege, weil keiner überall funktioniert:
     navigator.share   das native Teilen-Blatt (Handy, sicherer Kontext)
     wa.me-Link        WhatsApp direkt, funktioniert auch am Rechner

   Beides braucht nur einen Text. Ein Bild wäre schöner, hiesse aber, den
   Spielstand auf einen fremden Rechner zu laden — das Spiel kommt bewusst
   ohne Server aus. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;

  function player() {
    var s = MF.game.state.get();
    return (s && s.player) || {};
  }

  /* Der Text, der bei den Freunden ankommt. Bewusst kompakt: WhatsApp
     schneidet lange Vorschauen ab, und niemand liest eine Tabelle im Chat. */
  function text() {
    var s = MF.game.state.get();
    var st = MF.game.stats;
    var fit = MF.game.fitness;
    var name = player().name || 'Ich';

    var lines = [];
    lines.push('💪 ' + name + ' bei MacFit');
    lines.push('');
    lines.push('Fitness-Index: ' + fit.index() + ' — ' + fit.rank().name);
    lines.push('Muskelmasse: ' + util.formatKg(st.muscleMass()));
    lines.push('Level ' + s.level + ' · ' + MF.game.progression.currentTitle());
    lines.push('Tag ' + s.day + ' · ' + s.stats.totalSets + ' Sätze trainiert');

    if (s.stats.natural) lines.push('🌿 Natural — alles ohne Hilfsmittel');
    if (s.stats.perfectReps > 0) {
      lines.push('Perfekte Wiederholungen: ' + s.stats.perfectReps);
    }

    lines.push('');
    lines.push('MacFit ist ein Spiel: ' + gameUrl());
    return lines.join('\n');
  }

  /* Beim Spielen von der Festplatte gibt es keine sinnvolle Adresse zum
     Weitergeben — dann die Projektseite nennen. */
  function gameUrl() {
    var href = String(window.location && window.location.href || '');
    if (href.indexOf('http') !== 0) return 'https://hopp1395.github.io/MacFit/';
    return href.split('#')[0].split('?')[0];
  }

  function whatsappUrl(message) {
    return 'https://wa.me/?text=' + encodeURIComponent(message);
  }

  function canNativeShare() {
    return !!(window.navigator && window.navigator.share);
  }

  /* Öffnet WhatsApp. Kein window.open aus einem Timeout heraus — das blockieren
     Handy-Browser; deshalb hängt der Aufruf direkt am Antippen. */
  function toWhatsApp(message) {
    var url = whatsappUrl(message);
    var win = window.open(url, '_blank');
    if (!win) window.location.href = url;
  }

  function nativeShare(message) {
    try {
      var p = window.navigator.share({ title: 'MacFit', text: message });
      if (p && p['catch']) {
        p['catch'](function () { /* abgebrochen ist kein Fehler */ });
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  function copy(message) {
    var nav = window.navigator;
    if (nav && nav.clipboard && nav.clipboard.writeText) {
      nav.clipboard.writeText(message);
      MF.ui.toast.show('Text kopiert.', 'good');
      return;
    }
    MF.ui.toast.show('Kopieren geht in diesem Browser nicht.', 'warn');
  }

  /* Vorschau zeigen, bevor irgendetwas hinausgeht — der Text nennt Name und
     Werte, das soll man vorher gesehen haben. */
  function show() {
    var message = text();

    var body = el('div.share');
    body.appendChild(el('pre.share__preview', { text: message }));
    body.appendChild(el('p.share__note', {
      text: 'Es wird nur dieser Text weitergegeben. Dein Foto und dein '
          + 'Spielstand bleiben auf dem Gerät.'
    }));

    var actions = [{
      label: '📤 Per WhatsApp',
      tone: 'primary',
      onTap: function () { toWhatsApp(message); }
    }];

    if (canNativeShare()) {
      actions.push({
        label: 'Anders teilen',
        tone: 'ghost',
        onTap: function () { nativeShare(message); }
      });
    } else {
      actions.push({
        label: 'Text kopieren',
        tone: 'ghost',
        onTap: function () { copy(message); }
      });
    }

    actions.push({ label: 'Abbrechen', tone: 'ghost' });

    MF.ui.modal.open({
      title: 'Erfolge teilen',
      subtitle: 'So kommt es bei deinen Leuten an.',
      body: body,
      dismissible: true,
      actions: actions
    });
  }

  MF.ui.share = {
    show: show,
    text: text,
    whatsappUrl: whatsappUrl,
    canNativeShare: canNativeShare
  };
})(window.MacFit);
