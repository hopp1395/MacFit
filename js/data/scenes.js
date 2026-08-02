/* Szenen für die Übungen. Alles im Koordinatenraum 200 x 130, Boden bei y = 118,
   Seitenansicht. Jede Szene bringt mit:
     equip / front  Gerät hinter bzw. vor der Figur
     a / b          Keyframes (a = Streckung, b = tiefster Punkt); dazwischen
                    wird interpoliert, gesteuert vom Marker der Trainingsleiste
     mid            optional, je Gelenk: Stuetzpunkt auf halber Strecke. Noetig,
                    wenn ein Gelenk weit um sein Nachbargelenk schwenkt — die
                    gerade Sehne schnitte den Bogen, und der Knochen schrumpfte
                    sichtbar mitten in der Bewegung
     orbit          optional, { kind: elternGelenk }: das Gelenk laeuft auf dem
                    Kreisbogen um sein Elterngelenk (Winkel und Radius werden
                    interpoliert, nicht die Lage). Exakt konstante Knochenlaenge
                    in jeder Zwischenphase — fuer grosse Schwenks die bessere
                    Wahl als mid, das nur die halbe Sehne durch zwei ersetzt
     hold           Gelenke, die sich nicht bewegen (aus a übernommen)
     implement      barbell | dumbbell | handle | roller | sled | none
     cable          Seilzug von diesem Punkt zur Hand

   Gelenke: head, shoulder, elbow, hand, hip, knee, foot */
