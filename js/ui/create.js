/* Spieleranlage — läuft einmalig nach dem Vorspann, wenn noch kein Spieler
   angelegt ist, und erneut nach einem Zurücksetzen.

   Herausgegeben wird eine Mitgliedskarte: Name, Klamotten und freiwillig ein
   Foto. Die Karte steht als Vorschau im Dialog und ändert sich beim Tippen
   mit — man sieht also, was man bekommt. */
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
    var done = onDone || function () {};
    var close = null;

    /* Entwurf, bis auf "Mitglied werden" getippt wird. Vorher wandert nichts
       in den Spielstand — ein abgebrochener Anlauf hinterlässt nichts. */
    var draft = {
      name: (s.player && s.player.name) || '',
      outfit: (s.player && s.player.outfit) || 'blau',
      photo: '',
      number: MF.ui.membercard.newNumber(),
      since: s.day || 1
    };

    var preview = el('div.create__card');

    function drawCard() {
      MF.ui.membercard.mount(preview, {
        id: 'create-card',
        data: function () { return draft; },
        title: MF.data.levels.forLevel(1).title,
        editable: true,
        onPhoto: function (url) {
          draft.photo = url || '';
          drawCard();
        }
      });
    }

    var input = el('input.field', {
      type: 'text',
      maxlength: String(MAX_NAME),
      placeholder: 'Dein Name',
      autocomplete: 'off',
      spellcheck: 'false'
    });
    if (draft.name) input.value = draft.name;

    /* Die Karte zeigt den Namen sofort — das erklärt besser als jeder
       Hinweistext, wozu das Feld da ist. */
    input.addEventListener('input', function () {
      draft.name = clean(input.value);
      var slot = util.byId('create-card-name');
      if (slot) slot.textContent = draft.name || '—';
    });

    var tiles = el('div.outfits');
    MF.data.outfits.list.forEach(function (o, idx) {
      var tile = el('button.outfit' + (o.id === draft.outfit ? '.is-active' : ''), { type: 'button' }, [
        el('span.outfit__swatch', { style: 'background:' + o.shirt + ';border-color:' + o.shirtLit }),
        el('span.outfit__name', { text: o.name })
      ]);
      util.onTap(tile, function () {
        draft.outfit = o.id;
        for (var i = 0; i < tiles.children.length; i++) {
          tiles.children[i].classList.toggle('is-active', i === idx);
        }
      });
      tiles.appendChild(tile);
    });

    var body = el('div.create', null, [
      preview,
      el('label.create__label', { text: 'Name' }),
      input,
      el('label.create__label', { text: 'Trainingsklamotten' }),
      tiles,
      el('p.create__note', {
        text: 'Das Foto ist freiwillig und bleibt auf diesem Gerät. '
            + 'Ändern kannst du es später jederzeit unter „Körper“.'
      })
    ]);

    drawCard();

    function commit() {
      var name = clean(input.value);
      if (!name) {
        MF.ui.toast.show('Bitte trag einen Namen ein.', 'warn');
        return;
      }

      var st = MF.game.state.get();
      st.player = {
        name: name,
        outfit: draft.outfit,
        photo: draft.photo,
        number: draft.number,
        since: st.day || 1,
        created: true
      };

      /* Bleibt das Foto im Speicher hängen, ist der Spieler wichtiger als das
         Bild — dann wird es verworfen statt die ganze Anlage. */
      if (MF.game.state.saveNow() === 'error' && st.player.photo) {
        st.player.photo = '';
        MF.game.state.saveNow();
        MF.ui.toast.show('Das Foto passte nicht in den Speicher und wurde verworfen.', 'warn');
      }

      if (close) close();
      MF.ui.hud.render();
      MF.ui.router.refresh();
      done(st.player);
    }

    close = MF.ui.modal.open({
      title: 'Mitglied werden',
      subtitle: 'Deine MacFit-Karte wird ausgestellt.',
      body: body,
      dismissible: false,
      /* close:false — der Dialog geht erst zu, wenn ein Name dasteht. */
      actions: [{ label: 'Karte ausstellen', tone: 'primary', close: false, onTap: commit }]
    });

    return close;
  }

  MF.ui.create = { show: show, needed: needed, maxName: MAX_NAME };
})(window.MacFit);
