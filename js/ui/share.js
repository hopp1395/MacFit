/* Erfolge teilen — als Posen-Bild oder als Text.

   Das Bild entsteht im Browser: Pixel-Szene in niedriger Auflösung, hart
   hochskaliert, darüber sauber gesetzte Werte.

   Geteilt wird über das Teilen-Menü des Geräts — dort stehen WhatsApp, Signal,
   Mail und alles andere Installierte. Der Ablauf in share() hat drei Stufen,
   je nachdem was der Browser kann; die Einzelheiten stehen dort.

   Ein Bild über einen wa.me-Link anzuhängen geht nicht: der Link kann nur
   Text. Und ein Bild-Upload bräuchte einen Server, den das Spiel bewusst nicht
   hat. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;
  var px = MF.ui.pixel;
  var C = px.colors;

  var SCENE = 180;          /* Kantenlänge der Pixel-Szene */
  var ZOOM = 2;             /* harte Verdopplung, damit Pixel Pixel bleiben */
  var CARD_W = SCENE * ZOOM;
  var HEAD_H = 44, FOOT_H = 128;
  var CARD_H = HEAD_H + SCENE * ZOOM + FOOT_H;

  var INK = '#101319', LINE = '#2a303c';
  var TEXT = '#e9edf3', DIM = '#98a2b4', ACCENT = '#e8761f', GOOD = '#3ecf7a';

  function player() {
    var s = MF.game.state.get();
    return (s && s.player) || {};
  }

  /* Beim Spielen von der Festplatte gibt es keine sinnvolle Adresse zum
     Weitergeben — dann die öffentliche Seite nennen. */
  function gameUrl() {
    var href = String((window.location && window.location.href) || '');
    if (href.indexOf('http') !== 0) return 'https://hopp1395.github.io/MacFit/';
    return href.split('#')[0].split('?')[0];
  }

  /* ---------- Text ---------------------------------------------------------- */

  function text(poseId) {
    var s = MF.game.state.get();
    var st = MF.game.stats;
    var fit = MF.game.fitness;
    var name = player().name || 'Ich';
    var pose = MF.ui.poses.get(poseId);

    var lines = [];
    lines.push('💪 ' + name + ' bei MacFit — ' + pose.name);
    lines.push('');
    lines.push('Fitness-Index: ' + fit.index() + ' — ' + fit.rank().name);
    lines.push('Muskelmasse: ' + util.formatKg(st.muscleMass()));
    lines.push('Level ' + s.level + ' · ' + MF.game.progression.currentTitle());
    lines.push('Tag ' + s.day + ' · ' + s.stats.totalSets + ' Sätze trainiert');
    if (s.stats.natural) lines.push('🌿 Natural — alles ohne Hilfsmittel');

    lines.push('');
    lines.push('Trau dich auch ins Studio — MacFit läuft direkt im Browser,');
    lines.push('ohne Anmeldung: ' + gameUrl());
    return lines.join('\n');
  }

  /* ---------- Bild ---------------------------------------------------------- */

  /* Eigene Kulisse statt der Gym-Wand: dort hängt auf Kopfhöhe ein Plakat,
     das der posierenden Figur genau auf dem Schädel sitzt. Hier stattdessen
     eine Wand mit Scheinwerferkegel — das passt ohnehin besser zu einer Pose. */
  function stage(ctx) {
    var horizon = 128;
    px.rect(ctx, 0, 0, SCENE, horizon, C.wallDark);
    for (var x = 0; x < SCENE; x += 26) px.line(ctx, x, 0, x, horizon, 1, C.wall);
    px.dither(ctx, 34, 0, 112, horizon, C.wall, 3);
    px.dither(ctx, 56, 0, 68, horizon, C.wallLit, 4);
    px.rect(ctx, 0, horizon, SCENE, 2, C.ink);
    px.rect(ctx, 0, horizon + 2, SCENE, SCENE - horizon - 2, C.floorDark);
    px.dither(ctx, 0, horizon + 2, SCENE, SCENE - horizon - 2, C.floor, 3);
  }

  function sceneCanvas(poseId) {
    var canvas = document.createElement('canvas');
    canvas.width = SCENE;
    canvas.height = SCENE;
    var ctx = null;
    try {
      ctx = canvas.getContext('2d', { willReadFrequently: true });
    } catch (err) {
      ctx = canvas.getContext('2d');
    }
    if (!ctx) return null;

    stage(ctx);
    MF.ui.poses.draw(ctx, poseId, {
      shorts: MF.data.outfits.get(player().outfit).shirt
    });
    px.quantize(ctx, SCENE, SCENE);
    return canvas;
  }

  /* ---------- Vorschau in ganzen Bildschirmpunkten -------------------------- */

  /* Die Karte ist 360 Punkte breit und wurde per CSS auf 260 gestaucht. Das
     sind 1,444 CSS-Punkte je Kartenpunkt, und weil image-rendering: pixelated
     nicht mittelt, sondern den naechsten Nachbarn nimmt, faellt dabei rund
     jede vierte Spalte ersatzlos weg — feine Linien wie Schluesselbein,
     Bauchkerben oder die Augen verschwinden stellenweise ganz.

     Deshalb wird die Vorschau auf den groessten ganzzahligen Faktor gebracht,
     der noch in die verfuegbare Breite passt. Gerechnet wird in echten
     Bildschirmpunkten, nicht in CSS-Punkten: erst dort entscheidet sich, ob
     ein Bildpunkt sauber aufgeht. Das exportierte Bild bleibt unberuehrt bei
     360 x 532 — es wird nur angezeigt, nicht neu berechnet. */
  function availableWidth(node) {
    var w = node && node.clientWidth;
    if (w > 0) return w;
    /* Vor dem Einhaengen laesst sich nichts messen — dann aus dem Fenster
       rechnen: Overlay-Rand 16, Modal-Rand 18, Modal hoechstens 440 breit. */
    var inner = window.innerWidth || 390;
    return Math.max(180, Math.min(440, inner - 32) - 36);
  }

  function previewOf(card, availCss) {
    var dpr = window.devicePixelRatio || 1;
    var factor = Math.floor((availCss * dpr) / CARD_W);
    if (!(factor >= 1)) factor = 1;

    var out, ctx;
    try {
      out = document.createElement('canvas');
      out.width = CARD_W * factor;
      out.height = CARD_H * factor;
      ctx = out.getContext('2d');
    } catch (err) {
      return card;
    }
    if (!ctx || !ctx.drawImage) return card;

    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    try {
      ctx.drawImage(card, 0, 0, out.width, out.height);
    } catch (err) {
      return card;
    }
    /* Breite fest in CSS-Punkten setzen, damit ein Kartenpunkt genau factor
       Bildschirmpunkte belegt. Die Angabe schlaegt die Stilvorlage. */
    out.style.width = (CARD_W * factor / dpr) + 'px';
    out.style.height = 'auto';
    return out;
  }

  function label(ctx, str, x, y, font, color, align) {
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  function buildCard(poseId) {
    var scene = sceneCanvas(poseId);
    if (!scene) return null;

    var card = document.createElement('canvas');
    card.width = CARD_W;
    card.height = CARD_H;
    var ctx = card.getContext('2d');
    if (!ctx) return null;

    var s = MF.game.state.get();
    var fit = MF.game.fitness;
    var pose = MF.ui.poses.get(poseId);

    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    /* Kopfzeile — zweifarbig wie im Spiel */
    var brand = 'bold 21px Verdana, Geneva, sans-serif';
    ctx.font = brand;
    label(ctx, 'Mac', 16, 29, brand, TEXT);
    label(ctx, 'Fit', 16 + ctx.measureText('Mac').width, 29, brand, ACCENT);
    label(ctx, pose.name.toUpperCase(), CARD_W - 16, 27,
      'bold 11px Verdana, Geneva, sans-serif', ACCENT, 'right');
    ctx.fillStyle = LINE;
    ctx.fillRect(0, HEAD_H - 1, CARD_W, 1);

    /* Szene hart verdoppeln — Weichzeichnen würde den Pixelstil zerstören. */
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.drawImage(scene, 0, HEAD_H, CARD_W, SCENE * ZOOM);

    var y = HEAD_H + SCENE * ZOOM;
    ctx.fillStyle = LINE;
    ctx.fillRect(0, y, CARD_W, 1);

    label(ctx, player().name || 'Namenlos', 16, y + 32,
      'bold 26px Verdana, Geneva, sans-serif', TEXT);
    label(ctx, 'FIT ' + fit.index(), CARD_W - 16, y + 32,
      'bold 26px Verdana, Geneva, sans-serif', ACCENT, 'right');

    label(ctx, MF.game.progression.currentTitle(), 16, y + 54,
      '14px Verdana, Geneva, sans-serif', DIM);
    label(ctx, fit.rank().name, CARD_W - 16, y + 54,
      'bold 14px Verdana, Geneva, sans-serif', DIM, 'right');

    label(ctx,
      util.formatKg(MF.game.stats.muscleMass()) + '  ·  Level ' + s.level
        + '  ·  Tag ' + s.day + '  ·  ' + s.stats.totalSets + ' Sätze',
      16, y + 80, '14px Verdana, Geneva, sans-serif', TEXT);

    if (s.stats.natural) {
      label(ctx, '🌿 Natural', CARD_W - 16, y + 80,
        'bold 13px Verdana, Geneva, sans-serif', GOOD, 'right');
    }

    /* Die Einladung gehört aufs Bild: ein weitergeleiteter Screenshot trägt
       den Text nicht mit, den Link aber schon. */
    ctx.fillStyle = LINE;
    ctx.fillRect(16, y + 94, CARD_W - 32, 1);
    label(ctx, 'Mitspielen: ' + gameUrl().replace(/^https?:\/\//, ''),
      CARD_W / 2, y + 116, '13px Verdana, Geneva, sans-serif', DIM, 'center');

    return card;
  }

  /* ---------- Versenden ----------------------------------------------------- */

  /* Synchron umwandeln, nicht über toBlob: der Rückruf käme nach dem Antippen
     an, und navigator.share verlangt eine noch laufende Nutzergeste. */
  function toFile(canvas, name) {
    var url = canvas.toDataURL('image/png');
    var parts = url.split(',');
    var bin = window.atob(parts[1]);
    var arr = new window.Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new window.File([arr], name, { type: 'image/png' });
  }

  function canShare() {
    return !!(window.navigator && window.navigator.share);
  }

  function canShareFiles() {
    var nav = window.navigator;
    return !!(nav && nav.share && nav.canShare && window.File && window.Uint8Array);
  }

  function run(promise) {
    if (promise && promise['catch']) {
      promise['catch'](function () { /* abgebrochen ist kein Fehler */ });
    }
  }

  /* Bild in den Downloads ablegen. Das ist kein Ersatz fürs Teilen, aber der
     einzige Weg, der ohne Teilen-Blatt überall funktioniert. */
  function download(canvas) {
    try {
      var a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'macfit-pose.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    } catch (err) {
      return false;
    }
  }

  function copyText(message) {
    var nav = window.navigator;
    if (nav && nav.clipboard && nav.clipboard.writeText) {
      try {
        run(nav.clipboard.writeText(message));
        return true;
      } catch (err) {
        return false;
      }
    }
    return false;
  }

  /* Ein Knopf, drei Stufen — die erste, die das Gerät kann, gewinnt:
       1. Teilen-Blatt mit Bild und Text  (Handy: darin steht WhatsApp)
       2. Teilen-Blatt nur mit Text, Bild vorher in die Downloads
       3. Bild speichern und Text in die Zwischenablage

     Der frühere Weg über einen wa.me-Link ist raus: er schickt nur Text, und
     nach einem ausgelösten Download blockieren Browser das Pop-up ohnehin. */
  function share(canvas, message) {
    if (canvas && canShareFiles()) {
      try {
        var data = { files: [toFile(canvas, 'macfit-pose.png')], text: message, title: 'MacFit' };
        if (window.navigator.canShare(data)) {
          run(window.navigator.share(data));
          return 'files';
        }
      } catch (err) {
        /* fällt durch auf die nächste Stufe */
      }
    }

    if (canShare()) {
      var saved = canvas ? download(canvas) : false;
      try {
        run(window.navigator.share({ title: 'MacFit', text: message }));
        MF.ui.toast.show(saved
          ? 'Bild gespeichert — im Chat noch anhängen.'
          : 'Text geteilt.', 'good');
        return 'text';
      } catch (err) {
        /* fällt durch auf die nächste Stufe */
      }
    }

    var okImage = canvas ? download(canvas) : false;
    var okText = copyText(message);
    MF.ui.toast.show(
      okImage && okText ? 'Bild gespeichert, Text kopiert — jetzt einfügen.'
        : okImage ? 'Bild gespeichert.'
        : okText ? 'Text kopiert.'
        : 'Teilen geht in diesem Browser leider nicht.',
      okImage || okText ? 'good' : 'warn'
    );
    return 'fallback';
  }

  /* ---------- Dialog -------------------------------------------------------- */

  function show() {
    var chosen = MF.ui.poses.list[0].id;
    var stage = el('div.share__stage');
    var grid = el('div.share__poses');
    var card = null;

    function drawCard() {
      card = buildCard(chosen);
      util.clear(stage);
      if (card) {
        /* card bleibt die 360er Fassung — sie wird geteilt und gespeichert.
           Angezeigt wird eine ganzzahlig vergroesserte Kopie davon. */
        var view = previewOf(card, availableWidth(stage));
        view.className = 'share__card';
        stage.appendChild(view);
      } else {
        stage.appendChild(el('p.share__note', {
          text: 'Dieser Browser kann kein Bild erzeugen — Teilen geht als Text.'
        }));
      }
    }

    MF.ui.poses.list.forEach(function (p, idx) {
      /* Gesperrte Posen bleiben sichtbar, aber nicht wählbar — man soll sehen,
         worauf man hinarbeitet. Dieselbe Darstellung wie bei den Geräten im
         Gym: abgeblendet, mit dem nötigen Level statt des Hinweistextes. */
      var locked = !MF.ui.poses.isUnlocked(p.id);
      var btn = el('button.posebtn' + (idx === 0 ? '.is-active' : '')
        + (locked ? '.is-locked' : ''), { type: 'button' }, [
        el('span.posebtn__name', { text: p.name }),
        el('span.posebtn__hint', { text: locked ? '🔒 ab Level ' + p.level : p.hint })
      ]);
      util.onTap(btn, function () {
        chosen = p.id;
        for (var i = 0; i < grid.children.length; i++) {
          grid.children[i].classList.toggle('is-active', i === idx);
        }
        drawCard();
      });
      grid.appendChild(btn);
    });

    var body = el('div.share', null, [
      stage,
      el('p.share__label', { text: 'Pose' }),
      grid,
      el('p.share__note', {
        text: 'Verschickt werden nur dieses Bild und der Text mit dem '
            + 'Einladungslink. Dein Foto und dein Spielstand bleiben auf dem Gerät.'
      })
    ]);

    /* Sagen, was passieren wird, statt hinterher zu überraschen. */
    if (!canShareFiles()) {
      body.appendChild(el('p.share__note.share__note--warn', {
        text: canShare()
          ? 'Dieser Browser teilt keine Bilder direkt. Das Bild landet in den '
            + 'Downloads, den Text kannst du gleich weitergeben.'
          : 'Dieser Browser hat kein Teilen-Menü. Bild und Text werden '
            + 'gespeichert beziehungsweise kopiert — anhängen musst du selbst.'
      }));
    }

    drawCard();

    MF.ui.modal.open({
      title: 'Erfolge teilen',
      subtitle: 'Pose wählen, dann teilen.',
      body: body,
      dismissible: true,
      actions: [
        {
          label: '📤 Teilen',
          tone: 'primary',
          onTap: function () { share(card, text(chosen)); }
        },
        {
          label: 'Bild speichern',
          tone: 'ghost',
          onTap: function () {
            var ok = download(card);
            MF.ui.toast.show(ok ? 'Bild gespeichert.' : 'Bild konnte nicht gespeichert werden.',
              ok ? 'good' : 'warn');
          }
        },
        { label: 'Abbrechen', tone: 'ghost' }
      ]
    });

    /* Noch einmal, jetzt mit echter Breite: vor modal.open haengt die Bühne
       nicht im Dokument und laesst sich nicht messen. */
    drawCard();
  }

  MF.ui.share = {
    show: show,
    text: text,
    buildCard: buildCard,
    share: share,
    download: download,
    gameUrl: gameUrl,
    canShare: canShare,
    canShareFiles: canShareFiles,
    cardSize: { w: CARD_W, h: CARD_H }
  };
})(window.MacFit);
