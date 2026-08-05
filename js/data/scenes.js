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
         und gebeugt 23 lang. Die Streckung endet knapp UNTER der
         Waagerechten: darueber laese sich das Knie ueberdehnt. */
      a: { foot: [141, 91] },
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
      mid: { knee: [90, 98] },
      b: { hip: [111, 89], knee: [90, 98], shoulder: [102, 65], head: [98, 53], elbow: [92, 74], hand: [97, 63] }
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
      /* Die Zehen (toe) stehen fest auf dem Block, der Knoechel kippt beim
         Heben um sie nach oben-vorn — der Fuss dreht sichtbar in den
         Zehenstand, statt dass der ganze Koerper schwebt. Bein bleibt
         starr, Ellbogen je Endlage als Kreisschnitt (Hand am Rahmen). */
      hold: { hand: [126, 44], toe: [110, 107] },
      a: { hip: [104, 68], knee: [104, 89], foot: [106, 103], shoulder: [104, 42], head: [103, 29], elbow: [114, 50] },
      b: { hip: [102, 71], knee: [102, 92], foot: [104, 106], shoulder: [102, 45], head: [101, 32], elbow: [114, 49] }
    },

    donkeycalf: {
      name: 'Donkey Calf', face: -1,
      equip: [
        { t: 'rect', x: 92, y: 106, w: 36, h: 12, rx: 2, c: '#3d4756' },
        pad(52, 74, 26, 7)
      ],
      implement: 'none',
      /* Wie beim Wadenheben: Zehen fest, Knoechel kippt um sie nach
         oben-vorn (Blick nach links). Hand und Ellbogen liegen fest auf
         dem Polster. */
      hold: { hand: [66, 72], elbow: [74, 76], toe: [104, 107] },
      a: { hip: [110, 71], knee: [108, 90], foot: [108, 103], shoulder: [80, 69], head: [67, 66] },
      b: { hip: [112, 74], knee: [110, 93], foot: [110, 106], shoulder: [82, 72], head: [69, 69] }
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

    /* Laufband. Die Bandoberkante liegt bei 110, die Hüfte 44 darüber: das
       Bein (22 + 26) behält damit auch im längsten Schritt einen Rest Beugung,
       statt durchgestreckt zu überziehen. Früher stand die Hüfte auf 70 über
       einem Band auf 103 — daher die Hockstellung. */
    treadmill: {
      name: 'Laufband', face: 1,
      equip: [
        { t: 'rect', x: 68, y: 110, w: 68, h: 8, rx: 3, c: '#2f3a4a' },
        frameLine(134, 60, 136, 110, 4),
        frameLine(112, 62, 138, 62, 3),
        { t: 'rect', x: 128, y: 48, w: 16, h: 12, rx: 2, c: '#3d4756' }
      ],
      implement: 'none',
      hold: { hip: [100, 66], shoulder: [100, 40], head: [99, 27] },
      a: { knee: [108, 86], foot: [112, 110], elbow: [104, 54], hand: [108, 66] },
      b: { knee: [94, 88], foot: [88, 110], elbow: [96, 54], hand: [92, 66] },
      /* Gehen laeuft rund und ohne Umkehrpunkt — siehe gaitPose(). */
      gait: {
        ground: 110, front: 112, back: 88, lift: 8, rev: 0.95, swing: 0.42,
        thigh: 22, shin: 26, arm: 15, fore: 13, bob: 1.2,
        /* Vorlage des Rumpfs, sein Mitarbeiten je Schritt, das Nicken des
           Kopfes — alles in Radiant. */
        lean: 0.16, sway: 0.045, nod: 0.05
      }
    },

    /* Spinning: sitzend auf dem Rad, Oberkoerper am Lenker fest, die Beine
       treten. Knie und Fuss laufen als orbit — der Tritt ist ein Kreis, da
       wuerde jede Gerade sofort auffallen. */
    bike: {
      name: 'Spinning-Rad', face: 1,
      equip: [
        { t: 'rect', x: 72, y: 112, w: 74, h: 6, rx: 3, c: '#2f3a4a' },
        { t: 'circle', cx: 140, cy: 96, r: 12, c: '#3d4756' },
        frameLine(110, 102, 136, 98, 3),
        frameLine(82, 80, 106, 104, 4),
        frameLine(86, 82, 104, 79, 4),
        frameLine(106, 104, 104, 80, 4),
        frameLine(104, 80, 103, 60, 4),
        frameLine(95, 60, 110, 58, 3),
        { t: 'circle', cx: 110, cy: 102, r: 5, c: '#69748a' },
        pad(69, 80, 24, 4),
        frameLine(78, 80, 72, 58, 6)
      ],
      implement: 'none',
      /* Sitzrad statt Rennhaltung: der Ruecken lehnt nach HINTEN an die
         Lehne, die Arme greifen nach vorn an den Lenker. Sattel weit hinten,
         damit sich das Bein am tiefsten Punkt fast durchstreckt. */
      hold: { hip: [84, 78], shoulder: [78, 55], head: [74, 44], elbow: [90, 62], hand: [102, 62] },
      a: { knee: [106, 78], foot: [117, 102] },
      b: { knee: [106, 76], foot: [103, 102] },
      orbit: { knee: 'hip', foot: 'knee' },
      /* Der Tritt laeuft rund, nicht hin und her — siehe crankPose(). */
      crank: { at: [110, 102], r: 7, rev: 1.1, thigh: 22, shin: 26 }
    },

    /* Yoga: stehend auf der Matte, die Arme wandern vom Brustbein nach oben.
       Nur die Arme bewegen sich — Ruhe ist hier der Punkt. */
    yoga: {
      name: 'Yoga-Matte', face: -1,
      equip: [{ t: 'rect', x: 68, y: 111, w: 66, h: 7, rx: 3, c: '#69748a' }],
      implement: 'none',
      hold: { hip: [100, 70], knee: [100, 92], foot: [100, FLOOR], shoulder: [100, 44], head: [99, 32] },
      a: { elbow: [87, 54], hand: [98, 60] },
      b: { elbow: [96, 29], hand: [97, 16] },
      orbit: { elbow: 'shoulder', hand: 'elbow' }
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
    'donkey-calf': 'donkeycalf',
    'laufband': 'treadmill',
    'spinning': 'bike',
    'yoga': 'yoga'
  };

  /* Wer im Hintergrund trainiert. */
  var AMBIENT = ['curl', 'treadmill', 'phone', 'latzug', 'bench', 'idle', 'squat', 'lateral'];

  /* toe ist optional: nur Szenen, in denen der Fuss um die Zehen kippt
     (Wadenheben), definieren es — fehlt es, zeichnet figure.js den Fuss
     starr in Blickrichtung. */
  var JOINTS = ['head', 'shoulder', 'elbow', 'hand', 'hip', 'knee', 'foot', 'toe'];

  /* Tretlager: der Fuß läuft eine gleichmäßige Kreisbahn um die Kurbel, das
     Knie wird dazu gerechnet (Zwei-Knochen-Umkehr aus Oberschenkel und
     Unterschenkel). Mit zwei Keyframes ginge nur die Sehne durch den Kreis —
     der Tritt sähe eckig aus und stünde an beiden Enden kurz still.
     Gedreht wird nach der Uhr (rev Umdrehungen je Sekunde), damit das Tempo
     gleichmäßig bleibt; ohne Uhr (Vorschau, Test) übernimmt t die Phase. */
  function crankPose(scene, out, t, time) {
    var c = scene.crank;
    var ang = (time === undefined || time === null ? t : time * c.rev) * Math.PI * 2;
    var hip = out.hip;
    if (!hip) return;

    /* Beide Pedale sitzen sich gegenüber: das zweite Bein läuft eine halbe
       Umdrehung versetzt. figure.js zeichnet farKnee/farFoot als hinteres,
       abgedunkeltes Bein. */
    var near = legAt(c, hip, ang);
    var far = legAt(c, hip, ang + Math.PI);
    out.foot = near.foot;
    out.knee = near.knee;
    out.farFoot = far.foot;
    out.farKnee = far.knee;
  }

  /* Fuß auf der Kreisbahn, Knie per Zwei-Knochen-Umkehr dazu. */
  function legAt(c, hip, ang) {
    var foot = [c.at[0] + Math.cos(ang) * c.r, c.at[1] + Math.sin(ang) * c.r];
    return { foot: foot, knee: kneeFor(hip, foot, c.thigh, c.shin) };
  }

  /* Zwei-Knochen-Umkehr: wo liegt das Knie, wenn Hüfte und Fuß feststehen?
     Abstand des Kniefußpunkts auf der Verbindung Hüfte–Fuß, dazu die Höhe
     senkrecht darauf. Das Knie zeigt nach vorn, also auf die Seite, die
     (uy, -ux) trifft — bei Blick nach rechts nach oben-vorn. */
  function kneeFor(hip, foot, thigh, shin) {
    var dx = foot[0] - hip[0], dy = foot[1] - hip[1];
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.01) return [hip[0], hip[1]];
    var reach = Math.min(Math.max(d, Math.abs(thigh - shin) + 0.01), thigh + shin - 0.01);
    var ux = dx / d, uy = dy / d;
    var along = (reach * reach + thigh * thigh - shin * shin) / (2 * reach);
    var high = Math.sqrt(Math.max(0, thigh * thigh - along * along));
    return [hip[0] + ux * along + uy * high, hip[1] + uy * along - ux * high];
  }

  /* --- Gehen ------------------------------------------------------------
     Zwei Keyframes reichen fürs Gehen nicht: dazwischen liegt eine Gerade,
     an beiden Enden steht die Bewegung, und beide Beine machen dasselbe —
     das sah aus wie Hüpfen auf der Stelle. Hier läuft stattdessen ein
     echter Schrittzyklus nach der Uhr:

       Standphase  Fuß liegt auf dem Band und wandert mit ihm nach hinten
       Schwungphase Fuß hebt ab, schwingt im Bogen nach vorn und setzt auf

     Das zweite Bein läuft einen halben Zyklus versetzt, die Arme schwingen
     gegengleich zum jeweiligen Bein, und der Körper wippt zweimal je
     Zyklus — einmal pro Schritt. */
  function footAt(g, phase) {
    var u = phase - Math.floor(phase);
    var stance = 1 - g.swing;
    if (u < stance) {
      var k = u / stance;                       /* mit dem Band nach hinten */
      return [g.front + (g.back - g.front) * k, g.ground];
    }
    var v = (u - stance) / g.swing;
    var e = v * v * (3 - 2 * v);                /* weich anlaufen und aufsetzen */
    return [g.back + (g.front - g.back) * e, g.ground - Math.sin(Math.PI * v) * g.lift];
  }

  /* Arm als zwei Glieder, die um die Schulter pendeln. ang > 0 = nach vorn. */
  function armAt(g, shoulder, ang) {
    var bend = 0.35 + Math.max(0, ang) * 0.6;   /* vorn stärker angewinkelt */
    var elbow = [shoulder[0] + Math.sin(ang) * g.arm, shoulder[1] + Math.cos(ang) * g.arm];
    return {
      elbow: elbow,
      hand: [elbow[0] + Math.sin(ang + bend) * g.fore, elbow[1] + Math.cos(ang + bend) * g.fore]
    };
  }

  /* Vektor um einen Winkel drehen (Bildkoordinaten, y zeigt nach unten):
     ein positiver Winkel kippt die Spitze nach vorn, also nach +x. */
  function turn(vec, ang) {
    var c = Math.cos(ang), s = Math.sin(ang);
    return [vec[0] * c - vec[1] * s, vec[0] * s + vec[1] * c];
  }

  function gaitPose(scene, out, t, time) {
    var g = scene.gait;
    var phase = (time === undefined || time === null ? t : time * g.rev);
    var u = phase - Math.floor(phase);

    /* Wippen: bei jedem Aufsetzen sackt der Körper leicht ein. */
    var drop = Math.abs(Math.sin(u * Math.PI * 2)) * g.bob;
    ['hip', 'shoulder', 'head'].forEach(function (j) {
      if (out[j]) out[j] = [out[j][0], out[j][1] + drop];
    });

    var hip = out.hip;

    /* Der Oberkörper steht nicht senkrecht wie ein Brett: er neigt sich
       nach vorn und arbeitet bei jedem Schritt ein wenig mit. Rumpf und
       Kopf werden dafür als starre Glieder um die Hüfte gedreht — die
       Längen bleiben, nur die Richtung ändert sich. Der Kopf nickt eine
       Spur versetzt hinterher, sonst wirkt alles wie aus einem Stück. */
    if (out.shoulder && (g.lean || g.sway)) {
      var lean = (g.lean || 0) + (g.sway || 0) * Math.sin(u * Math.PI * 4);
      var neck = out.head
        ? [out.head[0] - out.shoulder[0], out.head[1] - out.shoulder[1]]
        : null;
      var trunk = turn([out.shoulder[0] - hip[0], out.shoulder[1] - hip[1]], lean);
      out.shoulder = [hip[0] + trunk[0], hip[1] + trunk[1]];
      if (neck) {
        var nod = lean + (g.nod || 0) * Math.sin((u - 0.12) * Math.PI * 4);
        var turned = turn(neck, nod);
        out.head = [out.shoulder[0] + turned[0], out.shoulder[1] + turned[1]];
      }
    }
    var near = footAt(g, phase);
    var far = footAt(g, phase + 0.5);
    out.foot = near;
    out.knee = kneeFor(hip, near, g.thigh, g.shin);
    out.farFoot = far;
    out.farKnee = kneeFor(hip, far, g.thigh, g.shin);

    /* Fußspitze: sie zeigt beim Abheben nach unten und richtet sich zum
       Aufsetzen wieder auf — ein starrer Klotz am Bein sieht steif aus. */
    out.toe = [near[0] + 5, near[1] + Math.min(3, (g.ground - near[1]) * 0.35)];

    /* Arme gegengleich: das vordere Bein gehört zum hinteren Arm. */
    var swing = Math.sin(phase * Math.PI * 2) * 0.55;
    var nearArm = armAt(g, out.shoulder, -swing);
    var farArm = armAt(g, out.shoulder, swing);
    out.elbow = nearArm.elbow;
    out.hand = nearArm.hand;
    out.farElbow = farArm.elbow;
    out.farHand = farArm.hand;
  }

  /* Vollständige Pose für einen Zeitpunkt t (0 = gestreckt, 1 = tiefster Punkt).
     time (Sekunden) ist optional und treibt gleichmäßig laufende Teile. */
  function poseAt(scene, t, time) {
    /* Zeitgefühl statt Metronom. Smootherstep ZWEIFACH hintereinander:
       an beiden Umkehrpunkten steht die Bewegung je rund ein Fünftel der
       Zeit fast still, dazwischen zieht sie entschlossen durch — einfach
       angewendet wirkte die Ausführung noch zu linear. Der Exponent davor
       verschiebt das Verweilen zur schweren Endlage b. Das Marker-Timing
       des Spiels bleibt unberührt, geformt wird nur die Pose. */
    var u = Math.pow(t, 0.85);
    var s = u * u * u * (u * (u * 6 - 15) + 10);
    var e = s * s * s * (s * (s * 6 - 15) + 10);
    var out = {};
    for (var i = 0; i < JOINTS.length; i++) {
      var j = JOINTS[i];
      var a = scene.a[j] || (scene.hold && scene.hold[j]);
      var b = scene.b[j] || (scene.hold && scene.hold[j]) || a;
      if (!a) {
        if (j !== 'toe') out[j] = [100, 80];
        continue;
      }
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
    if (scene.crank) crankPose(scene, out, t, time);
    if (scene.gait) gaitPose(scene, out, t, time);
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
