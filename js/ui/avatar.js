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

    /* Dieselben Rampen wie im Posenbild: schattiert wird über Stufen, nicht
       über gemischte Farben. Gemischte Zwischentöne hatte quantize() vorher auf
       die Bodenfarben geschoben, und der fahle Teint tat bis Gesundheit 30 gar
       nichts. */
    var r = health < 30 ? px.ramp('pale', 2)
          : health < 55 ? px.ramp('pale', 3)
          : px.ramp('skin', 4);

    var skin = r(0);
    var skinLit = r(1);

    /* Müde Partien werden dunkler — eine Rampenstufe je halbe Ermüdung. */
    function tone(id) {
      return r(-Math.round(util.clamp(m[id].fatigue, 0, 1) * 2));
    }

    surface.clear();

    /* Boden-Schatten */
    px.disc(ctx, CX, 108, 17, C.wallDark);
    px.disc(ctx, CX, 108, 13, C.wall);

    /* --- Maße aus den Muskelwerten ------------------------------------- */
    /* Dieselben Verhältnisse wie im Posenbild, nur um 0,77 kleiner gerechnet —
       die Figur dort ist 129,5 Punkte hoch, diese 99,5. Sonst hätte der
       Spieler im Körper-Bildschirm eine andere Figur als auf dem Teilen-Bild. */
    var shoulderW = 9.0 + f('schultern') * 4.4;
    var chestW = 4.0 + f('brust') * 2.7;
    var waistW = 11.4 + f('bauch') * 4.9;
    var armW = 4.7 + f('bizeps') * 3.9;
    var foreW = 3.7 + f('trizeps') * 2.7;      /* 0,75 x armW  */
    var thighW = 8.9 + f('beine') * 4.0;       /* 1,4  x armW  */
    var calfW = 6.2 + f('waden') * 3.2;        /* 0,72 x thighW */
    var backW = 12 + f('ruecken') * 13.5;

    /* Schulter 0,81 · Hüfte 0,53 · Knie 0,27 der Körperhöhe über dem Boden.
       Vorher lag die Hüfte bei 64 — die Beine machten nur 40 % der Höhe aus. */
    var shoulderY = 23, hipY = 51, kneeY = 77, footY = 104;
    var elbowY = 41, handY = 56;
    var hipX = thighW * 0.37;

    /* Verjüngte Beine statt zweier gleich dicker Rohre. Die Füße stehen
       deutlich weiter auseinander als die Hüftgelenke — senkrecht untereinander
       verschmelzen die beiden Schenkel zu einem Block. */
    function leg(side, color, extra) {
      var e = extra || 0;
      var hip = [CX + side * hipX, hipY];
      var knee = [CX + side * (hipX + 2), kneeY];
      var foot = [CX + side * (hipX + 3.5), footY];
      px.capsule(ctx, knee, foot, calfW * 0.6 + e, color);
      px.capsule(ctx, hip, knee, thighW * 0.8 + e, color);
      px.capsule(ctx, knee, [(knee[0] + foot[0]) / 2, (kneeY + footY) / 2], calfW + e, color);
      px.capsule(ctx, hip, [(hip[0] + knee[0]) / 2, hipY + (kneeY - hipY) * 0.78], thighW + e, color);
    }

    function arm(side, color, extra) {
      var e = extra || 0;
      px.capsule(ctx, [CX + side * shoulderW, shoulderY],
        [CX + side * (shoulderW + 3), elbowY], armW + e, color);
      px.capsule(ctx, [CX + side * (shoulderW + 3), elbowY],
        [CX + side * (shoulderW + 4.5), handY], foreW + e, color);
    }

    /* Trapezmuskel: die Schräge vom Hals zur Schulter. Ohne sie stehen die
       Schulterkugeln frei neben dem Kopf und sehen aus wie Ohren. */
    function trapz(color, extra) {
      var e = extra || 0;
      px.capsule(ctx, [CX - 2, shoulderY - 6], [CX - shoulderW * 0.86, shoulderY + 1], 6 + e, color);
      px.capsule(ctx, [CX + 2, shoulderY - 6], [CX + shoulderW * 0.86, shoulderY + 1], 6 + e, color);
    }

    /* --- Kontur --------------------------------------------------------- */
    leg(-1, C.ink, 2);
    leg(1, C.ink, 2);
    px.capsule(ctx, [CX, shoulderY], [CX, hipY - 2], backW + 2, C.ink);
    arm(-1, C.ink, 2);
    arm(1, C.ink, 2);
    px.disc(ctx, CX - shoulderW, shoulderY, (shoulderW * 0.42) + 2, C.ink);
    px.disc(ctx, CX + shoulderW, shoulderY, (shoulderW * 0.42) + 2, C.ink);
    trapz(C.ink, 2);
    px.capsule(ctx, [CX, 17], [CX, shoulderY], 9, C.ink);
    px.disc(ctx, CX, 12, 8.5, C.ink);

    /* --- Flächen -------------------------------------------------------- */
    leg(-1, tone('beine'), 0);
    leg(1, tone('beine'), 0);

    /* Hals vor dem Rumpf, sonst steht sein unteres Ende als Fleck auf der Brust. */
    px.capsule(ctx, [CX, 18], [CX, shoulderY - 1], 7, r(-2));
    px.capsule(ctx, [CX, shoulderY], [CX, hipY - 2], backW, tone('ruecken'));
    /* Taille schmaler als der Brustkorb — das macht die V-Form. */
    px.capsule(ctx, [CX, hipY - 10], [CX, hipY - 2], waistW, tone('bauch'));
    trapz(tone('schultern'), 0);

    arm(-1, tone('bizeps'), 0);
    arm(1, tone('bizeps'), 0);

    px.disc(ctx, CX - shoulderW, shoulderY, shoulderW * 0.42, tone('schultern'));
    px.disc(ctx, CX + shoulderW, shoulderY, shoulderW * 0.42, tone('schultern'));

    /* Brust. Der Radius ist so bemessen, dass die Scheiben innerhalb des
       Brustkorbs bleiben — vorher standen sie darüber hinaus auf den Armen. */
    px.disc(ctx, CX - chestW * 0.85, 31, chestW, tone('brust'));
    px.disc(ctx, CX + chestW * 0.85, 31, chestW, tone('brust'));

    /* Kopf */
    /* Kopf als handgezeichnetes Raster, dieselbe Machart wie im Posenbild,
       nur 15 x 15 statt 19 x 19. */
    px.stamp(ctx, MF.ui.sprites.headSmall, CX - 7, 5, r);

    /* Shorts in der gewählten Farbe */
    var outfit = MF.data.outfits.get(s.player ? s.player.outfit : 'blau');
    var sw = hipX + thighW * 0.5;
    px.rect(ctx, CX - sw - 1, hipY - 4, (sw + 1) * 2, 13, C.ink);
    px.rect(ctx, CX - sw, hipY - 3, sw * 2, 11, outfit.shirt);
    px.rect(ctx, CX - 1, hipY - 3, 2, 11, C.ink);

    /* --- Licht und Definition ------------------------------------------- */
    px.capsule(ctx, [CX - 3, shoulderY + 3], [CX - 3, hipY - 12], backW * 0.22, skinLit);
    px.disc(ctx, CX - shoulderW - 1, shoulderY - 1, shoulderW * 0.18, skinLit);
    px.disc(ctx, CX + shoulderW - 1, shoulderY - 1, shoulderW * 0.18, skinLit);

    /* Bauchmuskeln zeichnen sich erst ab einer gewissen Größe ab. */
    if (m.bauch.size > 26) {
      var rows = m.bauch.size > 55 ? 3 : 2;
      for (var row = 0; row < rows; row++) {
        px.rect(ctx, CX - 4, hipY - 13 + row * 4, 3, 2, r(-3));
        px.rect(ctx, CX + 1, hipY - 13 + row * 4, 3, 2, r(-3));
      }
    }

    surface.present();
  }

  MF.ui.avatar = {
    create: create,
    update: update
  };
})(window.MacFit);
