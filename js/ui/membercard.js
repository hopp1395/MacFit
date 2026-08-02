/* Die MacFit-Mitgliedskarte. Wird an zwei Stellen gebraucht — bei der Anlage
   und im Körper-Bildschirm — und ist deshalb ein eigener Baustein.

   Das Foto ist freiwillig. Es kommt aus einem ganz normalen Dateifeld, das am
   Handy Kamera oder Galerie öffnet, und wird vor dem Speichern auf Passbild-
   größe heruntergerechnet: ein Handyfoto hat mehrere Megabyte, der
   localStorage fasst rund fünf. Ungerechnet wäre nach einem Bild Schluss. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;

  var PHOTO_W = 132, PHOTO_H = 168;   /* Hochformat wie ein Passbild */
  var MAX_CHARS = 48000;              /* Obergrenze für den Spielstand */
  var QUALITIES = [0.72, 0.55, 0.4];

  /* ---------- Foto einlesen und verkleinern -------------------------------- */

  function shrink(img) {
    var canvas = document.createElement('canvas');
    canvas.width = PHOTO_W;
    canvas.height = PHOTO_H;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    /* Formatfüllend zuschneiden, mittig — sonst verzerrt jedes Hochkantfoto. */
    var scale = Math.max(PHOTO_W / img.width, PHOTO_H / img.height);
    var dw = img.width * scale, dh = img.height * scale;
    ctx.drawImage(img, (PHOTO_W - dw) / 2, (PHOTO_H - dh) / 2, dw, dh);

    for (var i = 0; i < QUALITIES.length; i++) {
      var url;
      try {
        url = canvas.toDataURL('image/jpeg', QUALITIES[i]);
      } catch (err) {
        return null;      /* manche Browser sperren das auf file:// */
      }
      if (url.length <= MAX_CHARS) return url;
    }
    return null;
  }

  /* done(dataUrl, fehlertext) — genau eines der beiden ist gesetzt. */
  function readFile(file, done) {
    if (!file) { done(null, 'Keine Datei gewählt.'); return; }
    if (!window.FileReader) { done(null, 'Dieser Browser kann keine Bilder einlesen.'); return; }

    var reader = new window.FileReader();
    reader.onerror = function () { done(null, 'Die Datei ließ sich nicht lesen.'); };
    reader.onload = function () {
      var img = new window.Image();
      img.onerror = function () { done(null, 'Das ist kein lesbares Bild.'); };
      img.onload = function () {
        var small = shrink(img);
        if (small) done(small, null);
        else done(null, 'Das Bild ließ sich nicht verkleinern.');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  /* ---------- Karte -------------------------------------------------------- */

  function number(player) {
    return player.number ? 'MF-' + player.number : 'MF-000000';
  }

  function newNumber() {
    return String(100000 + Math.floor(Math.random() * 900000));
  }

  /* opts: { data: fn -> player-artiges Objekt, title, editable, id, onPhoto } */
  function mount(container, opts) {
    util.clear(container);
    var p = opts.data() || {};

    var card = el('div.mcard');

    card.appendChild(el('div.mcard__head', null, [
      el('span.mcard__brand', null, [
        el('span', { text: 'Mac' }),
        el('span.mcard__brand-alt', { text: 'Fit' })
      ]),
      el('span.mcard__type', { text: 'Mitgliedskarte' })
    ]));

    var photo = el('div.mcard__photo');
    if (p.photo) {
      photo.appendChild(el('img.mcard__img', { src: p.photo, alt: 'Mitgliedsfoto' }));
    } else {
      photo.classList.add('is-empty');
      photo.appendChild(el('span.mcard__photo-icon', { text: '📷' }));
      photo.appendChild(el('span.mcard__photo-hint', { text: 'ohne Foto' }));
    }

    var info = el('div.mcard__info');
    info.appendChild(el('div.mcard__name', {
      id: opts.id ? opts.id + '-name' : null,
      text: p.name || '—'
    }));
    if (opts.title) info.appendChild(el('div.mcard__title', { text: opts.title }));
    info.appendChild(el('div.mcard__row', null, [
      el('span', { text: 'Nummer' }), el('strong', { text: number(p) })
    ]));
    /* Dauer statt Beitrittstag: "Tag 1" stand da fuer immer, weil jeder an
       Tag 1 beitritt — gemeint ist, wie lange man schon dabei ist. */
    var days = Math.max(1, MF.game.state.get().day - (p.since || 1) + 1);
    info.appendChild(el('div.mcard__row', null, [
      el('span', { text: 'Mitglied seit' }),
      el('strong', { text: days === 1 ? '1 Tag' : days + ' Tagen' })
    ]));

    card.appendChild(el('div.mcard__body', null, [photo, info]));
    container.appendChild(card);

    if (!opts.editable) return card;

    /* Ein verstecktes Dateifeld in einem <label> — das öffnet am Handy
       zuverlässig Kamera oder Galerie, ohne dass JavaScript einen Klick
       nachbauen muss. */
    var inputId = (opts.id || 'mcard') + '-file';
    var input = el('input.mcard__file', { type: 'file', accept: 'image/*', id: inputId });
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      readFile(file, function (url, error) {
        if (error) { MF.ui.toast.show(error, 'warn'); return; }
        opts.onPhoto(url);
      });
    });

    var actions = el('div.mcard__actions', null, [
      input,
      el('label.btn.btn--ghost.btn--slim', {
        'for': inputId, text: p.photo ? '📷 Foto ändern' : '📷 Foto hinzufügen'
      })
    ]);

    if (p.photo) {
      var drop = el('button.btn.btn--ghost.btn--slim', { type: 'button', text: 'Entfernen' });
      util.onTap(drop, function () { opts.onPhoto(''); });
      actions.appendChild(drop);
    }

    container.appendChild(actions);
    return card;
  }

  MF.ui.membercard = {
    mount: mount,
    readFile: readFile,
    newNumber: newNumber,
    maxChars: MAX_CHARS
  };
})(window.MacFit);
