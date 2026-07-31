/* Posen für das Teilen-Bild.

   Der Avatar im Körper-Bildschirm steht in einer festen Haltung. Zum Angeben
   braucht es mehr: die Figur hier nimmt Arm- und Beinstellungen aus einer
   Tabelle entgegen und wird sonst genauso aus den Muskelwerten gebaut — wer
   trainiert hat, posiert breiter.

   Frontalansicht, Koordinatenraum 180 x 180, Boden bei y = 166. */
(function (MF) {
  'use strict';

  var px = MF.ui.pixel;
  var C = px.colors;
  var util = MF.core.util;

  var W = 180, H = 180;
  var CX = 90;
  var FOOT = 168, KNEE = 140, HIP = 114, SHOULDER = 70, HEAD = 52, HEAD_R = 11;

  /* elbow/hand: [Abstand von der Mitte nach außen, Abstand von der Schulter
     nach unten]. Negative y heißt über der Schulter.

     Wichtig ist, dass sich die Umrisse deutlich unterscheiden — beim ersten
     Anlauf lagen die Fäuste bei Doppelbizeps und Bauch/Beine fast gleich, und
     die beiden Posen waren im Bild nicht auseinanderzuhalten. Jetzt: Fäuste
     weit außen gegen Fäuste dicht am Kopf, dazu weiter gegen enger Stand. */
  var POSES = [
    {
      id: 'bizeps', name: 'Doppelter Bizeps', hint: 'Arme weit auf, Bizeps hoch',
      elbow: [30, 0], hand: [25, -24], flex: 1.35, stance: 18, shrug: -2
    },
    {
      id: 'lat', name: 'Lat-Spreizen', hint: 'Hände an die Hüfte, Rücken breit',
      elbow: [31, 15], hand: [12, 43], flex: 1.06, stance: 15, shrug: 0, lat: 1.34
    },
    {
      id: 'crab', name: 'Most Muscular', hint: 'Alles nach vorn',
      elbow: [23, 23], hand: [5, 39], flex: 1.22, stance: 13, shrug: 5
    },
    {
      id: 'abs', name: 'Bauch und Beine', hint: 'Hände hinter den Kopf',
      elbow: [19, -19], hand: [5, -31], flex: 1.0, stance: 11, shrug: -1
    }
  ];

  function get(id) {
    for (var i = 0; i < POSES.length; i++) if (POSES[i].id === id) return POSES[i];
    return POSES[0];
  }

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

  /* Halbe Breiten, aus denselben Formeln wie der Avatar, nur größer gerechnet:
     die Figur hier ist rund ein Drittel höher. */
  function widths(pose) {
    var m = MF.game.state.get().muscles;
    function f(id) { return util.clamp(m[id].size / 100, 0, 1); }
    var k = 1.35;
    return {
      shoulder: (9 + f('schultern') * 8) * k,
      chest: (5 + f('brust') * 5) * k,
      waist: (7 + f('bauch') * 4) * k,
      arm: (4 + f('bizeps') * 5) * k * (pose.flex || 1),
      fore: (3.5 + f('trizeps') * 3) * k,
      thigh: (7 + f('beine') * 6) * k,
      calf: (5 + f('waden') * 4) * k,
      back: (11 + f('ruecken') * 9) * k * (pose.lat || 1),
      abs: f('bauch')
    };
  }

  function joints(pose, w) {
    var sy = SHOULDER + (pose.shrug || 0);
    var out = { shoulderY: sy, arms: [], legs: [] };
    var side;

    for (var i = 0; i < 2; i++) {
      side = i ? 1 : -1;
      out.arms.push({
        side: side,
        shoulder: [CX + side * w.shoulder, sy],
        elbow: [CX + side * (w.shoulder + pose.elbow[0]), sy + pose.elbow[1]],
        hand: [CX + side * pose.hand[0], sy + pose.hand[1]]
      });
      out.legs.push({
        side: side,
        hip: [CX + side * w.waist * 0.55, HIP],
        knee: [CX + side * pose.stance * 0.62, KNEE],
        foot: [CX + side * pose.stance, FOOT]
      });
    }
    return out;
  }

  /* opts: { shorts } */
  function draw(ctx, poseId, opts) {
    var pose = get(poseId);
    var w = widths(pose);
    var j = joints(pose, w);
    var health = MF.game.stats.healthAvg();
    var o = opts || {};
    var i, a, l;

    /* Schlechte Werte = fahler Teint, genau wie beim Avatar. */
    var skin = health < 60 ? mix(C.skin, C.steel, (60 - health) / 90) : C.skin;
    var skinLit = mix(skin, C.skinLit, 0.7);
    var skinDark = mix(skin, C.skinDark, 0.8);
    var sy = j.shoulderY;

    /* Flacher Bodenschatten. Eine Scheibe wäre hier eine Kugel und würde bis
       an die Knie reichen — eine liegende Kapsel ist die flache Ellipse. */
    px.capsule(ctx, [CX - w.thigh * 1.7, FOOT + 3], [CX + w.thigh * 1.7, FOOT + 3],
      8, C.wallDark);

    /* 1. Kontur — erst alles in Fast-Schwarz, ergibt eine saubere Silhouette. */
    for (i = 0; i < 2; i++) {
      l = j.legs[i];
      px.capsule(ctx, l.hip, l.knee, w.thigh + 2, C.ink);
      px.capsule(ctx, l.knee, l.foot, w.calf + 2, C.ink);
      px.rect(ctx, l.foot[0] - w.calf * 0.9, FOOT - 1, w.calf * 1.8, 6, C.ink);

      a = j.arms[i];
      px.capsule(ctx, a.shoulder, a.elbow, w.arm + 2, C.ink);
      px.capsule(ctx, a.elbow, a.hand, w.fore + 2, C.ink);
      px.disc(ctx, a.hand[0], a.hand[1], w.fore * 0.7 + 1.5, C.ink);
      px.disc(ctx, a.shoulder[0], a.shoulder[1], w.shoulder * 0.44 + 2, C.ink);
    }
    px.capsule(ctx, [CX, sy], [CX, HIP - 2], w.back + 2, C.ink);
    px.disc(ctx, CX, HEAD, HEAD_R + 1.5, C.ink);

    /* 2. Flächen */
    for (i = 0; i < 2; i++) {
      l = j.legs[i];
      px.capsule(ctx, l.hip, l.knee, w.thigh, skin);
      px.capsule(ctx, l.knee, l.foot, w.calf, skin);
      px.rect(ctx, l.foot[0] - w.calf * 0.9, FOOT - 1, w.calf * 1.8, 5, C.shadow);
    }

    px.capsule(ctx, [CX, sy], [CX, HIP - 2], w.back, skin);
    /* Die Taille schmaler als der Brustkorb — das macht die V-Form. */
    px.capsule(ctx, [CX, HIP - 22], [CX, HIP - 2], w.waist, skin);

    for (i = 0; i < 2; i++) {
      a = j.arms[i];
      px.capsule(ctx, a.shoulder, a.elbow, w.arm, skin);
      px.capsule(ctx, a.elbow, a.hand, w.fore, skin);
      px.disc(ctx, a.hand[0], a.hand[1], w.fore * 0.7, skin);
      px.disc(ctx, a.shoulder[0], a.shoulder[1], w.shoulder * 0.44, skin);
    }

    /* Brust */
    px.disc(ctx, CX - w.chest * 0.9, sy + 15, w.chest, skin);
    px.disc(ctx, CX + w.chest * 0.9, sy + 15, w.chest, skin);

    /* Kopf mit flachem Haarschnitt */
    px.disc(ctx, CX, HEAD, HEAD_R, skin);
    px.disc(ctx, CX, HEAD - 6, HEAD_R * 0.92, C.shadow);
    px.rect(ctx, CX - 5, HEAD, 2, 3, C.ink);
    px.rect(ctx, CX + 3, HEAD, 2, 3, C.ink);

    /* Hose in der gewählten Farbe */
    var shorts = o.shorts || C.jeans;
    px.rect(ctx, CX - w.waist - 2, HIP - 7, (w.waist + 2) * 2, 18, C.ink);
    px.rect(ctx, CX - w.waist - 1, HIP - 6, (w.waist + 1) * 2, 16, shorts);
    px.rect(ctx, CX - 1.5, HIP - 6, 3, 16, C.ink);

    /* 3. Licht und Definition — erst hier wird aus der Silhouette ein Körper. */
    var edge = mix(skin, C.ink, 0.42);
    px.capsule(ctx, [CX, sy + 6], [CX, HIP - 12], 2.5, edge);        /* Bauchrinne */
    px.capsule(ctx, [CX - w.chest * 1.7, sy + 20], [CX - w.chest * 0.4, sy + 22], 2, edge);
    px.capsule(ctx, [CX + w.chest * 0.4, sy + 22], [CX + w.chest * 1.7, sy + 20], 2, edge);

    for (i = 0; i < 2; i++) {
      a = j.arms[i];
      /* Bizepsberg auf der Oberseite des Oberarms */
      px.disc(ctx, (a.shoulder[0] + a.elbow[0]) / 2 - a.side * w.arm * 0.2,
        (a.shoulder[1] + a.elbow[1]) / 2 - 1, w.arm * 0.46, skinLit);
      px.disc(ctx, a.shoulder[0] - a.side * 1.5, a.shoulder[1] - 2, w.shoulder * 0.2, skinLit);
      l = j.legs[i];
      px.capsule(ctx, [l.hip[0] - l.side * 1, l.hip[1] + 4],
        [l.knee[0] - l.side * 1, l.knee[1] - 4], w.thigh * 0.28, skinLit);
      px.capsule(ctx, [l.knee[0], l.knee[1] + 3], [l.foot[0], l.foot[1] - 8], w.calf * 0.3, skinLit);
    }

    px.disc(ctx, CX - w.chest * 0.9 - 1, sy + 13, w.chest * 0.4, skinLit);
    px.disc(ctx, CX + w.chest * 0.9 - 1, sy + 13, w.chest * 0.4, skinLit);

    /* Bauchmuskeln zeichnen sich erst ab einer gewissen Größe ab. */
    if (w.abs > 0.26) {
      var rows = w.abs > 0.55 ? 3 : 2;
      for (var r = 0; r < rows; r++) {
        px.rect(ctx, CX - 7, HIP - 26 + r * 6, 5, 3, edge);
        px.rect(ctx, CX + 2, HIP - 26 + r * 6, 5, 3, edge);
      }
    }

    /* Fahler Teint verdient einen Hinweis — die Pose lügt sonst über den
       Zustand, den der Körper-Bildschirm anzeigt. */
    if (health < 45) {
      px.dither(ctx, CX - w.back, sy, w.back * 2, HIP - sy, C.steel, 4);
    }
  }

  MF.ui.poses = {
    list: POSES,
    get: get,
    draw: draw,
    size: { w: W, h: H }
  };
})(window.MacFit);
