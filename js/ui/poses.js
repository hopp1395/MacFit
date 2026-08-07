/* Posen für das Teilen-Bild.

   Der Avatar im Körper-Bildschirm steht in einer festen Haltung. Zum Angeben
   braucht es mehr: die Figur hier nimmt Haltungen aus einer Tabelle entgegen
   und wird sonst genauso aus den Muskelwerten gebaut — wer trainiert hat,
   posiert breiter.

   Gezeigt werden die sieben Pflichtposen des Wettkampfs plus Most Muscular.
   Vier davon gehen nicht von vorn: zwei von hinten, zwei im Profil. Deshalb
   drei Ansichten in einer Datei — Vorder- und Rückansicht teilen sich dasselbe
   Skelett und unterscheiden sich nur in der Ausarbeitung, das Profil hat eine
   eigene Zeichnung.

   Koordinatenraum 180 x 180, Boden bei y = 168. */
(function (MF) {
  'use strict';

  var px = MF.ui.pixel;
  var C = px.colors;
  var SP = MF.ui.sprites;
  var util = MF.core.util;

  var W = 180, H = 180;
  var CX = 90;

  /* Das Skelett folgt den üblichen anthropometrischen Bruchteilen der
     Körperhöhe: Schulter 0,818 · Hüftgelenk 0,530 · Knie 0,285. Vorher lag die
     Hüfte bei 114 — die Beine machten damit nur 42 % der Höhe aus statt 53 %,
     der Rumpf war entsprechend zu lang. */
  var FOOT = 168, KNEE = 133, HIP = 99, SHOULDER = 63, HEAD = 48, HEAD_R = 9.5;

  /* Knochenlängen. Zusammen 43 von 129,5 Punkten Körperhöhe — ein Drittel, wie
     am Menschen. Vorher waren es 56, und damit war der Arm länger als das ganze
     Bein. Der Unterarm ist kürzer als der Oberarm, Verhältnis 0,79. */
  var UPPER = 24, FORE = 19;

  var DEG = Math.PI / 180;

  /* Arme stehen als zwei Winkel je Pose, nicht als Handpunkte: 0° ist
     waagerecht nach außen, positive Werte gehen nach oben.

       upper   Richtung des Oberarms ab der Schulter
       fore    Richtung des Unterarms ab dem Ellenbogen

     Vorher standen Ellenbogen und Hand als Koordinaten da, und der Ellenbogen
     wurde per Zwei-Knochen-Rechnung dazwischengelegt. Das ging jedes Mal
     kaputt, wenn sich Schulterbreite oder Knochenlänge änderten — beim
     Doppelbizeps lagen die Unterarme dadurch fast waagerecht statt aufgerichtet.
     Über Winkel bleibt die Haltung dieselbe, egal wie breit die Figur wird.

     Beide Arme nehmen dieselben Winkel, gespiegelt. Wo das nicht reicht, steht
     stattdessen arms: [links, rechts] mit eigenen Winkeln je Seite — die
     Victory-Pose hat einen gebeugten und einen weit ausgestreckten Arm.

     stance    halber Fußabstand von der Mitte
     backLeg   diese Seite steht hinten auf dem Ballen (Wade)
     frontLeg  diese Seite steht vorgestellt und durchgestreckt (Quadrizeps)
     shrug     negative Werte ziehen die Schultern hoch
     look      Blickrichtung; ohne Angabe schaut die Figur geradeaus
     level     ab diesem Level wählbar, ohne Angabe von Anfang an
     focus     welche Partien diese Pose zeigt — daran wird sie auf der
               Wettkampfbühne gemessen (game/contest.js) */
  var POSES = [
    {
      id: 'front-biceps', name: 'Doppelbizeps vorne', hint: 'Arme auf, Bizeps hoch',
      focus: ['bizeps', 'schultern', 'brust'],
      view: 'front',
      upper: 12, fore: 100, flex: 1.15, stance: 15, shrug: -2
    },
    {
      id: 'front-lat', name: 'Latissimus vorne', hint: 'Hände an die Rippen, V-Form',
      focus: ['ruecken', 'brust', 'bauch'],
      view: 'front',
      upper: -48, fore: -168, flex: 1.05, stance: 13, shrug: 0, lat: 1.34
    },
    {
      id: 'side-chest', name: 'Seitliche Brust', hint: 'Profil, Brust raus',
      focus: ['brust', 'schultern', 'beine'],
      view: 'side',
      /* Nahes Bein auf den Zehen mit gebeugtem Knie, beide Hände vorn
         geschlossen — das sind die beiden Merkmale, an denen man die Pose
         erkennt. Ohne sie liest sich das Profil als Herumstehen. */
      side: {
        /* Kopf drei Punkte höher als in den Frontposen: im Profil braucht es
           einen sichtbaren Hals zwischen Kinn und Rumpfkante — ein zwischen
           die Schultern gesunkener Kopf liest sich als Buckel. */
        head: [2, HEAD - 3], shoulder: [-2, SHOULDER], hip: [1, HIP],
        knee: [6, KNEE - 3], foot: [8, FOOT - 5], ball: 1,
        farKnee: [-2, KNEE], farFoot: [-3, FOOT],
        /* Beide Unterarme laufen auf denselben Punkt vor dem Bauch zu — die
           ferne Hand fasst das nahe Handgelenk. Ohne den geschlossenen Ring
           sieht die Pose aus wie Herumstehen mit hängenden Armen. */
        elbow: [6, SHOULDER + 24], hand: [20, SHOULDER + 34],
        farElbow: [13, SHOULDER + 22], farHand: [27, SHOULDER + 34]
      },
      flex: 1.1, chest: 1, depth: 1.2
    },
    {
      id: 'rear-biceps', name: 'Doppelbizeps hinten', hint: 'Rücken, Arme auf',
      focus: ['ruecken', 'bizeps', 'waden'],
      view: 'back',
      upper: 12, fore: 100, flex: 1.15, stance: 15, shrug: -2, backLeg: -1
    },
    {
      id: 'rear-lat', name: 'Latissimus hinten', hint: 'Rücken auf volle Breite',
      focus: ['ruecken', 'schultern', 'waden'],
      view: 'back',
      upper: -42, fore: -170, flex: 1.05, stance: 12, shrug: 0, lat: 1.42
    },
    {
      id: 'side-triceps', name: 'Seitlicher Trizeps', hint: 'Profil, Arm nach hinten',
      focus: ['trizeps', 'brust', 'beine'],
      view: 'side',
      /* Beide Arme hinter dem Rücken, Hände im Kreuz geschlossen, naher Arm
         fast durchgestreckt — nur so steht der Trizeps im Profil heraus. */
      side: {
        /* Kopf höher wie bei der seitlichen Brust: sichtbarer Hals statt
           zwischen die Schultern gesunkenem Kopf. */
        head: [2, HEAD - 3], shoulder: [-1, SHOULDER], hip: [0, HIP],
        knee: [5, KNEE], foot: [8, FOOT], locked: 1,
        farKnee: [-3, KNEE], farFoot: [-4, FOOT],
        /* Der nahe Arm liegt AM Rücken an, nicht dahinter: nur die
           Trizepskante steht ein paar Punkte über die Rückenlinie hinaus.
           Weiter nach hinten versetzt hing die ganze Armmasse frei hinter der
           Silhouette und las sich als Rucksack. Der ferne Arm verschwindet
           fast ganz hinter dem Rumpf — in echt verdeckt ihn der Körper; nur
           die Hand lugt an der Griffstelle im Kreuz hervor. */
        elbow: [-8, SHOULDER + 22], hand: [-9, SHOULDER + 38],
        farElbow: [3, SHOULDER + 20], farHand: [-1, SHOULDER + 38]
      },
      flex: 1.08, triceps: 1
    },
    {
      id: 'abs-thigh', name: 'Bauch und Oberschenkel', hint: 'Hände hinter den Kopf',
      focus: ['bauch', 'beine', 'waden'],
      view: 'front',
      upper: 58, fore: 185, flex: 1.0, stance: 11, shrug: -1, frontLeg: 1
    },
    {
      id: 'most-muscular', name: 'Most Muscular', hint: 'Alles nach vorn',
      focus: ['brust', 'schultern', 'trizeps', 'ruecken'],
      view: 'front',
      upper: -68, fore: -160, flex: 1.12, stance: 12, shrug: -5
    },
    {
      /* Die frei wählbare klassische Pose der Golden Era: ein Arm gebeugt am
         Kopf, der andere lang nach oben außen gestreckt, Blick dem gestreckten
         Arm hinterher. Als einzige Pose unsymmetrisch — deshalb arms[]. */
      id: 'victory', name: 'Victory-Pose', hint: 'Golden Era — ein Arm auf, einer weit hinaus',
      focus: ['bizeps', 'schultern', 'bauch'],
      view: 'front', level: 10,
      arms: [
        { upper: 10, fore: 105, flex: 1.15, dy: 1 },     /* gebeugt, Bizeps */
        { upper: 35, fore: 35, flex: 1.0, dy: -3 }       /* durchgestreckt   */
      ],
      stance: 13, shrug: -1, look: 1
    }
  ];

  function get(id) {
    for (var i = 0; i < POSES.length; i++) if (POSES[i].id === id) return POSES[i];
    return POSES[0];
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  /* Maße aus den Muskelwerten. Die Namen sagen, welches Maß gemeint ist:
       *Span / *Half / *R   halbe Maße ab der Mittelachse
       *W                   volle Strichstärken für Gliedmaßen

     Die Verhältnisse untereinander stehen als Kommentar dahinter und werden im
     Durchlauftest nachgerechnet. Vorher hatten nur thighW und calfW einen
     Dämpfer 0,72 abbekommen, die Armmaße nicht — dadurch war der Oberarm
     dicker als der Oberschenkel. */
  /* muscles ist optional: ohne Angabe ist der eigene Körper gemeint, mit
     Angabe ein fremder — so posiert auch der Rivale mit seinen Maßen.
     definition (0..1) entscheidet über Taille und Bauchkerben; ohne Angabe
     zählt der eigene Fettstand. */
  function widths(pose, muscles, definition) {
    var m = muscles || MF.game.state.get().muscles;
    var lean = definition === undefined ? MF.game.fat.definition() : definition;
    var soft = definition === undefined
      ? MF.game.fat.softness() : MF.game.fat.softnessFor(definition);
    function f(id) { return util.clamp(m[id].size / 100, 0, 1); }
    /* Die Rumpfmasse kommen aus ui/shape.js — dieselbe Rechnung wie im
       Koerper-Bildschirm, nur mit dem groesseren Faktor. Arme, Beine und
       Brust stehen weiter hier: das sind keine Rumpfmasse. */
    var sh = MF.ui.shape.of(m, lean, soft);
    var k = MF.ui.shape.K.poses;

    var thighW = sh.thighW * k;
    var latHalf = sh.latHalf * k * (pose.lat || 1);
    var chestR = (4.0 + f('brust') * 3.0) * k;

    return {
      /* Außenkante der Schulter = shoulderSpan * 1,44. Ergibt 34 bis 50 Punkte
         Schulterbreite auf 129,5 Punkte Höhe; vorher waren es bis zu 62. */
      shoulderSpan: sh.shoulderHalf * k,
      latHalf: latHalf,
      waistHalf: sh.waistHalf * k,
      /* Die breiteste Stelle knapp über dem Hosenbund — ohne Fett die Kerbe
         über dem Hüftknochen, mit Fett der Bauch. */
      bulgeHalf: sh.bulgeHalf * k,
      belly: sh.belly,
      hipHalf: sh.hipHalf * k,
      chestR: chestR,
      /* Die Brustkanten dürfen nie außerhalb des Brustkorbs landen — vorher
         lagen sie bei chestR * 1.45 auf Schulter und Arm. */
      pecHalf: Math.min(chestR * 1.45, latHalf * 0.86),
      armW: (4.5 + f('bizeps') * 3.8) * k,
      foreW: (3.6 + f('trizeps') * 2.6) * k,     /* 0,75 x armW */
      thighW: thighW,
      calfW: sh.calfW * k,                       /* 0,72 x thighW */
      /* Angespannt wölbt sich der Muskelbauch, nicht der ganze Arm: flex geht
         nicht mehr auf armW, sondern nur auf den Bizepsberg in der Mitte. */
      flex: util.clamp(pose.flex || 1, 1, 1.15),
      /* Die Kerben zeichnen sich nur ab, wenn nichts darueber liegt. */
      abs: lean > 0.35 ? f('bauch') * (0.55 + lean * 0.45) : 0,
      back: f('ruecken')
    };
  }

  /* ---------- Gelenke ------------------------------------------------------ */

  function armFor(pose, w, side, sy) {
    var spec = pose.arms ? pose.arms[side > 0 ? 1 : 0] : pose;
    var shoulder = [CX + side * w.shoulderSpan, sy + (spec.dy || 0)];
    var u = spec.upper * DEG, o = spec.fore * DEG;
    var elbow = [
      shoulder[0] + side * UPPER * Math.cos(u),
      shoulder[1] - UPPER * Math.sin(u)
    ];
    return {
      side: side,
      shoulder: shoulder,
      elbow: elbow,
      hand: [elbow[0] + side * FORE * Math.cos(o), elbow[1] - FORE * Math.sin(o)],
      /* Ein durchgestreckter Arm hat keinen Bizepsberg — der Faktor gehört
         deshalb an den Arm, nicht an die ganze Pose. */
      flex: util.clamp(spec.flex || pose.flex || 1, 1, 1.15)
    };
  }

  /* Der Bizepsberg sitzt auf der Innenseite der Beuge — also auf der Seite, zu
     der sich der Unterarm dreht. Das ist der Anteil von (Hand − Ellenbogen),
     der senkrecht auf dem Oberarm steht. */
  function peakOf(a, w) {
    var ux = a.elbow[0] - a.shoulder[0], uy = a.elbow[1] - a.shoulder[1];
    var ul = Math.sqrt(ux * ux + uy * uy) || 1;
    ux /= ul; uy /= ul;

    var vx = a.hand[0] - a.elbow[0], vy = a.hand[1] - a.elbow[1];
    var along = vx * ux + vy * uy;
    var nx = vx - along * ux, ny = vy - along * uy;
    var nl = Math.sqrt(nx * nx + ny * ny) || 1;

    var off = w.armW * 0.16;
    return [
      a.shoulder[0] + ux * ul * 0.52 + (nx / nl) * off,
      a.shoulder[1] + uy * ul * 0.52 + (ny / nl) * off
    ];
  }

  function legFor(pose, w, side) {
    var st = pose.stance || 13;
    var l = {
      side: side,
      hip: [CX + side * w.hipHalf, HIP],
      knee: [CX + side * st * 0.62, KNEE],
      foot: [CX + side * st, FOOT],
      ball: 0, locked: 0
    };

    /* Hinteres Bein auf dem Ballen: Ferse hoch, Knie leicht gebeugt. Das ist
       die Haltung, in der beim Doppelbizeps von hinten die Wade bewertet wird. */
    if (pose.backLeg === side) {
      l.knee = [CX + side * (st * 0.62 + 2), KNEE - 3];
      l.foot = [CX + side * (st - 2), FOOT - 5];
      l.ball = 1;
    }

    /* Vorgestelltes Bein: durchgestreckt, Fuß etwas näher an der Mitte und
       einen Hauch tiefer — näher am Betrachter. */
    if (pose.frontLeg === side) {
      l.foot = [CX + side * (st - 2), FOOT + 1];
      l.knee = [(l.hip[0] + l.foot[0]) / 2, KNEE];
      l.locked = 1;
    }
    return l;
  }

  function joints(pose, w) {
    var sy = SHOULDER + (pose.shrug || 0);
    var out = { shoulderY: sy, arms: [], legs: [] };
    for (var i = 0; i < 2; i++) {
      var side = i ? 1 : -1;
      out.arms.push(armFor(pose, w, side, sy));
      out.legs.push(legFor(pose, w, side));
    }
    return out;
  }

  /* ---------- Rumpf -------------------------------------------------------- */

  /* Halbe Rumpfbreite auf Höhe u (0 = Achselhöhe, 1 = Taille). Die Kurve
     selbst steht in ui/shape.js — der Körper-Bildschirm zeichnet denselben
     Rumpf, nur kleiner, und beide müssen ihn gleich verjüngen. */
  function torsoW(w, u) {
    return MF.ui.shape.torsoW(w, u);
  }

  /* Ober- und Unterkante des Rumpfumrisses. Als eigene Funktion, damit die
     Details auf dem Rumpf dieselbe Höhenskala benutzen wie der Umriss selbst
     — sonst verschiebt sich alles, sobald eine Pose die Schultern hochzieht
     (pose.shrug). */
  function torsoSpan(sy) { return [sy - 2, HIP + 2]; }

  /* Halbe Rumpfbreite auf einer Bildhöhe y — dieselbe Kurve wie torsoW(), nur
     über y statt über u angesprochen. Kanten, die auf dem Rumpf liegen, holen
     sich hier ihre Endpunkte, statt sie aus den Rohmaßen zu raten: mit latHalf
     als Startwert stand die Latissimus-Kante bis zu zwei Punkte AUSSERHALB der
     Silhouette, weil der Umriss seine volle Breite erst weiter unten
     erreicht. */
  function torsoAt(w, sy, y) {
    var sp = torsoSpan(sy);
    return torsoW(w, util.clamp((y - sp[0]) / (sp[1] - sp[0]), 0, 1));
  }

  /* Der Rumpf als ein geschlossener Umriss statt als Stapel waagerechter
     Kapseln. Links von oben nach unten, rechts zurück. */
  function torsoOutline(sy, w) {
    var sp = torsoSpan(sy), y0 = sp[0], y1 = sp[1];
    var N = 15, i, u, hw;
    var left = [], right = [];
    for (i = 0; i < N; i++) {
      u = i / (N - 1);
      hw = torsoW(w, u);
      left.push([CX - hw, y0 + u * (y1 - y0)]);
      right.push([CX + hw, y0 + u * (y1 - y0)]);
    }
    right.reverse();
    return left.concat(right);
  }

  /* Trapezmuskel: die Schräge vom Hals zur Schulter. Ohne sie hat der Rumpf
     oben eine waagerechte Kante und sieht aus wie ein Kasten. */
  function traps(ctx, sy, w, color, extra) {
    var e = extra || 0;
    for (var i = 0; i < 2; i++) {
      var side = i ? 1 : -1;
      px.capsule(ctx,
        [CX + side * 2.5, sy - 8],
        [CX + side * w.shoulderSpan * 0.86, sy + 1],
        7.5 + e, color);
    }
  }

  function torso(ctx, sy, w, color, ink) {
    px.poly(ctx, torsoOutline(sy, w), color, ink, 3);
  }

  /* ---------- Vorder- und Rückansicht -------------------------------------- */

  /* Bein als verjüngte Form statt zweier gleich dicker Rohre: der Schenkel ist
     oben am dicksten, die Wade sitzt im oberen Drittel des Unterschenkels, zum
     Knöchel hin wird es dünn. Zwei durchgehend gleich starke Kapseln lasen sich
     als Hosenbein statt als Bein. */
  function legShape(ctx, l, w, color, extra) {
    var e = extra || 0;
    var thighEnd = [lerp(l.hip[0], l.knee[0], 0.78), lerp(l.hip[1], l.knee[1], 0.78)];
    var calfEnd = [lerp(l.knee[0], l.foot[0], 0.5), lerp(l.knee[1], l.foot[1], 0.5)];

    px.capsule(ctx, l.knee, l.foot, w.calfW * 0.6 + e, color);       /* Schienbein */
    px.capsule(ctx, l.hip, l.knee, w.thighW * 0.8 + e, color);       /* Knie */
    px.capsule(ctx, l.knee, calfEnd, w.calfW + e, color);            /* Wadenbauch */
    px.capsule(ctx, l.hip, thighEnd, w.thighW + e, color);           /* Schenkel */
  }

  /* Schuh als Raster. Feste Größe: ein Fuß wächst nicht mit der Wade, vorher
     hing seine Breite aber an calfW. Die Kontur steckt im Raster selbst,
     deshalb wird er nur einmal gezeichnet und nicht im Konturdurchgang. */
  function shoeOf(ctx, l, ramp) {
    if (l.ball) {
      px.stamp(ctx, SP.shoeBall, l.foot[0] - 4, FOOT - 4, ramp);
      return;
    }
    px.stamp(ctx, SP.shoeFront, l.foot[0] - 6, FOOT - 5, ramp);
  }

  /* Beide Ansichten teilen sich Skelett, Silhouette und Flächen. Unterschiedlich
     sind nur der Kopf und die Ausarbeitung: vorn Brust und Bauch, hinten
     Trapez, Rückenrinne und Beinbeuger. */
  function drawUpright(ctx, pose, w, col, o) {
    var j = joints(pose, w);
    var sy = j.shoulderY;
    var back = pose.view === 'back';
    var i, a, l, pk;

    /* Flacher Bodenschatten. Eine Scheibe wäre hier eine Kugel und würde bis
       an die Knie reichen — eine liegende Kapsel ist die flache Ellipse. */
    px.capsule(ctx, [CX - w.thighW * 1.7, FOOT + 3], [CX + w.thighW * 1.7, FOOT + 3],
      8, C.wallDark);

    /* 1. Kontur — erst alles in Fast-Schwarz, ergibt eine saubere Silhouette. */
    for (i = 0; i < 2; i++) {
      l = j.legs[i];
      legShape(ctx, l, w, C.ink, 2);

      a = j.arms[i];
      px.capsule(ctx, a.shoulder, a.elbow, w.armW + 2, C.ink);
      pk = peakOf(a, w);
      px.disc(ctx, pk[0], pk[1], w.armW * 0.5 * a.flex + 1, C.ink);
      px.capsule(ctx, a.elbow, a.hand, w.foreW + 2, C.ink);
      px.disc(ctx, a.shoulder[0], a.shoulder[1], w.shoulderSpan * 0.44 + 2, C.ink);
    }
    traps(ctx, sy, w, C.ink, 2);
    px.capsule(ctx, [CX, HEAD + 5], [CX, sy], 11, C.ink);          /* Hals */
    px.disc(ctx, CX, HEAD, HEAD_R + 1.5, C.ink);

    /* 2. Flächen */
    for (i = 0; i < 2; i++) {
      l = j.legs[i];
      legShape(ctx, l, w, col.skin, 0);
      shoeOf(ctx, l, col.ramp);
    }

    /* Hals vor dem Rumpf, sonst steht sein unteres Ende als dunkler Fleck
       mitten auf der Brust. */
    px.capsule(ctx, [CX, HEAD + 6], [CX, sy - 2], 8, col.skinDark);
    /* Kontur und Fläche in einem Zug auf demselben Pfad — beim Polygon geht das
       nicht getrennt, ein aufgeblasener Umriss wäre an den spitzen Ecken der
       Achselhöhle fehleranfällig. */
    torso(ctx, sy, w, col.skin, C.ink);
    traps(ctx, sy, w, col.skin);

    for (i = 0; i < 2; i++) {
      a = j.arms[i];
      px.capsule(ctx, a.shoulder, a.elbow, w.armW, col.skin);
      pk = peakOf(a, w);
      px.disc(ctx, pk[0], pk[1], w.armW * 0.5 * a.flex, col.skin);
      px.capsule(ctx, a.elbow, a.hand, w.foreW, col.skin);
      px.stamp(ctx, SP.fist, a.hand[0] - 4, a.hand[1] - 4, col.ramp);
      px.disc(ctx, a.shoulder[0], a.shoulder[1], w.shoulderSpan * 0.44, col.skin);
    }

    /* Kopf als handgezeichnetes Raster auf der Ink-Scheibe. Von hinten nur
       Haar und ein Streifen Nacken — ein Gesicht dort würde die Figur im Kopf
       des Betrachters zurückdrehen. */
    px.stamp(ctx, back ? SP.headBack : SP.headFront, CX - 9, HEAD - 9, col.ramp);
    /* Die Blickrichtung setzt nur die Pupillen um, mehr gibt eine
       Vorderansicht nicht her. */
    if (!back && pose.look) {
      px.rect(ctx, CX - 5, HEAD, 3, 2, col.skin);
      px.rect(ctx, CX + 3, HEAD, 3, 2, col.skin);
      px.rect(ctx, CX - 4 + pose.look * 2, HEAD, 2, 2, C.ink);
      px.rect(ctx, CX + 3 + pose.look * 2, HEAD, 2, 2, C.ink);
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

    /* Licht kommt von oben links. Jedes Glied bekommt deshalb erst einen
       Schattenstreifen auf der abgewandten Seite und dann ein Licht auf der
       zugewandten — zwei Stufen der Rampe auseinander. Das ist der Schritt, den
       die alte Palette nicht hergab: dort waren nur drei Hauttöne vorhanden,
       und der mittlere war schon der Grundton. */
    for (i = 0; i < 2; i++) {
      a = j.arms[i];
      px.capsule(ctx, [a.shoulder[0] + a.side * w.armW * 0.3, a.shoulder[1] + 2],
        [a.elbow[0] + a.side * w.armW * 0.3, a.elbow[1]], w.armW * 0.3, col.soft);
      px.capsule(ctx, [a.elbow[0] + a.side * w.foreW * 0.25, a.elbow[1] + 1],
        [a.hand[0] + a.side * w.foreW * 0.25, a.hand[1]], w.foreW * 0.3, col.soft);

      pk = peakOf(a, w);
      /* Nur ein Licht je Muskel. Ein zweites, noch helleres darin sah aus wie
         eine angeschaltete Glühbirne statt wie eine Wölbung. */
      px.disc(ctx, pk[0] - a.side * 1, pk[1] - 1, w.armW * 0.3 * a.flex, col.skinLit);
      px.disc(ctx, a.shoulder[0] - a.side * 1.5, a.shoulder[1] - 2,
        w.shoulderSpan * 0.2, col.skinLit);

      /* Erst unterhalb des Hosensaums: weiter oben angesetzt malten Schatten-
         und Lichtstreifen als dunkle und helle Balken über die Hose. */
      l = j.legs[i];
      var thighTop = HIP + 12;
      px.capsule(ctx, [l.hip[0] + l.side * w.thighW * 0.3, thighTop],
        [l.knee[0] + l.side * w.thighW * 0.26, l.knee[1] - 2],
        w.thighW * 0.3, col.soft);
      px.capsule(ctx, [l.knee[0] + l.side * w.calfW * 0.28, l.knee[1] + 3],
        [l.foot[0] + l.side * w.calfW * 0.2, l.foot[1] - 6],
        w.calfW * 0.28, col.soft);

      px.capsule(ctx, [l.hip[0] - l.side * 1.5, thighTop],
        [l.knee[0] - l.side * 1.5, l.knee[1] - 4],
        w.thighW * (l.locked ? 0.3 : 0.22), col.skinLit);
      px.capsule(ctx, [l.knee[0] - l.side, l.knee[1] + 3], [l.foot[0] - l.side, l.foot[1] - 8],
        w.calfW * (l.ball ? 0.34 : 0.24), col.skinLit);

      /* Durchgestreckt zeichnet sich die Trennung der Schenkelköpfe ab. */
      if (l.locked) {
        px.capsule(ctx, [l.hip[0] + l.side * w.thighW * 0.22, l.hip[1] + 8],
          [l.knee[0] + l.side * w.thighW * 0.18, l.knee[1] - 5], 2, col.edge);
      }
      /* Auf dem Ballen tritt der Wadenbauch hervor. */
      if (l.ball) {
        px.capsule(ctx, [l.knee[0] - l.side * 1, l.knee[1] + 5],
          [l.foot[0] - l.side * 1, l.foot[1] - 11], w.calfW * 0.28, col.edge);
      }
    }
  }

  function frontDetail(ctx, sy, w, j, col) {
    var i, s;

    /* Schlüsselbeine: von der Drosselgrube leicht ansteigend zu den
       Schultern. Die Linie trennt Hals und Brustplatte — ohne sie hängt die
       Brust konturlos unter dem Kopf. */
    for (i = 0; i < 2; i++) {
      s = i ? 1 : -1;
      px.capsule(ctx, [CX + s * 2.5, sy + 5],
        [CX + s * w.shoulderSpan * 0.82, sy + 2], 1.5, col.soft);
    }

    /* Die Latissimus-Kante: von der Achsel schräg zur Taille. Sie macht den
       Keil sichtbar, den die Silhouette allein nur andeutet — und wo kein Keil
       ist, wird auch keiner gezeichnet: auf einem weichen Körper wäre sie eine
       Behauptung, und bei breiter Taille liefe sie sogar nach außen
       auseinander. */
    if (w.latHalf > w.waistHalf * 1.08) {
      for (i = 0; i < 2; i++) {
        s = i ? 1 : -1;
        px.capsule(ctx,
          [CX + s * (torsoAt(w, sy, sy + 4) - 1.5), sy + 4],
          [CX + s * (torsoAt(w, sy, HIP - 9) - 1.5), HIP - 9],
          2, col.edge);
      }
    }

    /* Brust wird nur über ihre Kanten sichtbar: die Fläche hat denselben
       Hautton wie der Rumpf. Als Scheibe gezeichnet wären es zwei Bälle. */
    for (i = 0; i < 2; i++) {
      s = i ? 1 : -1;
      px.capsule(ctx,
        [CX + s * w.pecHalf * 0.16, sy + 20],
        [CX + s * w.pecHalf, sy + 17],
        2.5, col.deep);                                              /* Unterkante */
      /* Licht auf der Wölbung. Flach und breit, nicht als kurzer dicker
         Strich — der ergibt zwei runde Knöpfe statt einer Brustplatte. */
      px.capsule(ctx,
        [CX + s * w.pecHalf * 0.24, sy + 9],
        [CX + s * w.pecHalf * 0.9, sy + 11],
        w.chestR * 0.42, col.skinLit);
    }
    px.capsule(ctx, [CX, sy + 7], [CX, sy + 19], 2, col.deep);       /* Brustbein */
    px.capsule(ctx, [CX, sy + 20], [CX, HIP - 11], 2.5, col.edge);   /* Bauchrinne */

    /* Bauchmuskeln zeichnen sich erst ab einer gewissen Größe ab. */
    if (w.abs > 0.26) {
      var rows = w.abs > 0.55 ? 3 : 2;
      for (var r = 0; r < rows; r++) {
        px.rect(ctx, CX - 6, HIP - 22 + r * 6, 4, 2, col.edge);
        px.rect(ctx, CX + 2, HIP - 22 + r * 6, 4, 2, col.edge);
      }
    }

    /* Und wo keine Kerben mehr sind, liegt der Speck: eine kurze Falte über
       dem Hosenbund, links und rechts. Das Gegenstück zu den Bauchmuskeln —
       an derselben Stelle, aus demselben Grund. */
    if (w.belly > 0.3) {
      for (i = 0; i < 2; i++) {
        s = i ? 1 : -1;
        px.capsule(ctx,
          [CX + s * (torsoAt(w, sy, HIP - 12) - 3), HIP - 12],
          [CX + s * (torsoAt(w, sy, HIP - 6) - 2), HIP - 6],
          2, col.soft);
      }
    }

    /* Kniescheibe: ein kleiner dunkler Punkt. Ohne ihn ist das Bein von der
       Hüfte bis zum Schuh eine ununterbrochene Röhre. */
    for (i = 0; i < 2; i++) {
      var l = j.legs[i];
      px.disc(ctx, l.knee[0], l.knee[1] + 1, 2, col.soft);
    }
  }

  /* Der Rücken lebt von drei Dingen: der Rinne in der Mitte, dem Trapez oben
     und den Latissimus-Kanten außen. Brust und Bauch fehlen hier komplett —
     stünden sie da, sähe die Figur aus, als hätte sie sich wieder umgedreht. */
  function backDetail(ctx, sy, w, j, col) {
    var i, s;

    /* Rückenrinne: von den Schultern bis zum Kreuz, oben breiter. */
    px.capsule(ctx, [CX, sy + 5], [CX, HIP - 7], 2.5, col.deep);
    px.capsule(ctx, [CX, sy + 4], [CX, sy + 16], 4, col.edge);

    /* Trapez: dunkler Keil vom Nacken zu den Schultern. */
    for (i = 0; i < 2; i++) {
      s = i ? 1 : -1;
      px.capsule(ctx,
        [CX + s * 2, sy - 5],
        [CX + s * w.shoulderSpan * 0.7, sy + 3],
        3, col.deep);
    }

    /* Latissimus: die Außenkante von der Achsel zur Taille, kräftiger als
       vorn — von hinten ist das die Hauptform. Wie vorn nur dort, wo es
       wirklich einen Keil gibt. */
    if (w.latHalf > w.waistHalf * 1.08) {
      for (i = 0; i < 2; i++) {
        s = i ? 1 : -1;
        px.capsule(ctx,
          [CX + s * (torsoAt(w, sy, sy + 5) - 1.5), sy + 5],
          [CX + s * (torsoAt(w, sy, HIP - 11) - 1.5), HIP - 11],
          2.5, col.deep);
        /* Licht auf der Fläche dazwischen macht den Keil plastisch. */
        px.capsule(ctx,
          [CX + s * w.latHalf * 0.55, sy + 9],
          [CX + s * w.waistHalf * 0.7, HIP - 16],
          3, col.skinLit);
      }
    }

    /* Untere Rückenpartie: zwei Grübchen über dem Hosenbund — die hat nur ein
       trockener Rücken. Liegt Fett darüber, wird daraus die Rolle über dem
       Hosenbund. */
    if (w.belly > 0.3) {
      for (i = 0; i < 2; i++) {
        s = i ? 1 : -1;
        px.capsule(ctx,
          [CX + s * (torsoAt(w, sy, HIP - 12) - 3), HIP - 12],
          [CX + s * (torsoAt(w, sy, HIP - 6) - 2), HIP - 6],
          2, col.deep);
      }
    } else if (w.back > 0.3) {
      px.rect(ctx, CX - 7, HIP - 12, 2, 2, col.deep);
      px.rect(ctx, CX + 5, HIP - 12, 2, 2, col.deep);
    }

    /* Beinbeuger: Schatten auf der Rückseite der Schenkel. */
    for (i = 0; i < 2; i++) {
      var l = j.legs[i];
      px.capsule(ctx,
        [l.hip[0], l.hip[1] + 8], [l.knee[0], l.knee[1] - 3],
        2, col.edge);
    }
  }

  /* ---------- Profil ------------------------------------------------------- */

  /* Eigene Zeichnung statt des Rigs aus figure.js. Jenes ist für die
     gedrungene Szenenfigur gerechnet; mit seinen Werten wird der Rumpf fast so
     breit wie lang, und die Hose landet als schräge Wurst auf einem Bein.

     Im Profil ist die Breite die Tiefe des Körpers: die Brust steht vorn
     heraus, der Rücken bleibt eine fast gerade Linie. Deshalb liegt die
     hintere Kante fest und nur die vordere wandert. */
  var FAR = -7;   /* die abgewandte Körperhälfte liegt so weit dahinter */

  function profileTorso(ctx, d, backX, color, extra) {
    var y0 = SHOULDER - 3, y1 = HIP + 2;
    var N = 12, h = (y1 - y0) / N, i, u, depth, e, y, bx, nape, blade;
    /* Wie in der Vorderansicht wandert die engste Stelle mit dem Fett nach
       oben, und darunter geht es wieder heraus — nur ist die Wölbung hier die
       Tiefe. Ohne Fett ist uW gleich 1, der dritte Abschnitt läuft leer und
       die Kurve ist die alte. */
    var uW = d.bellyAt > 0 ? 1 - d.bellyAt * 0.28 : 1;
    for (i = 0; i < N; i++) {
      u = i / (N - 1);
      /* Oben die Brust, darunter die Verjüngung zur Taille. */
      depth = u < 0.3
        ? lerp(d.chest * 0.9, d.chest, u / 0.3)
        : u <= uW
          ? lerp(d.chest, d.waist, (u - 0.3) / (uW - 0.3))
          : lerp(d.waist, d.belly, (u - uW) / (1 - uW));
      /* Die Rückenlinie zieht oben zur Halslinie ein und ist erst am
         Schulterblatt am tiefsten. Vorher stand die OBERSTE Reihe am
         weitesten hinten — die Silhouette sprang direkt unter dem
         Haaransatz um mehrere Punkte nach hinten: der Buckel. Die
         Vorderkante bleibt davon unberührt, die Brust sitzt weiter oben. */
      nape = u < 0.22 ? lerp(4.5, 0, u / 0.22) : 0;
      blade = u < 0.3 ? lerp(0, 1.5, u / 0.3) : lerp(1.5, 0, (u - 0.3) / 0.7);
      bx = backX + nape - blade;
      e = extra || 0;
      y = y0 + i * h;
      px.capsule(ctx, [bx - e, y], [backX + depth + e, y], h + 1.6 + e * 2, color);
    }
  }

  function drawProfile(ctx, pose, w, col, o) {
    var s = pose.side;
    var d = {
      chest: w.latHalf * 1.55 * (pose.depth || 1),
      waist: w.waistHalf * 1.9,
      /* Im Profil geht der Bauch nur nach VORN — hinten bleibt die
         Rückenlinie stehen. Deshalb steckt die ganze Wölbung in der Tiefe,
         und backX rechnet weiter aus der Taille. */
      belly: w.bulgeHalf * 1.9,
      bellyAt: w.belly
    };
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

    if (pose.triceps) {
      /* Der Arm haengt an der Rueckenlinie, nicht an festen Punkten. Mit
         festen Versaetzen stimmte die Pose nur fuer den breiten Koerper: bei
         der untrainierten Figur liegt die Rueckenlinie vier Punkte weiter
         vorn, und Arm samt Faust stak wieder als dunkler Schlauch hinter der
         Silhouette. Nur die Hoehen kommen aus der Posenbeschreibung. */
      elbow = [backX + w.armW * 0.2, s.elbow[1]];
      hand = [backX + w.armW * 0.05, s.hand[1]];
      fElbow = [backX + d.waist * 0.5, s.farElbow[1]];
      fHand = [backX + w.armW * 0.4, s.farHand[1]];
    }

    /* Fuß im Profil als Raster, Zehen nach vorn. Steht das Bein auf dem
       Ballen, reicht nur der Vorderfuß auf den Boden. */
    function shoe(p, ball, ramp) {
      if (ball) {
        px.stamp(ctx, SP.shoeBall, p[0] - 2, FOOT - 4, ramp);
        return;
      }
      px.stamp(ctx, SP.shoeSide, p[0] - 4, FOOT - 3, ramp);
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
    /* Der ferne Schuh bleibt ein dunkler Riegel — als Raster gezeichnet würde
       er mit seiner Kontur nach vorn drängen statt hinten zu bleiben. */
    px.rect(ctx, fFoot[0] - 4, FOOT - 3, 15, 6, C.ink);
    limb(fShoulder, fElbow, w.armW * 0.9, col.skinDark);
    limb(fElbow, fHand, w.foreW * 0.9, col.skinDark);
    px.disc(ctx, fHand[0], fHand[1], w.foreW * 0.66, col.skinDark);

    /* Hals und Rumpf. Die Halsbreite folgt der Schulter — mit festen 11
       Punkten war der Ink-Hals bei der untrainierten Figur breiter als ihre
       ganze Schulter und verschmolz mit Arm und Kontur zu einem Klotz. */
    px.capsule(ctx, [head[0] - 1, HEAD + 5], [shoulder[0] + 2, shoulder[1]],
      w.shoulderSpan * 0.82, C.ink);
    px.capsule(ctx, [head[0] - 1, HEAD + 6], [shoulder[0] + 2, shoulder[1] - 2],
      w.shoulderSpan * 0.6, col.skinDark);
    profileTorso(ctx, d, backX, C.ink, 1.4);
    profileTorso(ctx, d, backX, col.skin);

    /* Kopf im Profil als Raster: Haar über Hinterkopf und Scheitel, vorn Stirn,
       Auge, Nasenrücken und Kinn. */
    px.disc(ctx, head[0], head[1], HEAD_R + 1.5, C.ink);
    px.stamp(ctx, SP.headSide, head[0] - 9, head[1] - 9, col.ramp);

    /* Nahes Bein vor dem Rumpf, danach der nahe Arm ganz vorn. */
    limb(hip, knee, w.thighW, col.skin);
    limb(knee, foot, w.calfW, col.skin);
    shoe(foot, s.ball, col.ramp);

    /* Hose erst jetzt: vor dem nahen Bein gezeichnet blitzte sie nur links und
       rechts daneben hervor. Sie liegt über dem Schenkelansatz, nicht darunter.
       Tiefe wie die Taille plus ein Rand — breiter sähe aus wie ein Brett. */
    var shorts = o.shorts || C.jeans;
    px.rect(ctx, backX - 3, HIP - 8, d.waist + 8, 20, C.ink);
    px.rect(ctx, backX - 2, HIP - 7, d.waist + 6, 18, shorts);

    /* Der Deltamuskel ist im Profil fast so tief wie der Brustkorb — mit einer
       kleinen Kugel wirkt die Schulter abfallend statt geladen. */
    if (pose.triceps) {
      /* Der Arm liegt auf dem Rumpf, seine Hinterkante ist aber Silhouette.
         Deshalb dreigeteilt: dunkle Haut als Trennung zum Rumpf (innen), Ink
         nur entlang der Aussenkante, dann die Hautflaeche — sie deckt die
         innere Haelfte der Ink-Linie wieder zu. Eine volle Umrandung mitten
         auf dem Ruecken las sich als Rucksack, die dunkle Wulst ohne
         Aussenkontur vor der dunklen Wand als Schlauch. */
      px.disc(ctx, shoulder[0], shoulder[1], w.shoulderSpan * 0.55 + 1.5, col.skinDark);
      px.disc(ctx, shoulder[0], shoulder[1], w.shoulderSpan * 0.52, col.skin);
      px.capsule(ctx, shoulder, elbow, w.armW + 2.5, col.skinDark);
      px.capsule(ctx, elbow, hand, w.foreW + 2.5, col.skinDark);
      px.capsule(ctx, [shoulder[0] - w.shoulderSpan * 0.45, shoulder[1] - 2],
        [elbow[0] - w.armW * 0.5, elbow[1]], 2.5, C.ink);
      px.capsule(ctx, [elbow[0] - w.armW * 0.5, elbow[1]],
        [hand[0] - w.foreW * 0.5, hand[1]], 2.5, C.ink);
      px.capsule(ctx, shoulder, elbow, w.armW, col.skin);
      px.capsule(ctx, elbow, hand, w.foreW, col.skin);
    } else {
      px.disc(ctx, shoulder[0], shoulder[1], w.shoulderSpan * 0.55 + 2, C.ink);
      px.disc(ctx, shoulder[0], shoulder[1], w.shoulderSpan * 0.55, col.skin);
      limb(shoulder, elbow, w.armW, col.skin);
      limb(elbow, hand, w.foreW, col.skin);
    }
    /* Beide Hände treffen sich an einem Punkt — geschlossen, nicht zwei Fäuste
       nebeneinander. Deshalb nur eine gemeinsame Faust. */
    px.stamp(ctx, SP.fist, hand[0] - 4, hand[1] - 4, col.ramp);

    /* 3. Was die Pose ausmacht. */
    px.disc(ctx, shoulder[0] - 1.5, shoulder[1] - 2, w.shoulderSpan * 0.26, col.skinLit);
    px.capsule(ctx, [backX + 1, SHOULDER + 6], [backX + 1, HIP - 8], 2, col.edge);

    if (pose.chest) {
      /* Brustplatte: Licht auf der Wölbung, darunter die Kante zum Bauch. */
      px.capsule(ctx,
        [backX + d.chest * 0.45, SHOULDER + 6],
        [backX + d.chest * 0.92, SHOULDER + 12],
        d.chest * 0.32, col.skinLit);
      px.capsule(ctx,
        [backX + d.chest * 0.3, SHOULDER + 20],
        [backX + d.chest * 0.95, SHOULDER + 17],
        2.5, col.deep);
      px.capsule(ctx,
        [backX + d.chest * 0.55, SHOULDER + 24],
        [backX + d.waist * 0.75, HIP - 11],
        2, col.edge);                                       /* seitliche Bauchkante */
    }
    if (pose.triceps) {
      /* Der Trizeps liegt hinten am Oberarm — im Profil die Hauptsache. */
      px.capsule(ctx,
        [shoulder[0] - w.armW * 0.32, shoulder[1] + 6],
        [elbow[0] - w.armW * 0.28, elbow[1] - 4],
        w.armW * 0.44, col.skinLit);
      px.capsule(ctx,
        [shoulder[0] + w.armW * 0.06, shoulder[1] + 8],
        [elbow[0] + w.armW * 0.06, elbow[1] - 3],
        1.5, col.deep);
    }

    /* Bauchmuskeln zeichnen sich im Profil als Kerben an der Vorderkante ab. */
    if (w.abs > 0.3) {
      for (var r = 0; r < 2; r++) {
        px.rect(ctx, backX + d.waist * 0.62, HIP - 20 + r * 7, 3, 2, col.edge);
      }
    }

    /* Statt der Kerben die Falte, mit der der Bauch auf dem Hosenbund
       aufliegt. Sie sitzt an der Vorderkante, wo die Wölbung wieder
       hereinläuft — ohne sie ist der Bauch nur eine dicke Stelle. */
    if (d.bellyAt > 0.3) {
      px.capsule(ctx,
        [backX + d.belly * 0.52, HIP - 9],
        [backX + d.belly * 0.95, HIP - 7],
        2, col.soft);
    }
  }

  /* ---------- Einstieg ----------------------------------------------------- */

  /* opts: { shorts, body }
     body: { muscles, health } — ein fremder Körper (Rivale). Ohne Angabe
     posiert der eigene. */
  function draw(ctx, poseId, opts) {
    var pose = get(poseId);
    var o = opts || {};
    var body = o.body || null;
    var health = body && body.health !== undefined
      ? body.health : MF.game.stats.healthAvg();

    /* Schattiert wird über Rampenstufen. Gemischte Zwischentöne hatte vorher
       quantize() auf die Bodenfarben geschoben — die Latissimuskanten lagen auf
       'floor', die Rückenrinne auf 'floorDark'.

       Schlechte Gesundheit schaltet auf die fahle Rampe und senkt bei sehr
       schlechten Werten zusätzlich die Grundstufe. Vorher wurde der Hautton
       Richtung 'steel' gemischt, was bis Gesundheit 30 gar nichts tat und
       darunter auf einen Braunton sprang. */
    var sk = health < 30 ? px.ramp('pale', 2)
           : health < 55 ? px.ramp('pale', 3)
           : px.ramp('skin', 4);

    var col = {
      skin: sk(0),
      skinLit: sk(1),
      glow: sk(2),
      soft: sk(-1),     /* weiche Schattierung auf Flächen  */
      skinDark: sk(-2), /* abgewandte Körperhälfte, Hals    */
      edge: sk(-2),     /* Muskelkanten                     */
      deep: sk(-3),     /* Rinnen und Kerben                */
      ramp: sk
    };

    var w = widths(pose, body ? body.muscles : null,
      body && body.definition !== undefined ? body.definition : undefined);

    /* Das aufgelegte Raster in Stahlgrau ist weg: die fahle Rampe färbt jetzt
       den ganzen Körper, statt ihm ein graues Netz überzuwerfen. */
    if (pose.view === 'side') drawProfile(ctx, pose, w, col, o);
    else drawUpright(ctx, pose, w, col, o);
  }

  /* Die Kür der Golden Era gibt es nicht ab Tag eins — sie ist die Belohnung
     dafür, dass die Pflichtposen schon eine Weile stehen. */
  function isUnlocked(id) {
    var need = get(id).level || 1;
    return MF.game.state.get().level >= need;
  }

  MF.ui.poses = {
    list: POSES,
    get: get,
    draw: draw,
    isUnlocked: isUnlocked,
    size: { w: W, h: H },
    /* Für den Durchlauftest: die Verhältnisse werden dort nachgerechnet, damit
       sie nicht wieder still wegrutschen. */
    widths: widths,
    metrics: {
      UPPER: UPPER, FORE: FORE,
      FOOT: FOOT, KNEE: KNEE, HIP: HIP, SHOULDER: SHOULDER,
      HEAD: HEAD, HEAD_R: HEAD_R
    }
  };
})(window.MacFit);
