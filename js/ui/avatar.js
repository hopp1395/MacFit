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
    /* Die Rumpfmaße kommen aus ui/shape.js — dieselbe Rechnung wie im
       Posenbild, nur mit dem kleineren Faktor: die Figur dort ist 129,5 Punkte
       hoch, diese 99,5. Sonst hätte der Spieler im Körper-Bildschirm eine
       andere Figur als auf dem Teilen-Bild.

       Das Koerperfett sitzt in der Mitte: definiert wird sie schmaler, weich
       baucht sie aus. Der Rest der Figur bleibt, wie er ist — Fett macht nicht
       den Arm dick. */
    var definition = MF.game.fat.definition();
    var sh = MF.ui.shape.own();
    var k = MF.ui.shape.K.avatar;
    var shoulderW = sh.shoulderHalf * k;
    var chestW = 4.0 + f('brust') * 2.7;
    var waistW = sh.waistHalf * 2 * k;
    var bulgeW = sh.bulgeHalf * 2 * k;
    var armW = 4.7 + f('bizeps') * 3.9;
    var foreW = 3.7 + f('trizeps') * 2.7;      /* 0,75 x armW  */
    var thighW = sh.thighW * k;
    var calfW = sh.calfW * k;                  /* 0,72 x thighW */
    var backW = sh.latHalf * 2 * k;

    /* Schulter 0,81 · Hüfte 0,53 · Knie 0,27 der Körperhöhe über dem Boden.
       Vorher lag die Hüfte bei 64 — die Beine machten nur 40 % der Höhe aus. */
    var shoulderY = 23, hipY = 51, kneeY = 77, footY = 104;
    var elbowY = 41, handY = 56;
    var hipX = sh.hipHalf * k;

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

    /* Der Rumpf verjüngt sich zur Taille — entlang derselben Kurve wie im
       Posenbild, die in ui/shape.js steht.

       Vorher war er ein Rohr gleicher Breite von der Schulter bis zur Hüfte,
       mit einer schmaleren Taillenkapsel darin. Die lag damit unsichtbar im
       Rumpf: die V-Form kam im Körper-Bildschirm nie an, egal wie trainiert
       die Figur war.

       Ein Polygon wie im Posenbild geht hier nicht — Rücken und Bauch werden
       getrennt eingefärbt (die Ermüdung je Partie), und poly() füllt nur eine
       Fläche. Also ein Stapel waagerechter Kapseln, wie im Profil dort. */
    var TORSO_TOP = shoulderY - 1, TORSO_BOT = hipY - 1;
    var torsoDims = {
      latHalf: backW * 0.5,
      waistHalf: waistW * 0.5,
      bulgeHalf: bulgeW * 0.5,
      belly: sh.belly
    };

    function torso(upper, lower, extra) {
      var e = extra || 0;
      var N = 12, span = TORSO_BOT - TORSO_TOP, h = span / (N - 1);
      for (var i = 0; i < N; i++) {
        var u = i / (N - 1);
        var hw = MF.ui.shape.torsoW(torsoDims, u) + e;
        var y = TORSO_TOP + u * span;
        px.capsule(ctx, [CX - hw, y], [CX + hw, y], h + 1.6 + e * 2,
          u < 0.62 ? upper : lower);
      }
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
    torso(C.ink, C.ink, 2);
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
    /* Oben der Rücken, unten der Bauch — die Kurve dazwischen macht die
       V-Form, und mit Fett kehrt sie sich um: dann ist die Mitte die
       breiteste Stelle. */
    torso(tone('ruecken'), tone('bauch'), 0);
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

    /* Schuhe, ebenfalls als Raster — ihre Kontur steckt darin, deshalb kommen
       sie nicht in den Konturdurchgang. Ohne sie hörten die Beine als zwei
       runde Kapselenden über dem Bodenschatten auf. */
    px.stamp(ctx, MF.ui.sprites.shoeSmall, CX - hipX - 3.5 - 4, footY - 4, r);
    px.stamp(ctx, MF.ui.sprites.shoeSmall, CX + hipX + 3.5 - 4, footY - 4, r);

    /* Shorts in der gewählten Farbe: Bund über der Hüfte plus zwei
       Hosenbeine, die den Oberschenkel wirklich umschließen. Der flache
       Kasten von vorher war schmaler als die Schenkelwölbung — die Beine
       quollen seitlich heraus und verschmolzen darunter zu einem Block. */
    var outfit = MF.data.outfits.get(s.player ? s.player.outfit : 'blau');
    /* Der Bund sitzt auf der Hüfte und richtet sich nach den Schenkeln —
       vorher stand hier ein Math.max gegen backW, also gegen die BRUSTbreite.
       Beim austrainierten Körper war die Hose damit 27 Punkte breit bei einer
       Taille von 11: ein Brett, das dem Körper nicht gehörte. */
    var bw = hipX + thighW * 0.5 + 1;
    function shortLeg(side, color, e) {
      px.capsule(ctx, [CX + side * hipX, hipY + 3],
        [CX + side * (hipX + 1), hipY + 10], thighW + (e || 0), color);
    }
    shortLeg(-1, C.ink, 2);
    shortLeg(1, C.ink, 2);
    px.rect(ctx, CX - bw - 1, hipY - 4, (bw + 1) * 2, 6, C.ink);
    shortLeg(-1, outfit.shirt, 0);
    shortLeg(1, outfit.shirt, 0);
    px.rect(ctx, CX - bw, hipY - 3, bw * 2, 4, outfit.shirt);
    /* Mittelnaht, darunter die Trennlinie der Schenkel — ohne sie liest
       sich der Bereich zwischen den Hosenbeinen als ein Block. */
    px.rect(ctx, CX - 1, hipY - 3, 2, 16, C.ink);
    px.capsule(ctx, [CX, hipY + 13], [CX, hipY + 19], 1.5, C.ink);

    /* --- Licht und Definition ------------------------------------------- */
    px.capsule(ctx, [CX - 3, shoulderY + 3], [CX - 3, hipY - 12], backW * 0.22, skinLit);
    px.disc(ctx, CX - shoulderW - 1, shoulderY - 1, shoulderW * 0.18, skinLit);
    px.disc(ctx, CX + shoulderW - 1, shoulderY - 1, shoulderW * 0.18, skinLit);

    /* Bauchmuskeln zeichnen sich erst ab einer gewissen Größe ab — und nur,
       wenn nicht zu viel darüber liegt. Genau das ist der Sinn des zweiten
       Werts: die Masse kann da sein, ohne dass man sie sieht. */
    if (m.bauch.size > 26 && definition > 0.35) {
      var rows = m.bauch.size > 55 && definition > 0.6 ? 3 : 2;
      for (var row = 0; row < rows; row++) {
        px.rect(ctx, CX - 4, hipY - 13 + row * 4, 3, 2, r(-3));
        px.rect(ctx, CX + 1, hipY - 13 + row * 4, 3, 2, r(-3));
      }
    }

    /* Und wo keine Kerben mehr sind, die Wölbung: ein Lichtfleck auf dem Bauch
       und darunter die Falte, mit der er auf dem Hosenbund aufliegt. Ohne die
       Falte ist die breite Mitte nur ein dicker Rumpf, kein Bauch.

       Beides muss über dem Bund bleiben: der wird weiter oben gezeichnet,
       dieser Durchgang läuft danach und würde ihn übermalen. */
    if (sh.belly > 0.3) {
      px.disc(ctx, CX - 3, hipY - 10, bulgeW * 0.16, skinLit);
      px.capsule(ctx, [CX - bulgeW * 0.34, hipY - 6], [CX + bulgeW * 0.34, hipY - 7],
        1.5, r(-3));
    }

    surface.present();
  }

  MF.ui.avatar = {
    create: create,
    update: update
  };
})(window.MacFit);