(function (MF) {
  'use strict';

  var FLOOR = 118;

  /* Wiederkehrende Bauteile. */
  function post(x, top, c) {
    return { t: 'rect', x: x, y: top, w: 6, h: FLOOR - top, rx: 2, c: c || '#3d4756' };
  }
  function pad(x, y, w, h) {
    return { t: 'rect', x: x, y: y, w: w, h: h, rx: 3, c: '#2f3a4a' };
  }
  function frameLine(x1, y1, x2, y2, w) {
    return { t: 'line', x1: x1, y1: y1, x2: x2, y2: y2, w: w || 4, c: '#3d4756' };
  }

  var SCENES = {

    /* ---------- Liegend ------------------------------------------------- */
    bench: {
      name: 'Flachbank', face: 1, supine: true,
      equip: [
        pad(52, 84, 96, 9),
        frameLine(66, 93, 63, FLOOR, 5),
        frameLine(134, 93, 137, FLOOR, 5),
        post(46, 46), post(152, 46),
        frameLine(49, 52, 155, 52, 3)
      ],
      implement: 'barbell',
      hold: { hip: [112, 79], knee: [136, 85], foot: [143, FLOOR], head: [70, 77] },
      /* Der Ellbogen sinkt FUSSwaerts neben den Rumpf auf Bankhoehe — kopfwaerts
         saehe er ueber das Gesicht ueberstreckt aus. mid haelt ihn dabei auf dem
         Kreisbogen um die Schulter, sonst schrumpft der Oberarm mitten in der
         Wiederholung (Sehne statt Bogen). */
      a: { shoulder: [84, 79], elbow: [88, 65], hand: [85, 51] },
      mid: { elbow: [97, 72] },
      b: { shoulder: [84, 79], elbow: [98, 84], hand: [90, 71] }
    },

    incline: {
      name: 'Schrägbank', face: 1, supine: true,
      equip: [
        /* Die Lehne steigt zum KOPF hin (links) — die Figur liegt mit
           erhoehtem Oberkoerper darauf. Vorher stieg das Polster fusswaerts,
           genau spiegelverkehrt zur Figur. */
        { t: 'line', x1: 58, y1: 74, x2: 142, y2: 104, w: 11, c: '#2f3a4a' },
        frameLine(70, 80, 66, FLOOR, 5),
        frameLine(132, 102, 136, FLOOR, 5),
        post(44, 40), frameLine(47, 46, 60, 46, 3)
      ],
      implement: 'barbell',
      hold: { hip: [112, 88], knee: [134, 94], foot: [141, FLOOR], head: [72, 70] },
      /* Wie bei der Flachbank: Ellbogen fusswaerts nach unten, mid auf dem
         Kreisbogen. */
      a: { shoulder: [86, 77], elbow: [90, 62], hand: [88, 47] },
      mid: { elbow: [97, 67] },
      b: { shoulder: [86, 77], elbow: [100, 76], hand: [88, 67] }
    },

    decline: {
      name: 'Negativbank', face: 1, supine: true,
      equip: [
        /* Die Lehne faellt zum Kopf hin ab, die Beine haken oben ueber der
           Rolle ein — auf der Negativbank stehen die Fuesse nicht am Boden. */
        { t: 'line', x1: 58, y1: 100, x2: 142, y2: 72, w: 11, c: '#2f3a4a' },
        frameLine(70, 102, 66, FLOOR, 5),
        frameLine(132, 80, 136, FLOOR, 5),
        { t: 'circle', cx: 144, cy: 74, r: 4.5, c: '#3d4756' },
        post(44, 48), frameLine(47, 54, 60, 54, 3)
      ],
      implement: 'barbell',
      hold: { hip: [112, 77], knee: [134, 70], foot: [146, 80], head: [72, 86] },
      /* Ellbogen wie auf den anderen Baenken fusswaerts, mid auf dem Bogen. */
      a: { shoulder: [86, 84], elbow: [90, 69], hand: [87, 54] },
      mid: { elbow: [99, 77] },
      b: { shoulder: [86, 84], elbow: [100, 88], hand: [92, 75] }
    },

    /* ---------- Sitzend, Maschine --------------------------------------- */
    latzug: {
      name: 'Latzug', face: 1,
      equip: [
        post(150, 22),
        frameLine(120, 26, 156, 26, 4),
        { t: 'circle', cx: 150, cy: 26, r: 5, c: '#586377' },
        pad(88, 96, 44, 8),
        frameLine(104, 104, 104, FLOOR, 5)
      ],
      cable: [150, 26],
      implement: 'handle',
      hold: { hip: [100, 93], knee: [126, 97], foot: [130, FLOOR] },
      a: { shoulder: [100, 71], head: [102, 58], elbow: [114, 57], hand: [124, 41] },
      b: { shoulder: [99, 74], head: [100, 61], elbow: [113, 76], hand: [121, 64] }
    },

    row: {
      name: 'Ruderzug', face: 1,
      equip: [
        pad(66, 100, 66, 7),
        { t: 'rect', x: 148, y: 92, w: 10, h: 24, rx: 2, c: '#3d4756' },
        { t: 'circle', cx: 156, cy: 86, r: 4, c: '#586377' }
      ],
      cable: [156, 86],
      implement: 'handle',
      hold: { knee: [124, 93], foot: [148, 100] },
      a: { hip: [96, 95], shoulder: [92, 73], head: [90, 61], elbow: [118, 74], hand: [136, 79] },
      b: { hip: [96, 95], shoulder: [99, 74], head: [98, 62], elbow: [86, 81], hand: [106, 80] }
    },

    shoulderpress: {
      name: 'Schulterdrücken', face: -1,
      equip: [
        pad(84, 98, 38, 7),
        { t: 'line', x1: 120, y1: 60, x2: 122, y2: 100, w: 8, c: '#2f3a4a' },
        frameLine(102, 105, 102, FLOOR, 5)
      ],
      implement: 'dumbbell',
      hold: { hip: [104, 95], knee: [82, 98], foot: [74, 116] },
      a: { shoulder: [101, 73], head: [100, 61], elbow: [105, 60], hand: [104, 44] },
      b: { shoulder: [101, 75], head: [100, 63], elbow: [113, 78], hand: [104, 65] }
    },

    butterfly: {
      name: 'Butterfly', face: -1,
      equip: [
        pad(84, 96, 36, 7),
        { t: 'line', x1: 118, y1: 62, x2: 121, y2: 98, w: 8, c: '#2f3a4a' },
        frameLine(102, 103, 102, FLOOR, 5),
        frameLine(64, 50, 64, 96, 4), frameLine(64, 52, 78, 60, 3)
      ],
      implement: 'handle',
      hold: { hip: [104, 93], knee: [84, 96], foot: [76, 116], shoulder: [100, 71], head: [98, 59] },
      a: { elbow: [82, 68], hand: [68, 64] },
      b: { elbow: [90, 72], hand: [82, 76] }
    },

    crunch: {
      name: 'Bauchmaschine', face: -1,
      equip: [
        pad(90, 98, 38, 7),
        { t: 'line', x1: 124, y1: 58, x2: 126, y2: 100, w: 8, c: '#2f3a4a' },
        frameLine(106, 105, 106, FLOOR, 5)
      ],
      implement: 'none',
      hold: { hip: [110, 95], knee: [88, 98], foot: [80, 116] },
      a: { shoulder: [105, 73], head: [103, 61], elbow: [97, 69], hand: [101, 59] },
      b: { shoulder: [97, 83], head: [92, 72], elbow: [89, 79], hand: [93, 69] }
    },

    legext: {
      name: 'Beinstrecker', face: 1,
      equip: [
        pad(72, 92, 48, 8),
        { t: 'line', x1: 68, y1: 64, x2: 70, y2: 94, w: 8, c: '#2f3a4a' },
        frameLine(94, 100, 94, FLOOR, 5),
        frameLine(118, 92, 118, 108, 4)
      ],
      implement: 'roller',
      hold: { hip: [96, 89], shoulder: [84, 68], head: [79, 56], elbow: [90, 79], hand: [100, 91], knee: [118, 90] },
      /* Unterschenkel als orbit ums feste Knie — vorher war er gestreckt 30
         und gebeugt 23 lang. */
      a: { foot: [141, 86] },
      b: { foot: [123, 113] },
      orbit: { foot: 'knee' }
    },

    legpress: {
      name: 'Beinpresse', face: 1,
      equip: [
        { t: 'line', x1: 42, y1: 68, x2: 74, y2: 104, w: 11, c: '#2f3a4a' },
        pad(70, 100, 30, 7),
        frameLine(96, 106, 168, 52, 4),
        frameLine(90, 112, 162, 58, 4)
      ],
      implement: 'sled',
      hold: { head: [46, 70], shoulder: [60, 82], hip: [88, 99], elbow: [68, 94], hand: [80, 104] },
      /* Fuss faehrt auf der Schiene, Kniepositionen sind als Kreisschnitt
         gerechnet (Oberschenkel 22, Unterschenkel 26) — vorher schwankten
         die Knochen zwischen 39/36 und 29/19. Knie als orbit um die
         Huefte. */
      a: { knee: [104, 84], foot: [130, 80] },
      b: { knee: [94, 78], foot: [117, 90] },
      orbit: { knee: 'hip' }
    },

    /* ---------- Stehend ---------------------------------------------------
       Aufrecht stehende Figuren folgen denselben anatomischen Bruchteilen wie
       das Posenbild: Schulter 44, Hüfte 70, Knie 92 bei Kopfoberkante 27 und
       Boden 118. Vorher lagen Schulter und Hüfte drei Punkte tiefer — zu
       langer Hals, zu kurze Beine. */
    squat: {
      name: 'Kniebeuge', face: -1,
      equip: [post(52, 44), post(148, 44), frameLine(55, 50, 151, 50, 3)],
      implement: 'barbell',
      hold: { foot: [100, FLOOR] },
      /* Huefte nach HINTEN, Knie nach VORN ueber die Zehen (Blick nach
         links) — vorher war es genau umgekehrt und das Bein knickte wie
         ein Vogelbein. Der mid-Stuetzpunkt ist der Kreisschnitt bei halber
         Tiefe: Fuss und Knochenlaengen stehen fest, sonst schrumpfte der
         Oberschenkel unterwegs um ein Fuenftel. */
      a: { hip: [100, 71], knee: [100, 95], shoulder: [100, 45], head: [98, 32], elbow: [90, 54], hand: [95, 43] },
      mid: { knee: [91, 97] },
      b: { hip: [115, 88], knee: [93, 97], shoulder: [106, 64], head: [102, 52], elbow: [96, 73], hand: [101, 62] }
    },

    deadlift: {
      name: 'Kreuzheben', face: -1,
      equip: [],
      implement: 'barbell',
      hold: { foot: [96, FLOOR] },
      a: { hip: [100, 72], knee: [98, 95], shoulder: [99, 45], head: [97, 32], elbow: [99, 62], hand: [97, 79] },
      b: { hip: [106, 87], knee: [95, 98], shoulder: [83, 73], head: [72, 64], elbow: [86, 89], hand: [88, 103] }
    },

    overhead: {
      name: 'Overhead-Press', face: 1,
      equip: [],
      implement: 'barbell',
      hold: { hip: [100, 70], knee: [100, 92], foot: [100, FLOOR] },
      a: { shoulder: [100, 44], head: [98, 34], elbow: [104, 32], hand: [101, 16] },
      b: { shoulder: [100, 45], head: [99, 35], elbow: [111, 52], hand: [100, 39] }
    },

    curl: {
      name: 'Curl', face: -1,
      equip: [],
      implement: 'dumbbell',
      hold: { hip: [100, 70], knee: [100, 92], foot: [100, FLOOR], shoulder: [98, 44], head: [97, 34] },
      /* Strenger Curl: der Ellbogen bleibt am Rumpf stehen, nur der
         Unterarm schwenkt. Oberarm 16, Unterarm 17 — die 14 aus der
         idle-Szene wirkte hier gestaucht, weil die Hantelscheibe die Hand
         verdeckt und der Unterarm das Zentrum der Uebung ist. Die Hand
         laeuft als orbit exakt auf dem Kreisbogen um den Ellbogen. */
      a: { elbow: [98, 60], hand: [99, 77] },
      b: { elbow: [98, 60], hand: [86, 48] },
      orbit: { hand: 'elbow' }
    },

    lateral: {
      name: 'Seitheben', face: -1,
      equip: [],
      implement: 'dumbbell',
      hold: { hip: [100, 70], knee: [100, 92], foot: [100, FLOOR], shoulder: [100, 44], head: [99, 34] },
      /* Oberarm 16, Unterarm 14 in beiden Endlagen — oben war der Unterarm
         auf 18 gewachsen. mid haelt Ellbogen und Hand auf dem Kreisbogen um
         die Schulter, sonst schrumpft der Arm mitten im Heben. */
      a: { elbow: [90, 57], hand: [82, 69] },
      mid: { elbow: [85, 51], hand: [72, 57] },
      b: { elbow: [84, 44], hand: [70, 42] }
    },

    tricep: {
      name: 'Kabelzug', face: 1,
      equip: [
        post(152, 24),
        { t: 'circle', cx: 155, cy: 30, r: 5, c: '#586377' }
      ],
      cable: [155, 30],
      implement: 'handle',
      /* Oberkoerper nach vorn gebeugt (Huefte 96, Schulter 104), Knie leicht
         weich — kerzengerade sah der Druecker unnatuerlich aus. Der Ellbogen
         steht fest am Koerper unter der Schulter, nur der Unterarm schwenkt
         als orbit zwischen Zug oben und Streckung unten. */
      hold: { hip: [96, 70], knee: [98, 92], foot: [96, FLOOR],
              shoulder: [104, 46], head: [107, 35], elbow: [106, 61] },
      a: { hand: [111, 77] },
      b: { hand: [117, 48] },
      orbit: { hand: 'elbow' }
    },

    calf: {
      name: 'Wadenheben', face: 1,
      equip: [
        { t: 'rect', x: 84, y: 106, w: 38, h: 12, rx: 2, c: '#3d4756' },
        frameLine(140, 30, 140, FLOOR, 5),
        frameLine(118, 36, 142, 36, 4)
      ],
      implement: 'none',
      hold: { foot: [104, 106], elbow: [116, 52], hand: [126, 44] },
      a: { hip: [102, 64], knee: [102, 87], shoulder: [102, 38], head: [101, 25] },
      b: { hip: [102, 71], knee: [102, 92], shoulder: [102, 45], head: [101, 32] }
    },

    donkeycalf: {
      name: 'Donkey Calf', face: -1,
      equip: [
        { t: 'rect', x: 92, y: 106, w: 36, h: 12, rx: 2, c: '#3d4756' },
        pad(52, 74, 26, 7)
      ],
      implement: 'none',
      hold: { foot: [110, 106], hand: [66, 72], elbow: [74, 74] },
      a: { hip: [112, 68], knee: [110, 88], shoulder: [82, 66], head: [69, 63] },
      b: { hip: [112, 74], knee: [110, 93], shoulder: [82, 72], head: [69, 69] }
    },

    /* ---------- Hängend --------------------------------------------------- */
    pullup: {
      name: 'Klimmzugstange', face: 1,
      equip: [
        frameLine(56, 24, 144, 24, 5),
        post(58, 24), post(140, 24)
      ],
      implement: 'none',
      hold: { hand: [100, 26] },
      /* Beine im Knie 90 Grad gebeugt, Unterschenkel nach hinten — gestreckt
         hingen die Fuesse fast am Boden. Knochenlaengen wie in den
         Standszenen (Oberschenkel ~21, Unterschenkel ~22, Oberarm ~16.5,
         Unterarm ~18): die alte Pose war insgesamt gestaucht, oben schrumpfte
         der Arm zusaetzlich. Der Ellbogen laeuft ueber mid, weil die Hand an
         der Stange fest ist und er sonst die Bahn schneidet — und er beugt
         nach VORN vor den Koerper: nach hinten hinter den Kopf kann die
         Schulter nicht. */
      a: { elbow: [104, 44], shoulder: [100, 60], head: [100, 47], hip: [100, 86], knee: [106, 106], foot: [85, 112] },
      mid: { elbow: [112, 40] },
      b: { elbow: [115, 36], shoulder: [100, 43], head: [100, 30], hip: [100, 70], knee: [107, 89], foot: [86, 97] }
    },

    hangingleg: {
      name: 'Beinheben hängend', face: 1,
      equip: [
        frameLine(56, 22, 144, 22, 5),
        post(58, 22), post(140, 22)
      ],
      implement: 'none',
      hold: { hand: [100, 24], elbow: [102, 40], shoulder: [100, 54], head: [100, 41] },
      /* Kniebeugen-Variante: der Oberschenkel schwenkt bis ueber die
         Waagerechte, der Unterschenkel bleibt haengen — das Bein beugt
         sich beim Anheben im Knie. Beide Beinknochen als orbit (Knie um
         die Huefte, Fuss ums Knie), dadurch konstante Laengen: vorher
         wuchs der Unterschenkel von 15 auf 19 und beide kollabierten auf
         der geraden Zwischenbahn. */
      a: { hip: [100, 82], knee: [102, 101], foot: [102, 116] },
      b: { hip: [100, 80], knee: [117, 72], foot: [122, 86] },
      orbit: { knee: 'hip', foot: 'knee' }
    },

    dips: {
      name: 'Dip-Barren', face: 1,
      equip: [
        frameLine(74, 58, 132, 58, 5),
        frameLine(78, 58, 76, FLOOR, 5),
        frameLine(128, 58, 130, FLOOR, 5)
      ],
      implement: 'none',
      hold: { hand: [100, 56] },
      /* Die Ellbogen beugen nach HINTEN, nicht nach vorn — vorn kann die
         Schulter beim Dip nicht. Knochenlaengen wie ueberall (Oberarm ~15,
         Unterarm ~15); die alte Pose hatte 9er-Oberarme. Der Ellbogen
         laeuft ueber mid (Kreisschnitt bei halber Hoehe), weil die Hand am
         Holm fest ist. Unten faellt die Schulter bis auf Holmhoehe, der
         Rumpf lehnt leicht nach vorn. */
      a: { shoulder: [99, 27], head: [97, 15], elbow: [101, 41], hip: [98, 55], knee: [107, 75], foot: [98, 89] },
      mid: { elbow: [87, 48] },
      b: { shoulder: [100, 54], head: [96, 42], elbow: [85, 58], hip: [96, 82], knee: [106, 101], foot: [97, 115] }
    },

    /* ---------- Nur für den Hintergrund ---------------------------------- */
    idle: {
      name: 'Herumstehen', face: -1,
      equip: [],
      implement: 'none',
      hold: { hip: [100, 70], knee: [100, 92], foot: [100, FLOOR], head: [99, 34] },
      a: { shoulder: [100, 44], elbow: [94, 59], hand: [92, 73] },
      b: { shoulder: [101, 45], elbow: [95, 60], hand: [95, 71] }
    },

    phone: {
      name: 'Am Handy', face: -1,
      equip: [],
      implement: 'none',
      hold: { hip: [100, 70], knee: [100, 92], foot: [100, FLOOR], shoulder: [100, 44] },
      a: { head: [97, 35], elbow: [93, 57], hand: [90, 47] },
      b: { head: [96, 36], elbow: [93, 58], hand: [91, 49] }
    },

    treadmill: {
      name: 'Laufband', face: 1,
      equip: [
        { t: 'rect', x: 70, y: 104, w: 64, h: 8, rx: 3, c: '#2f3a4a' },
        frameLine(132, 60, 134, 104, 4),
        frameLine(112, 62, 136, 62, 3)
      ],
      implement: 'none',
      hold: { hip: [100, 70], shoulder: [100, 44], head: [99, 31] },
      a: { knee: [110, 88], foot: [116, 103], elbow: [108, 58], hand: [112, 70] },
      b: { knee: [92, 90], foot: [86, 103], elbow: [92, 58], hand: [88, 70] }
    }
  };

  /* Welche Übung wird wie dargestellt. */
  var BY_EXERCISE = {
    'kurzhantel-curl': 'curl',
    'hammer-curl': 'curl',
    'bankdruecken': 'bench',
    'schraegbank': 'incline',
    'negativ-schraegbank': 'decline',
    'butterfly-pro': 'butterfly',
    'latzug': 'latzug',
    'rudern-kabel': 'row',
    'klimmzug': 'pullup',
    'kreuzheben': 'deadlift',
    'beinpresse': 'legpress',
    'kniebeuge': 'squat',
    'front-squat': 'squat',
    'beinstrecker': 'legext',
    'crunch-maschine': 'crunch',
    'hanging-leg-raise': 'hangingleg',
    'schulterdruecken': 'shoulderpress',
    'overhead-press': 'overhead',
    'seitheben': 'lateral',
    'trizepsdruecken': 'tricep',
    'dips': 'dips',
    'wadenheben': 'calf',
    'donkey-calf': 'donkeycalf'
  };

  /* Wer im Hintergrund trainiert. */
  var AMBIENT = ['curl', 'treadmill', 'phone', 'latzug', 'bench', 'idle', 'squat', 'lateral'];

  var JOINTS = ['head', 'shoulder', 'elbow', 'hand', 'hip', 'knee', 'foot'];

  /* Vollständige Pose für einen Zeitpunkt t (0 = gestreckt, 1 = tiefster Punkt). */
  function poseAt(scene, t) {
    /* Geglättet statt linear: an den Umkehrpunkten verweilt die Bewegung
       kurz — so sieht eine kontrollierte Wiederholung aus. Linear schrubbte
       die Figur wie ein Scheibenwischer zwischen den Endlagen. */
    var e = t * t * (3 - 2 * t);
    var out = {};
    for (var i = 0; i < JOINTS.length; i++) {
      var j = JOINTS[i];
      var a = scene.a[j] || (scene.hold && scene.hold[j]);
      var b = scene.b[j] || (scene.hold && scene.hold[j]) || a;
      if (!a) { out[j] = [100, 80]; continue; }
      /* Drehgelenk: nicht die Lage interpolieren, sondern Winkel und Radius
         um das Elterngelenk — der Knochen ist damit in JEDER Zwischenphase
         exakt gleich lang. Setzt voraus, dass das Elterngelenk in JOINTS
         vor dem Kind steht, damit out[parent] schon berechnet ist. */
      var parent = scene.orbit && scene.orbit[j];
      if (parent && out[parent]) {
        var pa = scene.a[parent] || (scene.hold && scene.hold[parent]);
        var pb = scene.b[parent] || (scene.hold && scene.hold[parent]) || pa;
        var ax = a[0] - pa[0], ay = a[1] - pa[1];
        var bx = b[0] - pb[0], by = b[1] - pb[1];
        var ra = Math.sqrt(ax * ax + ay * ay);
        var rb = Math.sqrt(bx * bx + by * by);
        var wa = Math.atan2(ay, ax);
        var dw = Math.atan2(by, bx) - wa;
        if (dw > Math.PI) dw -= 2 * Math.PI;      /* kuerzester Drehsinn */
        if (dw < -Math.PI) dw += 2 * Math.PI;
        var w = wa + dw * e;
        var r = ra + (rb - ra) * e;
        out[j] = [out[parent][0] + Math.cos(w) * r,
                  out[parent][1] + Math.sin(w) * r];
        continue;
      }
      /* Mit Stuetzpunkt laeuft das Gelenk ueber zwei Geradenstuecke — genug
         Bogen, damit der Knochen seine Laenge behaelt. */
      var m = scene.mid && scene.mid[j];
      if (m) {
        var p = e < 0.5 ? a : m;
        var q = e < 0.5 ? m : b;
        var u = e < 0.5 ? e * 2 : (e - 0.5) * 2;
        out[j] = [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
      } else {
        out[j] = [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
      }
    }
    return out;
  }

  MF.data.scenes = {
    FLOOR: FLOOR,
    WIDTH: 200,
    all: SCENES,
    ambient: AMBIENT,
    get: function (id) { return SCENES[id] || null; },
    forExercise: function (exerciseId) {
      return SCENES[BY_EXERCISE[exerciseId]] || SCENES.curl;
    },
    poseAt: poseAt
  };
})(window.MacFit);
