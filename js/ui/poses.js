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

  /* hand: [Abstand von der Mitte nach außen, Abstand von der Schulter nach
     unten]. Negative y heißt über der Schulter. Die Hand ist der Punkt, auf
     den es ankommt — Fäuste am Kopf, Hände an der Hüfte.

     elbow gibt nur noch die Richtung vor, in die der Ellenbogen ausbricht;
     wo er tatsächlich landet, rechnet elbowFor aus den Knochenlängen.

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
      /* Fäuste an den unteren Rippen statt an der Hüfte: mit richtigen
         Knochenlängen ist der Arm sonst fast durchgestreckt und der
         Ellenbogen stellt sich nicht mehr auf. */
      elbow: [31, 15], hand: [14, 34], flex: 1.06, stance: 15, shrug: 0, lat: 1.34
    },
    {
      id: 'crab', name: 'Most Muscular', hint: 'Alles nach vorn',
      elbow: [23, 23], hand: [7, 32], flex: 1.22, stance: 13, shrug: 5
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

  function lerp(a, b, t) { return a + (b - a) * t; }

  /* Maße aus denselben Formeln wie der Avatar, nur größer gerechnet: die Figur
     hier ist rund ein Drittel höher.

     Die Namen sagen jetzt, was gemeint ist. Vorher hieß alles nur "breit", und
     die Hose rechnete mit halben, der Rumpf mit ganzen Breiten — die Hüfte kam
     dadurch doppelt so breit heraus wie gewollt.
       *Span / *Half / *R   halbe Maße ab der Mittelachse
       *W                   Strichstärken für Gliedmaßen */
  function widths(pose) {
    var m = MF.game.state.get().muscles;
    function f(id) { return util.clamp(m[id].size / 100, 0, 1); }
    var k = 1.35;

    var waistHalf = (7 + f('bauch') * 2.5) * k * 0.5;
    /* 0.72, nicht 1.0: beim Umbenennen hatten nur die Rumpfwerte den halben
       Faktor bekommen, die Beine blieben auf voller Breite stehen. Die Beine
       spannten dadurch doppelt so weit wie der Rumpf. Ganz halbieren geht
       aber auch nicht — dann sind die Schenkel dünner als die Oberarme. */
    var thighW = (7 + f('beine') * 7.5) * k * 0.72;

    return {
      shoulderSpan: (9 + f('schultern') * 8) * k,
      /* Der Latissimus wächst kräftiger als die Taille — daraus entsteht die
         V-Form. Beide Werte sind halbe Breiten. */
      latHalf: (9 + f('ruecken') * 11) * k * 0.5 * (pose.lat || 1),
      waistHalf: waistHalf,
      /* Der Zuschlag ist ein halbes Maß, thighW eine ganze Strichstärke —
         deshalb 0.15 und nicht 0.30. Sonst stehen die Schenkel neben dem
         Rumpf statt darunter. */
      hipHalf: waistHalf + thighW * 0.15,
      chestR: (5 + f('brust') * 5) * k,
      armW: (4 + f('bizeps') * 5) * k * (pose.flex || 1),
      foreW: (3.5 + f('trizeps') * 3) * k,
      thighW: thighW,
      calfW: (5 + f('waden') * 4) * k * 0.72,
      abs: f('bauch')
    };
  }

  /* Knochenlängen in Bildpunkten. Der Unterarm ist etwas kürzer als der
     Oberarm — so ist der Arm gebaut. */
  var UPPER = 30, FORE = 26;

  /* Schulter und Hand stehen fest, der Ellenbogen ergibt sich daraus: die
     übliche Zwei-Knochen-Rechnung.

     Vorher stand der Ellenbogen relativ zur Schulter, die Hand aber relativ
     zur Mitte. Mit den Schultern wanderte deshalb nur der Ellenbogen nach
     außen, und der Unterarm wurde mitgezogen — bei ausgereizten Werten war er
     anderthalb mal so lang wie der Oberarm.

     bend gibt an, zu welcher Seite der Ellenbogen ausbricht. */
  function elbowFor(shoulder, hand, bend) {
    var dx = hand[0] - shoulder[0], dy = hand[1] - shoulder[1];
    var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
    /* Weiter als der Arm reicht, geht nicht — dann ist er durchgestreckt. */
    var reach = Math.min(d, UPPER + FORE - 0.5);
    var a = (UPPER * UPPER - FORE * FORE + reach * reach) / (2 * reach);
    var h = Math.sqrt(Math.max(0, UPPER * UPPER - a * a));
    var ux = dx / d, uy = dy / d;
    return [
      shoulder[0] + ux * a + bend * uy * h,
      shoulder[1] + uy * a - bend * ux * h
    ];
  }

  /* Aus welcher Richtung der Ellenbogen ausbricht, steht weiter in der
     Posentabelle: die Seite, auf der der dort eingetragene Punkt liegt. Nur
     die Länge wird neu gerechnet, die Haltung bleibt. */
  function bendOf(pose, span) {
    var hx = pose.hand[0] - span, hy = pose.hand[1];      /* Hand ab Schulter */
    var cross = hx * pose.elbow[1] - hy * pose.elbow[0];
    return cross > 0 ? -1 : 1;
  }

  function joints(pose, w) {
    var sy = SHOULDER + (pose.shrug || 0);
    var out = { shoulderY: sy, arms: [], legs: [] };
    var side;

    for (var i = 0; i < 2; i++) {
      side = i ? 1 : -1;
      var shoulder = [CX + side * w.shoulderSpan, sy];
      var hand = [CX + side * pose.hand[0], sy + pose.hand[1]];
      out.arms.push({
        side: side,
        shoulder: shoulder,
        elbow: elbowFor(shoulder, hand, side * bendOf(pose, w.shoulderSpan)),
        hand: hand
      });
      out.legs.push({
        side: side,
        hip: [CX + side * w.hipHalf, HIP],
        knee: [CX + side * pose.stance * 0.62, KNEE],
        foot: [CX + side * pose.stance, FOOT]
      });
    }
    return out;
  }

  /* Halbe Rumpfbreite auf Höhe u (0 = Achselhöhe, 1 = Taille).

     Der Latissimus setzt direkt unter der Achsel an, ist dort am breitesten
     und läuft keilförmig zur Taille aus. Eine gleichmäßig breite Kapsel wie
     vorher ergibt dagegen eine Tonne mit runden Enden — und die liest sich als
     zwei Beulen statt als Rücken. */
  function torsoW(w, u) {
    if (u < 0.14) return lerp(w.latHalf * 0.86, w.latHalf, u / 0.14);
    return lerp(w.latHalf, w.waistHalf, (u - 0.14) / 0.86);
  }

  /* Trapezmuskel: die Schräge vom Hals zur Schulter. Ohne sie hat der Rumpf
     oben eine waagerechte Kante und sieht aus wie ein Kasten. */
  function traps(ctx, sy, w, color, extra) {
    var e = extra || 0;
    for (var i = 0; i < 2; i++) {
      var side = i ? 1 : -1;
      px.capsule(ctx,
        [CX + side * 3, sy - 9],
        [CX + side * w.shoulderSpan * 0.88, sy + 1],
        9 + e, color);
    }
  }

  /* Als Stapel waagerechter Kapseln — anders lässt sich mit den vorhandenen
     Grundformen keine sich verjüngende Fläche zeichnen. */
  function torso(ctx, sy, w, color, extra) {
    var y0 = sy - 2, y1 = HIP + 2;
    var N = 13, h = (y1 - y0) / N, i, u, hw, y;
    for (i = 0; i < N; i++) {
      u = i / (N - 1);
      hw = torsoW(w, u) + (extra || 0);
      y = y0 + i * h;
      px.capsule(ctx, [CX - hw, y], [CX + hw, y], h + 1.6 + (extra || 0) * 2, color);
    }
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
    px.capsule(ctx, [CX - w.thighW * 1.7, FOOT + 3], [CX + w.thighW * 1.7, FOOT + 3],
      8, C.wallDark);

    /* 1. Kontur — erst alles in Fast-Schwarz, ergibt eine saubere Silhouette. */
    for (i = 0; i < 2; i++) {
      l = j.legs[i];
      px.capsule(ctx, l.hip, l.knee, w.thighW + 2, C.ink);
      px.capsule(ctx, l.knee, l.foot, w.calfW + 2, C.ink);
      px.rect(ctx, l.foot[0] - w.calfW * 0.9, FOOT - 1, w.calfW * 1.8, 6, C.ink);

      a = j.arms[i];
      px.capsule(ctx, a.shoulder, a.elbow, w.armW + 2, C.ink);
      px.capsule(ctx, a.elbow, a.hand, w.foreW + 2, C.ink);
      px.disc(ctx, a.hand[0], a.hand[1], w.foreW * 0.7 + 1.5, C.ink);
      px.disc(ctx, a.shoulder[0], a.shoulder[1], w.shoulderSpan * 0.44 + 2, C.ink);
    }
    torso(ctx, sy, w, C.ink, 1.4);
    traps(ctx, sy, w, C.ink, 2);
    px.capsule(ctx, [CX, HEAD + 6], [CX, sy], 12, C.ink);          /* Hals */
    px.disc(ctx, CX, HEAD, HEAD_R + 1.5, C.ink);

    /* 2. Flächen */
    for (i = 0; i < 2; i++) {
      l = j.legs[i];
      px.capsule(ctx, l.hip, l.knee, w.thighW, skin);
      px.capsule(ctx, l.knee, l.foot, w.calfW, skin);
      px.rect(ctx, l.foot[0] - w.calfW * 0.9, FOOT - 1, w.calfW * 1.8, 5, C.shadow);
    }

    /* Hals vor dem Rumpf, sonst steht sein unteres Ende als dunkler Fleck
       mitten auf der Brust. */
    px.capsule(ctx, [CX, HEAD + 7], [CX, sy - 2], 9, skinDark);
    torso(ctx, sy, w, skin);
    traps(ctx, sy, w, skin);

    for (i = 0; i < 2; i++) {
      a = j.arms[i];
      px.capsule(ctx, a.shoulder, a.elbow, w.armW, skin);
      px.capsule(ctx, a.elbow, a.hand, w.foreW, skin);
      px.disc(ctx, a.hand[0], a.hand[1], w.foreW * 0.7, skin);
      px.disc(ctx, a.shoulder[0], a.shoulder[1], w.shoulderSpan * 0.44, skin);
    }

    /* Kopf mit flachem Haarschnitt */
    px.disc(ctx, CX, HEAD, HEAD_R, skin);
    px.disc(ctx, CX, HEAD - 6, HEAD_R * 0.92, C.shadow);
    px.rect(ctx, CX - 5, HEAD, 2, 3, C.ink);
    px.rect(ctx, CX + 3, HEAD, 2, 3, C.ink);

    /* Hose in der gewählten Farbe. Breite aus der Hüfte, nicht aus der Taille —
       sie muss die Oberschenkelansätze abdecken. */
    var shorts = o.shorts || C.jeans;
    var sw = w.hipHalf + w.thighW * 0.5;
    px.rect(ctx, CX - sw - 1, HIP - 7, (sw + 1) * 2, 18, C.ink);
    px.rect(ctx, CX - sw, HIP - 6, sw * 2, 16, shorts);
    px.rect(ctx, CX - 1.5, HIP - 6, 3, 16, C.ink);

    /* 3. Licht und Definition — erst hier wird aus der Silhouette ein Körper. */
    var edge = mix(skin, C.ink, 0.42);

    /* Die Latissimus-Kante: von der Achsel schräg zur Taille. Sie macht den
       Keil sichtbar, den die Silhouette allein nur andeutet. */
    for (i = 0; i < 2; i++) {
      var s2 = i ? 1 : -1;
      px.capsule(ctx,
        [CX + s2 * (w.latHalf - 1.5), sy + 4],
        [CX + s2 * (w.waistHalf - 0.5), HIP - 10],
        2, edge);
    }

    /* Brust wird nur über ihre Kanten sichtbar: die Fläche hat denselben
       Hautton wie der Rumpf. Als Scheibe gezeichnet wären es zwei Bälle. */
    var deep = mix(skin, C.ink, 0.6);
    for (i = 0; i < 2; i++) {
      var s3 = i ? 1 : -1;
      px.capsule(ctx,
        [CX + s3 * w.chestR * 0.22, sy + 22],
        [CX + s3 * w.chestR * 1.45, sy + 19],
        2.5, deep);                                                  /* Unterkante */
      px.capsule(ctx,
        [CX + s3 * w.chestR * 0.55, sy + 9],
        [CX + s3 * w.chestR * 1.25, sy + 11],
        w.chestR * 0.55, skinLit);                                   /* Licht oben */
    }
    px.capsule(ctx, [CX, sy + 8], [CX, sy + 21], 2, deep);           /* Brustbein */
    px.capsule(ctx, [CX, sy + 22], [CX, HIP - 12], 2.5, edge);       /* Bauchrinne */

    for (i = 0; i < 2; i++) {
      a = j.arms[i];
      /* Bizepsberg auf der Oberseite des Oberarms */
      px.disc(ctx, (a.shoulder[0] + a.elbow[0]) / 2 - a.side * w.armW * 0.2,
        (a.shoulder[1] + a.elbow[1]) / 2 - 1, w.armW * 0.46, skinLit);
      px.disc(ctx, a.shoulder[0] - a.side * 1.5, a.shoulder[1] - 2, w.shoulderSpan * 0.2, skinLit);
      l = j.legs[i];
      px.capsule(ctx, [l.hip[0] - l.side * 1, l.hip[1] + 4],
        [l.knee[0] - l.side * 1, l.knee[1] - 4], w.thighW * 0.28, skinLit);
      px.capsule(ctx, [l.knee[0], l.knee[1] + 3], [l.foot[0], l.foot[1] - 8], w.calfW * 0.3, skinLit);
    }


    /* Bauchmuskeln zeichnen sich erst ab einer gewissen Größe ab. */
    if (w.abs > 0.26) {
      var rows = w.abs > 0.55 ? 3 : 2;
      for (var r = 0; r < rows; r++) {
        px.rect(ctx, CX - 6, HIP - 24 + r * 6, 4, 2, edge);
        px.rect(ctx, CX + 2, HIP - 24 + r * 6, 4, 2, edge);
      }
    }

    /* Fahler Teint verdient einen Hinweis — die Pose lügt sonst über den
       Zustand, den der Körper-Bildschirm anzeigt. */
    if (health < 45) {
      px.dither(ctx, CX - w.latHalf, sy, w.latHalf * 2, HIP - sy, C.steel, 4);
    }
  }

  MF.ui.poses = {
    list: POSES,
    get: get,
    draw: draw,
    size: { w: W, h: H }
  };
})(window.MacFit);
