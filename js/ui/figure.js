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
  var DARK = [1.5, 1];    /* Schattenseite gegenüber */

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
      head: 7,
      /* 0..1, keine Strichstaerke: der Bauch. Im Seitenriss ist er die
         einzige Stelle, an der Koerperfett ueberhaupt sichtbar wird — von
         vorn verschwindet er hinter der Breite. */
      belly: MF.game.fat.softness()
    };
  }

  /* Feste Werte für Hintergrundleute — die sollen nicht mitwachsen. Einer von
     fünfen hat einen Bauch: ein echtes Studio besteht nicht nur aus
     Athleten. */
  function npcThickness(seed) {
    var v = ((seed * 7) % 5) / 5;
    return {
      arm: 5 + v * 2.5, fore: 3.8 + v * 1.8, torso: 12 + v * 5,
      shoulder: 4 + v * 1.2, thigh: 9 + v * 2.5, calf: 6.3 + v * 1.8, head: 7,
      belly: v < 0.1 ? 0.6 : 0
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

  /* opts: { shirt, shorts, skin, skinDark, skinLit, face, ramp } */
  function draw(ctx, f, th, opts) {
    opts = opts || {};
    /* Schattiert wird über Rampenstufen, damit quantize() die Zwischentöne
       nicht auf die Bodenfarben schiebt. opts.skin* bleiben als Ausweg für
       Aufrufer, die eine feste Farbe brauchen. */
    var r = opts.ramp || px.ramp('skin', 4);
    var skin = opts.skin || r(0);
    var skinDark = opts.skinDark || r(-2);
    var skinLit = opts.skinLit || r(1);
    var soft = r(-1);
    var shirt = opts.shirt || C.shirt;
    var shirtLit = opts.shirtLit || C.shirtLit;
    var shorts = opts.shorts || C.jeans;
    var shoe = opts.shoe || C.shadow;
    var face = opts.face === undefined ? 1 : opts.face;

    var L = limbs(f, th);
    var o = farSide(f);
    var hr = th.head;
    /* Liefert die Pose eine eigene Zehenposition (f.toe), kippt der Fuss um
       sie — so hebt sich beim Wadenheben die Ferse, waehrend die Zehen am
       Boden bleiben. Ohne toe zeigt der Fuss starr in Blickrichtung. */
    var toe = f.toe || [f.foot[0] + face * 5.5, f.foot[1] + 1.5];
    /* Der hintere Fuss braucht eine eigene Spitze (f.farToe), sobald sich die
       Fuesse unabhaengig bewegen — beim Gehen etwa. Fehlt sie, wird die
       vordere Spitze mit ihrem ABSTAND zum Fuss uebernommen: bei Szenen mit
       gleichlaufenden Fuessen (Wadenheben) kommt dasselbe heraus wie frueher,
       beim Gehen zog sie den hinteren Schuh sonst zum vorderen hinueber. */
    var farToe;
    if (f.farToe) {
      farToe = [f.farToe[0] - 4, f.farToe[1]];
    } else if (f.toe) {
      farToe = [o.foot[0] + (f.toe[0] - f.foot[0]) - 4, o.foot[1] + (f.toe[1] - f.foot[1])];
    } else {
      farToe = [o.foot[0] + face * 5.5 - 4, o.foot[1] + 1.5];
    }
    var footW = th.calf * 0.8;

    /* Der Bauchansatz sitzt auf der Rumpfachse statt auf festen Koordinaten:
       so stimmt er auch in Rueckenlage, wo "vorn" nach oben zeigt, und bei
       face -1, wo die Figur andersherum steht. Die Normale ist die um 90 Grad
       in Blickrichtung gedrehte Rumpfachse. Ohne belly — Vorspann,
       Hintergrundleute — bleibt alles wie bisher. */
    var belly = null;
    if (th.belly > 0) {
      var ax = f.hip[0] - f.shoulder[0], ay = f.hip[1] - f.shoulder[1];
      var an = Math.sqrt(ax * ax + ay * ay) || 1;
      var bn = [ay / an * face, -ax / an * face];
      var bc = between(f.shoulder, f.hip, 0.72);
      /* Radius und Versatz an gerenderten Bildern abgenommen: mit 0,30 und
         0,10 stand die Woelbung nur eineinhalb Punkte ueber den Rumpf hinaus
         und war auf 91 Punkten Koerperhoehe schlicht nicht zu sehen. */
      var bo = th.torso * (0.14 + th.belly * 0.22);
      belly = {
        x: bc[0] + bn[0] * bo,
        y: bc[1] + bn[1] * bo,
        r: th.torso * (0.34 + th.belly * 0.20),
        n: bn
      };
    }

    /* 1. Kontur: erst hinten, dann vorne — ergibt eine saubere Silhouette. */
    strokeAll(ctx, L.far, 2, C.ink);
    px.capsule(ctx, offset(o.foot, [-4, 0]), farToe, footW + 2, C.ink);
    px.disc(ctx, f.head[0], f.head[1], hr + 1, C.ink);
    strokeAll(ctx, L.near, 2, C.ink);
    if (belly) px.disc(ctx, belly.x, belly.y, belly.r + 2, C.ink);
    px.capsule(ctx, f.foot, toe, footW + 2, C.ink);
    px.disc(ctx, f.hand[0], f.hand[1], th.fore * 0.62 + 1.5, C.ink);

    /* 2. Fläche */
    strokeAll(ctx, L.far, 0, skinDark);
    px.capsule(ctx, offset(o.foot, [-4, 0]), farToe, footW, C.ink);

    px.capsule(ctx, f.shoulder, f.hip, th.torso, skin);
    /* Vor Schenkel, Schulter und Arm: in fast jeder Geraeteszene liegt der
       nahe Arm vor dem Rumpf, und ein spaeter gezeichneter Bauch wuerde ihn
       zudecken. */
    if (belly) px.disc(ctx, belly.x, belly.y, belly.r, skin);
    px.capsule(ctx, f.hip, f.knee, th.thigh, skin);
    px.capsule(ctx, f.knee, f.foot, th.calf, skin);
    px.disc(ctx, f.shoulder[0], f.shoulder[1], th.shoulder, skin);
    px.capsule(ctx, f.shoulder, f.elbow, th.arm, skin);
    px.capsule(ctx, f.elbow, f.hand, th.fore, skin);
    /* Hand als Scheibe, nicht als Raster: die Szenenfigur ist nur 91 Punkte
       hoch, das 9 x 9 grosse Faustraster aus sprites.js säße hier wie ein
       Boxhandschuh — und in den meisten Szenen liegt ohnehin ein Gerät darauf. */
    px.disc(ctx, f.hand[0], f.hand[1], th.fore * 0.62, skin);

    /* Kleidung. Das Shirt endet ueber dem Bauch und spannt sich darueber: mit
       einem Bauch rutscht der Saum hoch, und die Woelbung bekommt ihre eigene
       Shirt-Scheibe. Ohne sie deckt die runde Kappe der Shirt-Kapsel den
       halben Bauch zu und der Effekt verpufft. Die Shorts kommen danach und
       ergeben von selbst "Bauch liegt auf dem Hosenbund". */
    px.capsule(ctx, f.shoulder,
      between(f.shoulder, f.hip, 0.6 - (th.belly || 0) * 0.07), th.torso * 0.9, shirt);
    if (belly) {
      px.disc(ctx, belly.x - belly.n[0] * belly.r * 0.3,
        belly.y - belly.n[1] * belly.r * 0.3, belly.r * 0.78, shirt);
    }
    px.capsule(ctx, f.hip, between(f.hip, f.knee, 0.48), th.thigh * 1.1, shorts);
    px.capsule(ctx, f.foot, toe, footW, shoe);

    /* Kopf: Gesicht, Haar, ein Auge in Blickrichtung. Die Haarkappe endet am
       oberen Drittel — vorher reichte sie bis zur Kopfmitte und sass wie ein
       Helm. Der Hinterkopf bekommt einen eigenen Fleck entgegen der
       Blickrichtung, sonst wirkt das Profil vorn und hinten gleich. */
    var hair = opts.hair || C.shadow;
    px.disc(ctx, f.head[0], f.head[1], hr, skin);
    if (opts.supine) {
      /* Rueckenlage (Bank): Der Scheitel zeigt vom Rumpf weg die Lehne
         entlang, der Blick senkrecht dazu nach oben. Die Achsen kommen aus
         der Pose selbst — so stimmt der Kopf auf Flach- UND Schraegbank,
         ohne dass die Szene einen Winkel mitliefern muss. */
      var ux = f.head[0] - f.shoulder[0], uy = f.head[1] - f.shoulder[1];
      var un = Math.sqrt(ux * ux + uy * uy) || 1;
      ux /= un; uy /= un;
      var fx = -uy, fy = ux;              /* Blick: 90 Grad vom Scheitel */
      px.capsule(ctx,
        [f.head[0] + (ux * 0.75 - fx * 0.45) * hr, f.head[1] + (uy * 0.75 - fy * 0.45) * hr],
        [f.head[0] + (ux * 0.75 + fx * 0.45) * hr, f.head[1] + (uy * 0.75 + fy * 0.45) * hr],
        hr * 0.45, hair);
      px.disc(ctx, f.head[0] + (ux * 0.3 - fx * 0.5) * hr,
                   f.head[1] + (uy * 0.3 - fy * 0.5) * hr, hr * 0.4, hair);
      px.rect(ctx, f.head[0] + fx * 2 - ux * 1.5 - 1,
                   f.head[1] + fy * 2 - uy * 1.5 - 0.75, 2, 1.5, C.ink);
    } else {
      px.capsule(ctx,
        [f.head[0] - hr * 0.45, f.head[1] - hr * 0.75],
        [f.head[0] + hr * 0.45, f.head[1] - hr * 0.75],
        hr * 0.45, hair);
      px.disc(ctx, f.head[0] - face * hr * 0.5, f.head[1] - hr * 0.3, hr * 0.4, hair);
      px.rect(ctx, f.head[0] + face * 2 - 0.5, f.head[1] + 0.5, 1.5, 2, C.ink);
    }

    /* 3. Schatten auf der lichtabgewandten Seite, dann Licht. Zwei Stufen der
       Rampe auseinander — mit den früheren drei Hauttönen ging nur eines. */
    px.capsule(ctx, offset(f.shoulder, DARK), offset(f.elbow, DARK), th.arm * 0.3, soft);
    px.capsule(ctx, offset(f.hip, DARK), offset(f.knee, DARK), th.thigh * 0.3, soft);
    px.capsule(ctx, offset(f.knee, DARK), offset(f.foot, DARK), th.calf * 0.3, soft);

    px.capsule(ctx, offset(f.shoulder, LIGHT), offset(between(f.shoulder, f.hip, 0.55), LIGHT),
      th.torso * 0.30, shirtLit);
    /* Auf der Mitte der Shirt-Scheibe, nicht auf der des Bauches: sonst faellt
       der helle Fleck ueber deren Rand auf die blanke Haut darunter. */
    if (belly) {
      px.disc(ctx, belly.x - belly.n[0] * belly.r * 0.3 + LIGHT[0],
        belly.y - belly.n[1] * belly.r * 0.3 + LIGHT[1], belly.r * 0.34, shirtLit);
    }
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
