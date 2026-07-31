/* Zeichnet eine Figur aus Gelenkpunkten auf den Pixel-Canvas.

   Gezeichnet wird in drei Durchgängen — so entsteht der typische Sprite-Look:
     1. Kontur   alle Glieder etwas dicker in Fast-Schwarz  -> Silhouette
     2. Fläche   alle Glieder in Hautton
     3. Licht    dünner Streifen versetzt oben-links        -> Volumen

   Die Strichstärken kommen aus den Muskelwerten: dieselbe Figur wird mit dem
   Trainingsfortschritt sichtbar breiter. */
(function (MF) {
  'use strict';

  var px = MF.ui.pixel;
  var C = px.colors;
  var util = MF.core.util;

  var LIGHT = [-1, -1];   /* Lichtquelle oben links */

  function offset(p, d) { return [p[0] + d[0], p[1] + d[1]]; }
  function between(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }

  /* Strichstärken aus dem Spielstand.

     Dieselben Verhältnisse wie im Posenbild, um 0,70 kleiner gerechnet — die
     Szenenfigur ist 91 Punkte hoch, die posierende 129,5. Die Gelenkpunkte
     stehen in data/scenes.js und sind bereits richtig proportioniert (6,5
     Kopfhöhen, Beine 49 % der Höhe); zu korrigieren waren nur die Stärken.
     Unterarm zu Oberarm lag bei 0,58 statt 0,75, Wade zu Schenkel bei 0,64
     statt 0,72. torso ist hier die Körpertiefe, nicht die Breite von vorn —
     die Szenen sind Seitenansichten. */
  function thicknessFromState() {
    var m = MF.game.state.get().muscles;
    function f(id) { return util.clamp(m[id].size / 100, 0, 1); }
    var arm = (f('bizeps') + f('trizeps')) / 2;
    var torso = (f('brust') + f('ruecken')) / 2;

    return {
      arm: 4.3 + arm * 3.6,
      fore: 3.4 + arm * 2.5,          /* 0,75 x arm   */
      torso: 10 + torso * 8,
      shoulder: 3.6 + f('schultern') * 1.8,
      thigh: 8.2 + f('beine') * 3.7,  /* 1,4  x arm   */
      calf: 5.7 + f('waden') * 2.9,   /* 0,72 x thigh */
      head: 7
    };
  }

  /* Feste Werte für Hintergrundleute — die sollen nicht mitwachsen. */
  function npcThickness(seed) {
    var v = ((seed * 7) % 5) / 5;
    return {
      arm: 5 + v * 2.5, fore: 3.8 + v * 1.8, torso: 12 + v * 5,
      shoulder: 4 + v * 1.2, thigh: 9 + v * 2.5, calf: 6.3 + v * 1.8, head: 7
    };
  }

  /* Die abgewandte Seite folgt normalerweise der nahen — Geräteszenen sind
     symmetrisch. Wer Gegenbewegung braucht, etwa beim Gehen, gibt farKnee,
     farFoot, farElbow und farHand zusätzlich an. */
  function farSide(f) {
    return {
      knee: f.farKnee || f.knee,
      foot: f.farFoot || f.foot,
      elbow: f.farElbow || f.elbow,
      hand: f.farHand || f.hand
    };
  }

  /* Alle Glieder einer Pose als Liste [von, nach, Stärke]. */
  function limbs(f, th) {
    var farDx = [-4, 0];
    var o = farSide(f);
    return {
      far: [
        [offset(f.hip, farDx), offset(o.knee, farDx), th.thigh * 0.88],
        [offset(o.knee, farDx), offset(o.foot, farDx), th.calf * 0.88],
        [offset(f.shoulder, farDx), offset(o.elbow, farDx), th.arm * 0.82],
        [offset(o.elbow, farDx), offset(o.hand, farDx), th.fore * 0.82]
      ],
      near: [
        [f.shoulder, f.hip, th.torso],
        [f.hip, f.knee, th.thigh],
        [f.knee, f.foot, th.calf],
        [f.shoulder, f.elbow, th.arm],
        [f.elbow, f.hand, th.fore]
      ]
    };
  }

  function strokeAll(ctx, list, extra, color) {
    for (var i = 0; i < list.length; i++) {
      px.capsule(ctx, list[i][0], list[i][1], list[i][2] + extra, color);
    }
  }

  /* opts: { shirt, shorts, skin, skinDark, skinLit, face } */
  function draw(ctx, f, th, opts) {
    opts = opts || {};
    var skin = opts.skin || C.skin;
    var skinDark = opts.skinDark || C.skinDark;
    var skinLit = opts.skinLit || C.skinLit;
    var shirt = opts.shirt || C.shirt;
    var shirtLit = opts.shirtLit || C.shirtLit;
    var shorts = opts.shorts || C.jeans;
    var shoe = opts.shoe || C.shadow;
    var face = opts.face === undefined ? 1 : opts.face;

    var L = limbs(f, th);
    var o = farSide(f);
    var hr = th.head;
    var toe = [f.foot[0] + face * 5.5, f.foot[1] + 1.5];
    var farToe = [o.foot[0] + face * 5.5 - 4, o.foot[1] + 1.5];
    var footW = th.calf * 0.8;

    /* 1. Kontur: erst hinten, dann vorne — ergibt eine saubere Silhouette. */
    strokeAll(ctx, L.far, 2, C.ink);
    px.capsule(ctx, offset(o.foot, [-4, 0]), farToe, footW + 2, C.ink);
    px.disc(ctx, f.head[0], f.head[1], hr + 1, C.ink);
    strokeAll(ctx, L.near, 2, C.ink);
    px.capsule(ctx, f.foot, toe, footW + 2, C.ink);
    px.disc(ctx, f.hand[0], f.hand[1], th.fore * 0.62 + 1.5, C.ink);

    /* 2. Fläche */
    strokeAll(ctx, L.far, 0, skinDark);
    px.capsule(ctx, offset(o.foot, [-4, 0]), farToe, footW, C.ink);

    px.capsule(ctx, f.shoulder, f.hip, th.torso, skin);
    px.capsule(ctx, f.hip, f.knee, th.thigh, skin);
    px.capsule(ctx, f.knee, f.foot, th.calf, skin);
    px.disc(ctx, f.shoulder[0], f.shoulder[1], th.shoulder, skin);
    px.capsule(ctx, f.shoulder, f.elbow, th.arm, skin);
    px.capsule(ctx, f.elbow, f.hand, th.fore, skin);
    px.disc(ctx, f.hand[0], f.hand[1], th.fore * 0.62, skin);

    /* Kleidung */
    px.capsule(ctx, f.shoulder, between(f.shoulder, f.hip, 0.6), th.torso * 0.9, shirt);
    px.capsule(ctx, f.hip, between(f.hip, f.knee, 0.48), th.thigh * 1.1, shorts);
    px.capsule(ctx, f.foot, toe, footW, shoe);

    /* Kopf: Gesicht, flacher Haarschnitt, ein Auge in Blickrichtung. */
    px.disc(ctx, f.head[0], f.head[1], hr, skin);
    px.capsule(ctx,
      [f.head[0] - hr * 0.55, f.head[1] - hr * 0.42],
      [f.head[0] + hr * 0.55, f.head[1] - hr * 0.42],
      hr * 0.95, opts.hair || C.shadow);
    px.rect(ctx, f.head[0] + face * 2 - 0.5, f.head[1] + 0.5, 1.5, 2, C.ink);

    /* 3. Licht: schmaler Streifen leicht versetzt. */
    px.capsule(ctx, offset(f.shoulder, LIGHT), offset(between(f.shoulder, f.hip, 0.55), LIGHT),
      th.torso * 0.30, shirtLit);
    px.capsule(ctx, offset(f.shoulder, LIGHT), offset(f.elbow, LIGHT), th.arm * 0.34, skinLit);
    px.capsule(ctx, offset(between(f.hip, f.knee, 0.45), LIGHT), offset(f.knee, LIGHT),
      th.thigh * 0.30, skinLit);
    px.disc(ctx, f.shoulder[0] - 1.5, f.shoulder[1] - 1.5, th.shoulder * 0.42, skinLit);
  }

  /* ---------- Geräte am Körper -------------------------------------------- */

  function drawImplement(ctx, kind, f) {
    if (!kind || kind === 'none') return;
    var at = (kind === 'sled' || kind === 'roller') ? f.foot : f.hand;

    if (kind === 'barbell') {
      px.disc(ctx, at[0], at[1], 10, C.ink);
      px.disc(ctx, at[0], at[1], 8.5, C.steelDark);
      px.disc(ctx, at[0] - 1, at[1] - 1, 4, C.steel);
    } else if (kind === 'dumbbell') {
      px.disc(ctx, at[0], at[1], 6.5, C.ink);
      px.disc(ctx, at[0], at[1], 5, C.steelDark);
      px.disc(ctx, at[0] - 1, at[1] - 1, 2, C.steel);
    } else if (kind === 'handle') {
      px.rect(ctx, at[0] - 4, at[1] - 7, 8, 14, C.ink);
      px.rect(ctx, at[0] - 3, at[1] - 6, 6, 12, C.steel);
    } else if (kind === 'roller') {
      px.disc(ctx, at[0], at[1], 7, C.ink);
      px.disc(ctx, at[0], at[1], 5.5, C.steelDark);
    } else if (kind === 'sled') {
      var dx = at[0] - f.knee[0], dy = at[1] - f.knee[1];
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len * 15, ny = dx / len * 15;
      px.capsule(ctx, [at[0] + nx, at[1] + ny], [at[0] - nx, at[1] - ny], 9, C.ink);
      px.capsule(ctx, [at[0] + nx, at[1] + ny], [at[0] - nx, at[1] - ny], 6, C.steelDark);
    }
  }

  MF.ui.figure = {
    draw: draw,
    drawImplement: drawImplement,
    between: between,
    thicknessFromState: thicknessFromState,
    npcThickness: npcThickness
  };
})(window.MacFit);
