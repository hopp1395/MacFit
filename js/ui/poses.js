/* Posen für das Teilen-Bild.

   Der Avatar im Körper-Bildschirm steht in einer festen Haltung. Zum Angeben
   braucht es mehr: die Figur hier nimmt Haltungen aus einer Tabelle entgegen
   und wird sonst genauso aus den Muskelwerten gebaut — wer trainiert hat,
   posiert breiter.

   Gezeigt werden die sieben Pflichtposen des Wettkampfs plus Most Muscular.
   Vier davon gehen nicht von vorn: zwei von hinten, zwei im Profil. Deshalb
   drei Ansichten in einer Datei — Vorder- und Rückansicht teilen sich dasselbe
   Skelett und unterscheiden sich nur in der Ausarbeitung, das Profil kommt aus
   dem Seitenriss-Rig, das auch die Übungsszenen zeichnet.

   Koordinatenraum 180 x 180, Boden bei y = 168. */
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

     elbow gibt nur die Richtung vor, in die der Ellenbogen ausbricht; wo er
     landet, rechnet elbowFor aus den Knochenlängen.

     Die Umrisse müssen sich deutlich unterscheiden — beim ersten Anlauf lagen
     die Fäuste bei zwei Posen fast gleich, und sie waren im Bild nicht
     auseinanderzuhalten. */
  var POSES = [
    {
      id: 'front-biceps', name: 'Doppelbizeps vorne', hint: 'Arme auf, Bizeps hoch',
      view: 'front',
      elbow: [30, 0], hand: [25, -24], flex: 1.35, stance: 18, shrug: -2
    },
    {
      id: 'front-lat', name: 'Latissimus vorne', hint: 'Hände an die Rippen, V-Form',
      view: 'front',
      elbow: [31, 15], hand: [14, 34], flex: 1.06, stance: 15, shrug: 0, lat: 1.34
    },
    {
      id: 'side-chest', name: 'Seitliche Brust', hint: 'Profil, Brust raus',
      view: 'side',
      /* Enger Stand, Arme vor dem Körper, Oberkörper leicht zurück: sonst
         liest sich das Profil als Gehen statt als Pose. */
      side: {
        face: 1,
        head: [5, HEAD], shoulder: [-4, SHOULDER], hip: [2, HIP],
        knee: [7, KNEE], foot: [11, FOOT],
        farKnee: [-5, KNEE + 2], farFoot: [-9, FOOT],
        elbow: [7, SHOULDER + 25], hand: [18, SHOULDER + 36],
        farElbow: [-5, SHOULDER + 23], farHand: [14, SHOULDER + 35]
      },
      flex: 1.25, chest: 1
    },
    {
      id: 'rear-biceps', name: 'Doppelbizeps hinten', hint: 'Rücken, Arme auf',
      view: 'back',
      elbow: [30, 0], hand: [25, -24], flex: 1.35, stance: 17, shrug: -2
    },
    {
      id: 'rear-lat', name: 'Latissimus hinten', hint: 'Rücken auf volle Breite',
      view: 'back',
      elbow: [31, 15], hand: [14, 34], flex: 1.06, stance: 14, shrug: 0, lat: 1.42
    },
    {
      id: 'side-triceps', name: 'Seitlicher Trizeps', hint: 'Profil, Arm nach hinten',
      view: 'side',
      side: {
        face: 1,
        head: [5, HEAD], shoulder: [-3, SHOULDER], hip: [1, HIP],
        knee: [7, KNEE], foot: [11, FOOT],
        farKnee: [-5, KNEE + 2], farFoot: [-9, FOOT],
        elbow: [-10, SHOULDER + 24], hand: [-8, SHOULDER + 44],
        farElbow: [-12, SHOULDER + 22], farHand: [-6, SHOULDER + 42]
      },
      flex: 1.18, triceps: 1
    },
    {
      id: 'abs-thigh', name: 'Bauch und Oberschenkel', hint: 'Hände hinter den Kopf',
      view: 'front',
      elbow: [19, -19], hand: [5, -31], flex: 1.0, stance: 11, shrug: -1
    },
    {
      id: 'most-muscular', name: 'Most Muscular', hint: 'Alles nach vorn',
      view: 'front',
      elbow: [23, 23], hand: [7, 32], flex: 1.22, stance: 13, shrug: 5
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

     Die Namen sagen, was gemeint ist. Vorher hieß alles nur "breit", und die
     Hose rechnete mit halben, der Rumpf mit ganzen Breiten — die Hüfte kam
     dadurch doppelt so breit heraus wie gewollt.
       *Span / *Half / *R   halbe Maße ab der Mittelachse
       *W                   Strichstärken für Gliedmaßen */
  function widths(pose) {
    var m = MF.game.state.get().muscles;
    function f(id) { return util.clamp(m[id].size / 100, 0, 1); }
    var k = 1.35;

    var waistHalf = (7 + f('bauch') * 2.5) * k * 0.5;
    /* 0.72, nicht 1.0: beim Umbenennen hatten nur die Rumpfwerte den halben
       Faktor bekommen, die Beine blieben auf voller Breite stehen und spannten
       doppelt so weit wie der Rumpf. Ganz halbieren geht aber auch nicht —
       dann sind die Schenkel dünner als die Oberarme. */
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
      abs: f('bauch'),
      back: f('ruecken')
    };
  }

  /* Knochenlängen in Bildpunkten. Der Unterarm ist etwas kürzer als der
     Oberarm — so ist der Arm gebaut. */
  var UPPER = 30, FORE = 26;

  /* Schulter und Hand stehen fest, der Ellenbogen ergibt sich daraus: die
     übliche Zwei-Knochen-Rechnung.

     Vorher stand der Ellenbogen relativ zur Schulter, die Hand aber relativ
     zur Mitte. Mit den Schultern wanderte deshalb nur der Ellenbogen nach
     außen und zog den Unterarm mit — bei ausgereizten Werten war er
     anderthalb mal so lang wie der Oberarm. */
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

  /* ---------- Vorder- und Rückansicht -------------------------------------- */

  /* Beide teilen sich Skelett, Silhouette und Flächen. Unterschiedlich sind
     nur der Kopf und die Ausarbeitung: vorn Brust und Bauch, hinten Trapez,
     Rückenrinne und Beinbeuger. */
  function drawUpright(ctx, pose, w, col, o) {
    var j = joints(pose, w);
    var sy = j.shoulderY;
    var back = pose.view === 'back';
    var i, a, l;

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
      px.capsule(ctx, l.hip, l.knee, w.thighW, col.skin);
      px.capsule(ctx, l.knee, l.foot, w.calfW, col.skin);
      px.rect(ctx, l.foot[0] - w.calfW * 0.9, FOOT - 1, w.calfW * 1.8, 5, C.shadow);
    }

    /* Hals vor dem Rumpf, sonst steht sein unteres Ende als dunkler Fleck
       mitten auf der Brust. */
    px.capsule(ctx, [CX, HEAD + 7], [CX, sy - 2], 9, col.skinDark);
    torso(ctx, sy, w, col.skin);
    traps(ctx, sy, w, col.skin);

    for (i = 0; i < 2; i++) {
      a = j.arms[i];
      px.capsule(ctx, a.shoulder, a.elbow, w.armW, col.skin);
      px.capsule(ctx, a.elbow, a.hand, w.foreW, col.skin);
      px.disc(ctx, a.hand[0], a.hand[1], w.foreW * 0.7, col.skin);
      px.disc(ctx, a.shoulder[0], a.shoulder[1], w.shoulderSpan * 0.44, col.skin);
    }

    /* Kopf. Von hinten sieht man Haar und einen Streifen Nacken, kein
       Gesicht — sonst dreht sich die Figur im Kopf des Betrachters zurück. */
    px.disc(ctx, CX, HEAD, HEAD_R, col.skin);
    if (back) {
      px.disc(ctx, CX, HEAD - 1, HEAD_R * 0.95, C.shadow);
    } else {
      px.disc(ctx, CX, HEAD - 6, HEAD_R * 0.92, C.shadow);
      px.rect(ctx, CX - 5, HEAD, 2, 3, C.ink);
      px.rect(ctx, CX + 3, HEAD, 2, 3, C.ink);
    }

    /* Hose in der gewählten Farbe. Breite aus der Hüfte, nicht aus der Taille —
       sie muss die Oberschenkelansätze abdecken. */
    var shorts = o.shorts || C.jeans;
    var sw = w.hipHalf + w.thighW * 0.5;
    px.rect(ctx, CX - sw - 1, HIP - 7, (sw + 1) * 2, 18, C.ink);
    px.rect(ctx, CX - sw, HIP - 6, sw * 2, 16, shorts);
    if (!back) px.rect(ctx, CX - 1.5, HIP - 6, 3, 16, C.ink);

    /* 3. Licht und Definition — erst hier wird aus der Silhouette ein Körper. */
    if (back) backDetail(ctx, sy, w, j, col);
    else frontDetail(ctx, sy, w, j, col);

    /* Arme und Beine bekommen in beiden Ansichten dieselben Glanzlichter. */
    for (i = 0; i < 2; i++) {
      a = j.arms[i];
      px.disc(ctx, (a.shoulder[0] + a.elbow[0]) / 2 - a.side * w.armW * 0.2,
        (a.shoulder[1] + a.elbow[1]) / 2 - 1, w.armW * 0.46, col.skinLit);
      px.disc(ctx, a.shoulder[0] - a.side * 1.5, a.shoulder[1] - 2,
        w.shoulderSpan * 0.2, col.skinLit);
      l = j.legs[i];
      px.capsule(ctx, [l.hip[0] - l.side * 1, l.hip[1] + 4],
        [l.knee[0] - l.side * 1, l.knee[1] - 4], w.thighW * 0.28, col.skinLit);
      px.capsule(ctx, [l.knee[0], l.knee[1] + 3], [l.foot[0], l.foot[1] - 8],
        w.calfW * 0.3, col.skinLit);
    }
  }

  function frontDetail(ctx, sy, w, j, col) {
    var i, s;

    /* Die Latissimus-Kante: von der Achsel schräg zur Taille. Sie macht den
       Keil sichtbar, den die Silhouette allein nur andeutet. */
    for (i = 0; i < 2; i++) {
      s = i ? 1 : -1;
      px.capsule(ctx,
        [CX + s * (w.latHalf - 1.5), sy + 4],
        [CX + s * (w.waistHalf - 0.5), HIP - 10],
        2, col.edge);
    }

    /* Brust wird nur über ihre Kanten sichtbar: die Fläche hat denselben
       Hautton wie der Rumpf. Als Scheibe gezeichnet wären es zwei Bälle. */
    for (i = 0; i < 2; i++) {
      s = i ? 1 : -1;
      px.capsule(ctx,
        [CX + s * w.chestR * 0.22, sy + 22],
        [CX + s * w.chestR * 1.45, sy + 19],
        2.5, col.deep);                                              /* Unterkante */
      px.capsule(ctx,
        [CX + s * w.chestR * 0.55, sy + 9],
        [CX + s * w.chestR * 1.25, sy + 11],
        w.chestR * 0.55, col.skinLit);                               /* Licht oben */
    }
    px.capsule(ctx, [CX, sy + 8], [CX, sy + 21], 2, col.deep);       /* Brustbein */
    px.capsule(ctx, [CX, sy + 22], [CX, HIP - 12], 2.5, col.edge);   /* Bauchrinne */

    /* Bauchmuskeln zeichnen sich erst ab einer gewissen Größe ab. */
    if (w.abs > 0.26) {
      var rows = w.abs > 0.55 ? 3 : 2;
      for (var r = 0; r < rows; r++) {
        px.rect(ctx, CX - 6, HIP - 24 + r * 6, 4, 2, col.edge);
        px.rect(ctx, CX + 2, HIP - 24 + r * 6, 4, 2, col.edge);
      }
    }
  }

  /* Der Rücken lebt von drei Dingen: der Rinne in der Mitte, dem Trapez oben
     und den Latissimus-Kanten außen. Brust und Bauch fehlen hier komplett —
     stünden sie da, sähe die Figur aus, als hätte sie sich wieder umgedreht. */
  function backDetail(ctx, sy, w, j, col) {
    var i, s;

    /* Rückenrinne: von den Schultern bis zum Kreuz, oben breiter. */
    px.capsule(ctx, [CX, sy + 6], [CX, HIP - 8], 2.5, col.deep);
    px.capsule(ctx, [CX, sy + 4], [CX, sy + 18], 4, col.edge);

    /* Trapez: dunkler Keil vom Nacken zu den Schultern. */
    for (i = 0; i < 2; i++) {
      s = i ? 1 : -1;
      px.capsule(ctx,
        [CX + s * 2, sy - 6],
        [CX + s * w.shoulderSpan * 0.7, sy + 3],
        3, col.deep);
    }

    /* Latissimus: die Außenkante von der Achsel zur Taille, kräftiger als
       vorn — von hinten ist das die Hauptform. */
    for (i = 0; i < 2; i++) {
      s = i ? 1 : -1;
      px.capsule(ctx,
        [CX + s * (w.latHalf - 1.5), sy + 5],
        [CX + s * (w.waistHalf - 0.5), HIP - 12],
        2.5, col.deep);
      /* Licht auf der Fläche dazwischen macht den Keil plastisch. */
      px.capsule(ctx,
        [CX + s * w.latHalf * 0.55, sy + 10],
        [CX + s * w.waistHalf * 0.7, HIP - 18],
        3, col.skinLit);
    }

    /* Untere Rückenpartie: zwei Grübchen über dem Hosenbund. */
    if (w.back > 0.3) {
      px.rect(ctx, CX - 7, HIP - 13, 2, 2, col.deep);
      px.rect(ctx, CX + 5, HIP - 13, 2, 2, col.deep);
    }

    /* Beinbeuger: Schatten auf der Rückseite der Schenkel, dazu die Kerbe
       zwischen den beiden Köpfen. */
    for (i = 0; i < 2; i++) {
      var l = j.legs[i];
      px.capsule(ctx,
        [l.hip[0], l.hip[1] + 8], [l.knee[0], l.knee[1] - 3],
        2, col.edge);
    }
  }

  /* ---------- Profil ------------------------------------------------------- */

  /* Eigene Zeichnung statt des Rigs aus figure.js. Jenes ist für die
     gedrungene Szenenfigur gerechnet — Schulter und Hüfte liegen dort nur
     20 Punkte auseinander, hier sind es 44. Mit seinen Werten wird der Rumpf
     fast so breit wie lang, und die Hose landet als schräge Wurst auf einem
     Bein.

     Im Profil ist die Breite die Tiefe des Körpers: die Brust steht vorn
     heraus, der Rücken bleibt eine fast gerade Linie. Deshalb liegt die
     hintere Kante fest und nur die vordere wandert. */
  var FAR = -7;   /* die abgewandte Körperhälfte liegt so weit dahinter */

  function profileTorso(ctx, d, backX, color, extra) {
    var y0 = SHOULDER - 3, y1 = HIP + 2;
    var N = 12, h = (y1 - y0) / N, i, u, depth, e, y;
    for (i = 0; i < N; i++) {
      u = i / (N - 1);
      /* Oben die Brust, darunter die Verjüngung zur Taille. */
      depth = u < 0.3
        ? lerp(d.chest * 0.9, d.chest, u / 0.3)
        : lerp(d.chest, d.waist, (u - 0.3) / 0.7);
      e = extra || 0;
      y = y0 + i * h;
      px.capsule(ctx, [backX - e, y], [backX + depth + e, y], h + 1.6 + e * 2, color);
    }
  }

  function drawProfile(ctx, pose, w, col, o) {
    var s = pose.side;
    var d = { chest: w.latHalf * 1.55, waist: w.waistHalf * 1.9 };
    var backX = CX - d.waist * 0.5 - 2;

    function at(p) { return [CX + p[0], p[1]]; }
    function back(p) { return [CX + p[0] + FAR, p[1]]; }

    var head = at(s.head), shoulder = at(s.shoulder), hip = at(s.hip);
    var knee = at(s.knee), foot = at(s.foot);
    var fKnee = back(s.farKnee), fFoot = back(s.farFoot);
    var elbow = at(s.elbow), hand = at(s.hand);
    var fElbow = back(s.farElbow), fHand = back(s.farHand);
    var fHip = [hip[0] + FAR, hip[1]];
    var fShoulder = [shoulder[0] + FAR, shoulder[1]];

    /* Fuß im Profil: ein Riegel nach vorn, kein Klotz unter dem Bein. */
    function shoe(ctx2, p, color) {
      px.rect(ctx2, p[0] - w.calfW * 0.6, FOOT - 1, w.calfW * 0.6 + 10, 5, color);
    }

    px.capsule(ctx, [CX - 20, FOOT + 3], [CX + 24, FOOT + 3], 8, C.wallDark);

    /* Streng von hinten nach vorn, und jedes Teil zieht seine eigene Kontur
       unmittelbar vor der Fläche. Erst alle Konturen und dann alle Flächen —
       wie in der Vorderansicht — geht hier nicht: im Profil liegt der Arm auf
       dem Rumpf, und die Rumpffläche würde die Armkontur wieder zudecken.
       Arm und Rumpf verschmelzen dann zu einer einzigen Masse. */
    function limb(a, b, thick, color) {
      px.capsule(ctx, a, b, thick + 2, C.ink);
      px.capsule(ctx, a, b, thick, color);
    }

    /* Abgewandte Körperhälfte: dunkler, das schafft die Tiefe. */
    limb(fHip, fKnee, w.thighW * 0.92, col.skinDark);
    limb(fKnee, fFoot, w.calfW * 0.92, col.skinDark);
    px.rect(ctx, fFoot[0] - w.calfW * 0.6 - 1, FOOT - 2, w.calfW * 0.6 + 12, 7, C.ink);
    shoe(ctx, fFoot, C.ink);
    limb(fShoulder, fElbow, w.armW * 0.9, col.skinDark);
    limb(fElbow, fHand, w.foreW * 0.9, col.skinDark);

    /* Hals und Rumpf */
    px.capsule(ctx, [head[0] - 1, HEAD + 6], [shoulder[0] + 2, shoulder[1]], 12, C.ink);
    px.capsule(ctx, [head[0] - 1, HEAD + 7], [shoulder[0] + 2, shoulder[1] - 2], 9, col.skinDark);
    profileTorso(ctx, d, backX, C.ink, 1.4);
    profileTorso(ctx, d, backX, col.skin);

    /* Hose: ein Riegel über der Hüfte, breit genug für die Schenkelansätze. */
    var shorts = o.shorts || C.jeans;
    px.rect(ctx, backX - 3, HIP - 8, d.waist + 10, 20, C.ink);
    px.rect(ctx, backX - 2, HIP - 7, d.waist + 8, 18, shorts);

    /* Kopf im Profil: Haar über Hinterkopf und Scheitel, vorn Nase und Auge. */
    px.disc(ctx, head[0], head[1], HEAD_R + 1.5, C.ink);
    px.disc(ctx, head[0], head[1], HEAD_R, col.skin);
    px.capsule(ctx, [head[0] - HEAD_R * 0.55, head[1] - HEAD_R * 0.3],
      [head[0] + HEAD_R * 0.15, head[1] - HEAD_R * 0.55], HEAD_R * 0.8, C.shadow);
    px.rect(ctx, head[0] + HEAD_R - 1, head[1] + 1, 3, 2, col.skin);   /* Nase */
    px.rect(ctx, head[0] + 3, head[1] + 1, 2, 2, C.ink);               /* Auge */

    /* Nahes Bein vor dem Rumpf, danach der nahe Arm ganz vorn. */
    limb(hip, knee, w.thighW, col.skin);
    limb(knee, foot, w.calfW, col.skin);
    px.rect(ctx, foot[0] - w.calfW * 0.6 - 1, FOOT - 2, w.calfW * 0.6 + 12, 7, C.ink);
    shoe(ctx, foot, C.shadow);

    px.disc(ctx, shoulder[0], shoulder[1], w.shoulderSpan * 0.4 + 2, C.ink);
    px.disc(ctx, shoulder[0], shoulder[1], w.shoulderSpan * 0.4, col.skin);
    limb(shoulder, elbow, w.armW, col.skin);
    limb(elbow, hand, w.foreW, col.skin);
    px.disc(ctx, hand[0], hand[1], w.foreW * 0.7 + 1.5, C.ink);
    px.disc(ctx, hand[0], hand[1], w.foreW * 0.7, col.skin);

    /* 3. Was die Pose ausmacht. */
    px.disc(ctx, shoulder[0] - 1.5, shoulder[1] - 2, w.shoulderSpan * 0.19, col.skinLit);
    px.capsule(ctx, [backX + 1, SHOULDER + 6], [backX + 1, HIP - 8], 2, col.edge);  /* Rückenlinie */

    if (pose.chest) {
      /* Brustplatte: Licht auf der Wölbung, darunter die Kante zum Bauch. */
      px.capsule(ctx,
        [backX + d.chest * 0.45, SHOULDER + 8],
        [backX + d.chest * 0.92, SHOULDER + 14],
        d.chest * 0.34, col.skinLit);
      px.capsule(ctx,
        [backX + d.chest * 0.3, SHOULDER + 22],
        [backX + d.chest * 0.95, SHOULDER + 19],
        2.5, col.deep);
      px.capsule(ctx,
        [backX + d.chest * 0.55, SHOULDER + 26],
        [backX + d.waist * 0.75, HIP - 12],
        2, col.edge);                                       /* seitliche Bauchkante */
    }
    if (pose.triceps) {
      /* Der Trizeps liegt hinten am Oberarm — im Profil die Hauptsache. */
      px.capsule(ctx,
        [shoulder[0] - w.armW * 0.3, shoulder[1] + 7],
        [elbow[0] - w.armW * 0.25, elbow[1] - 4],
        w.armW * 0.42, col.skinLit);
      px.capsule(ctx,
        [shoulder[0] + w.armW * 0.05, shoulder[1] + 9],
        [elbow[0] + w.armW * 0.05, elbow[1] - 3],
        1.5, col.deep);
    }

    /* Bauchmuskeln zeichnen sich im Profil als Kerben an der Vorderkante ab. */
    if (w.abs > 0.3) {
      for (var r = 0; r < 2; r++) {
        px.rect(ctx, backX + d.waist * 0.62, HIP - 22 + r * 7, 3, 2, col.edge);
      }
    }
  }

  /* ---------- Einstieg ----------------------------------------------------- */

  /* opts: { shorts } */
  function draw(ctx, poseId, opts) {
    var pose = get(poseId);
    var health = MF.game.stats.healthAvg();
    var o = opts || {};

    /* Schlechte Werte = fahler Teint, genau wie beim Avatar. */
    var skin = health < 60 ? mix(C.skin, C.steel, (60 - health) / 90) : C.skin;
    var col = {
      skin: skin,
      skinLit: mix(skin, C.skinLit, 0.7),
      skinDark: mix(skin, C.skinDark, 0.8),
      edge: mix(skin, C.ink, 0.42),
      deep: mix(skin, C.ink, 0.6)
    };

    var w = widths(pose);

    if (pose.view === 'side') {
      drawProfile(ctx, pose, w, col, o);
    } else {
      drawUpright(ctx, pose, w, col, o);

      /* Fahler Teint verdient einen Hinweis — die Pose lügt sonst über den
         Zustand, den der Körper-Bildschirm anzeigt. */
      if (health < 45) {
        px.dither(ctx, CX - w.latHalf, SHOULDER, w.latHalf * 2, HIP - SHOULDER, C.steel, 4);
      }
    }
  }

  MF.ui.poses = {
    list: POSES,
    get: get,
    draw: draw,
    size: { w: W, h: H }
  };
})(window.MacFit);
