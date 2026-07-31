/* Die Figur im Körper-Bildschirm — Vorderansicht, Pixel-Sprite.
   Jede Partie wird aus ihrem Muskelwert breiter gezeichnet, die Ermüdung
   färbt sie dunkler ein. Bei schlechter Gesundheit wird der Hautton fahl. */
(function (MF) {
  'use strict';

  var px = MF.ui.pixel;
  var C = px.colors;
  var util = MF.core.util;

  var W = 64, H = 116;
  var CX = 32;

  function mix(a, b, t) {
    var out = '#';
    for (var i = 0; i < 3; i++) {
      var av = parseInt(a.substr(1 + i * 2, 2), 16);
      var bv = parseInt(b.substr(1 + i * 2, 2), 16);
      var v = Math.round(av + (bv - av) * util.clamp(t, 0, 1));
      out += ('0' + v.toString(16)).slice(-2);
    }
    return out;
  }

  function create(container) {
    return px.create(container, W, H, 'pix--avatar');
  }

  function update(surface) {
    if (!surface || !surface.ctx) return;
    var ctx = surface.ctx;
    var s = MF.game.state.get();
    var m = s.muscles;
    var health = MF.game.stats.healthAvg();

    function f(id) { return util.clamp(m[id].size / 100, 0, 1); }
    function tone(id) {
      /* Müde Partien werden dunkler. */
      return mix(skin, C.skinDark, m[id].fatigue * 0.75);
    }

    /* Schlechte Werte = fahler Teint. */
    var skin = health < 60 ? mix(C.skin, C.steel, (60 - health) / 90) : C.skin;
    var skinLit = mix(skin, C.skinLit, 0.7);

    surface.clear();

    /* Boden-Schatten */
    px.disc(ctx, CX, 108, 17, C.wallDark);
    px.disc(ctx, CX, 108, 13, C.wall);

    /* --- Maße aus den Muskelwerten ------------------------------------- */
    var shoulderW = 9 + f('schultern') * 8;
    var chestW = 5 + f('brust') * 5;
    var waistW = 7 + f('bauch') * 4;
    var armW = 4 + f('bizeps') * 5;
    var foreW = 3.5 + f('trizeps') * 3;
    var thighW = 7 + f('beine') * 6;
    var calfW = 5 + f('waden') * 4;
    var backW = 11 + f('ruecken') * 9;

    var shoulderY = 30, hipY = 64, kneeY = 86, footY = 104;

    /* --- Kontur --------------------------------------------------------- */
    /* Beine */
    px.capsule(ctx, [CX - 7, hipY], [CX - 8, kneeY], thighW + 2, C.ink);
    px.capsule(ctx, [CX + 7, hipY], [CX + 8, kneeY], thighW + 2, C.ink);
    px.capsule(ctx, [CX - 8, kneeY], [CX - 9, footY], calfW + 2, C.ink);
    px.capsule(ctx, [CX + 8, kneeY], [CX + 9, footY], calfW + 2, C.ink);
    /* Rumpf */
    px.capsule(ctx, [CX, shoulderY], [CX, hipY - 2], backW + 2, C.ink);
    /* Arme */
    px.capsule(ctx, [CX - shoulderW, shoulderY], [CX - shoulderW - 4, 50], armW + 2, C.ink);
    px.capsule(ctx, [CX + shoulderW, shoulderY], [CX + shoulderW + 4, 50], armW + 2, C.ink);
    px.capsule(ctx, [CX - shoulderW - 4, 50], [CX - shoulderW - 6, 68], foreW + 2, C.ink);
    px.capsule(ctx, [CX + shoulderW + 4, 50], [CX + shoulderW + 6, 68], foreW + 2, C.ink);
    /* Schultern und Kopf */
    px.disc(ctx, CX - shoulderW, shoulderY, (shoulderW * 0.42) + 2, C.ink);
    px.disc(ctx, CX + shoulderW, shoulderY, (shoulderW * 0.42) + 2, C.ink);
    px.disc(ctx, CX, 13, 9, C.ink);

    /* --- Flächen -------------------------------------------------------- */
    px.capsule(ctx, [CX - 7, hipY], [CX - 8, kneeY], thighW, tone('beine'));
    px.capsule(ctx, [CX + 7, hipY], [CX + 8, kneeY], thighW, tone('beine'));
    px.capsule(ctx, [CX - 8, kneeY], [CX - 9, footY], calfW, tone('waden'));
    px.capsule(ctx, [CX + 8, kneeY], [CX + 9, footY], calfW, tone('waden'));

    px.capsule(ctx, [CX, shoulderY], [CX, hipY - 2], backW, tone('ruecken'));
    /* Taille schmaler als der Brustkorb — das macht die V-Form. */
    px.capsule(ctx, [CX, hipY - 12], [CX, hipY - 2], waistW, tone('bauch'));

    px.capsule(ctx, [CX - shoulderW, shoulderY], [CX - shoulderW - 4, 50], armW, tone('bizeps'));
    px.capsule(ctx, [CX + shoulderW, shoulderY], [CX + shoulderW + 4, 50], armW, tone('bizeps'));
    px.capsule(ctx, [CX - shoulderW - 4, 50], [CX - shoulderW - 6, 68], foreW, tone('trizeps'));
    px.capsule(ctx, [CX + shoulderW + 4, 50], [CX + shoulderW + 6, 68], foreW, tone('trizeps'));

    px.disc(ctx, CX - shoulderW, shoulderY, shoulderW * 0.42, tone('schultern'));
    px.disc(ctx, CX + shoulderW, shoulderY, shoulderW * 0.42, tone('schultern'));

    /* Brust */
    px.disc(ctx, CX - chestW * 0.85, 38, chestW, tone('brust'));
    px.disc(ctx, CX + chestW * 0.85, 38, chestW, tone('brust'));

    /* Kopf */
    px.disc(ctx, CX, 13, 8, skin);
    px.disc(ctx, CX, 10, 7.5, C.shadow);
    px.rect(ctx, CX - 4, 13, 2, 2, C.ink);
    px.rect(ctx, CX + 2, 13, 2, 2, C.ink);

    /* Shorts in der gewählten Farbe */
    var outfit = MF.data.outfits.get(s.player ? s.player.outfit : 'blau');
    px.rect(ctx, CX - 11, hipY - 4, 22, 12, C.ink);
    px.rect(ctx, CX - 10, hipY - 3, 20, 10, outfit.shirt);
    px.rect(ctx, CX - 1, hipY - 3, 2, 10, C.ink);

    /* --- Licht und Definition ------------------------------------------- */
    px.capsule(ctx, [CX - 3, shoulderY + 3], [CX - 3, hipY - 12], backW * 0.22, skinLit);
    px.disc(ctx, CX - shoulderW - 1, shoulderY - 1, shoulderW * 0.18, skinLit);
    px.disc(ctx, CX + shoulderW - 1, shoulderY - 1, shoulderW * 0.18, skinLit);

    /* Bauchmuskeln zeichnen sich erst ab einer gewissen Größe ab. */
    if (m.bauch.size > 26) {
      var rows = m.bauch.size > 55 ? 3 : 2;
      for (var r = 0; r < rows; r++) {
        px.rect(ctx, CX - 4, hipY - 14 + r * 4, 3, 2, mix(tone('bauch'), C.ink, 0.35));
        px.rect(ctx, CX + 1, hipY - 14 + r * 4, 3, 2, mix(tone('bauch'), C.ink, 0.35));
      }
    }

    surface.present();
  }

  MF.ui.avatar = {
    create: create,
    update: update
  };
})(window.MacFit);
