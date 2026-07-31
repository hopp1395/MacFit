/* Spieleranlage — läuft einmalig nach dem Vorspann, wenn noch kein Spieler
   angelegt ist, und erneut nach einem Zurücksetzen.

   Bewusst kurz gehalten: Name und Klamotten. Alles Weitere entscheidet sich
   im Spiel, nicht in einem Formular. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;

  var MAX_NAME = 14;

  function needed() {
    var s = MF.game.state.get();
    return !s || !s.player || !s.player.created;
  }

  function clean(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/^\s+/, '').replace(/\s+$/, '').substr(0, MAX_NAME);
  }

  function show(onDone) {
    var s = MF.game.state.get();
    var chosen = (s.player && s.player.outfit) || 'blau';
    var done = onDone || function () {};
    var close = null;

    var input = el('input.field', {
      type: 'text',
      maxlength: String(MAX_NAME),
      placeholder: 'Dein Name',
      autocomplete: 'off',
      spellcheck: 'false'
    });
    if (s.player && s.player.name) input.value = s.player.name;

    var tiles = el('div.outfits');
    MF.data.outfits.list.forEach(function (o) {
      var tile = el('button.outfit' + (o.id === chosen ? '.is-active' : ''), { type: 'button' }, [
        el('span.outfit__swatch', { style: 'background:' + o.shirt + ';border-color:' + o.shirtLit }),
        el('span.outfit__name', { text: o.name })
      ]);
      util.onTap(tile, function () {
        chosen = o.id;
        for (var i = 0; i < tiles.children.length; i++) {
          tiles.children[i].classList.toggle('is-active', i === MF.data.outfits.list.indexOf(o));
        }
      });
      tiles.appendChild(tile);
    });

    var body = el('div.create', null, [
      el('p.create__lead', {
        text: 'Bevor es losgeht: Wer bist du, und in was trainierst du?'
      }),
      el('label.create__label', { text: 'Name' }),
      input,
      el('label.create__label', { text: 'Trainingsklamotten' }),
      tiles
    ]);

    function commit() {
      var name = clean(input.value);
      if (!name) {
        MF.ui.toast.show('Bitte trag einen Namen ein.', 'warn');
        return;
      }
      var st = MF.game.state.get();
      st.player = { name: name, outfit: chosen, created: true };
      MF.game.state.saveNow();
      if (close) close();
      MF.ui.hud.render();
      MF.ui.router.refresh();
      done(st.player);
    }

    close = MF.ui.modal.open({
      title: 'Spieler anlegen',
      subtitle: 'Neue Mitgliedskarte bei MacFit.',
      body: body,
      dismissible: false,
      /* close:false — der Dialog geht erst zu, wenn ein Name dasteht. */
      actions: [{ label: 'Mitglied werden', tone: 'primary', close: false, onTap: commit }]
    });

    return close;
  }

  MF.ui.create = { show: show, needed: needed, maxName: MAX_NAME };
})(window.MacFit);
