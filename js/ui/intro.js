/* Vorspann, ca. 5 Sekunden, bei jedem Start.

   Ablauf: Sportwagen fährt vor dem Studio vor, der Spieler steigt aus, nimmt
   seine Sporttasche und geht durch den Eingang.

   Gezeichnet wird auf denselben Pixel-Canvas wie die Übungsszenen (320 x 180,
   per CSS hochskaliert), damit der Stil zusammenpasst. Die Figur des Spielers
   nimmt ihre Strichstärken aus dem Spielstand — wer schon trainiert hat,
   steigt sichtbar breiter aus dem Auto.

   Antippen bricht ab; wer das Spiel oft neu lädt, wartet nicht jedes Mal. */
(function (MF) {
  'use strict';

  var px = MF.ui.pixel;
  var C = px.colors;
  var util = MF.core.util;
  var el = util.el;

  var W = 320, H = 180, GROUND = 152;
  var STEP = 1 / 24;          /* 24 Bilder/s — Kino reicht, spart Akku */

  var CAR_X = 118;            /* dort hält der Wagen */
  var DOOR_L = 232, DOOR_R = 296;   /* Eingang des Studios */

  /* Zeitplan in Sekunden. */
  var T_STOP = 1.35;   /* Wagen steht                     */
  var T_OPEN = 1.85;   /* Türen sind auf                  */
  var T_OUT = 2.40;    /* beide stehen neben dem Wagen    */
  var T_ARRIVE = 4.20; /* am Eingang                      */
  var T_GONE = 4.70;   /* im Studio verschwunden          */
  var DURATION = 5.00;

  function clamp01(t) { return t < 0 ? 0 : (t > 1 ? 1 : t); }
  function seg(t, a, b) { return clamp01((t - a) / (b - a)); }
  function outCubic(t) { var u = 1 - t; return 1 - u * u * u; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---------- Kulisse ------------------------------------------------------ */

  /* Der Himmel muss deutlich dunkler bleiben als die Fassade, sonst
     verschwimmt das Gebäude mit dem Hintergrund. */
  function street(ctx) {
    px.rect(ctx, 0, 0, W, GROUND, C.ink);
    px.dither(ctx, 0, 0, W, 70, C.wallDark, 4);          /* Nachthimmel */
    for (var i = 0; i < 9; i++) {
      px.rect(ctx, 13 + i * 17, 8 + (i * 11) % 26, 1, 1, C.white);
    }

    px.rect(ctx, 0, GROUND, W, H - GROUND, C.shadow);    /* Asphalt */
    px.rect(ctx, 0, GROUND, W, 2, C.ink);
    px.dither(ctx, 0, GROUND + 2, W, H - GROUND - 2, C.wallDark, 3);
    for (var x = 8; x < W; x += 36) px.rect(ctx, x, 172, 16, 2, C.steel);
  }

  function lamp(ctx) {
    px.rect(ctx, 42, 50, 4, GROUND - 50, C.ink);
    px.rect(ctx, 43, 50, 2, GROUND - 50, C.steelDark);
    px.capsule(ctx, [44, 50], [60, 44], 3, C.ink);
    px.disc(ctx, 62, 44, 5, C.ink);
    px.disc(ctx, 62, 44, 3.5, C.gold);
    px.dither(ctx, 56, 48, 14, 8, C.gold, 3);            /* Lichtaustritt */
    px.dither(ctx, 48, GROUND + 1, 30, 10, C.floorDark, 3);  /* Lichtpfütze */
  }

  /* Fassade mit Leuchtschild. doorOpen 0..1 schiebt die Schiebetür auf. */
  function facade(ctx, doorOpen) {
    var x0 = 166;

    px.rect(ctx, x0, 18, W - x0, GROUND - 18, C.wall);
    px.dither(ctx, x0 + 2, 21, W - x0 - 2, GROUND - 21, C.wallLit, 4);
    px.rect(ctx, x0, 18, W - x0, 3, C.ink);              /* Dachkante */
    px.rect(ctx, x0, 18, 2, GROUND - 18, C.ink);         /* Hauskante */

    /* Leuchtschild */
    px.rect(ctx, 180, 26, 126, 26, C.ink);
    px.rect(ctx, 182, 28, 122, 22, C.shirt);
    px.rect(ctx, 182, 28, 122, 2, C.shirtLit);
    if (ctx.fillText) {
      ctx.fillStyle = C.gold;
      ctx.font = 'bold 15px Verdana, Geneva, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MacFit', 243, 40);
    }

    /* Fenster — drinnen brennt Licht */
    for (var i = 0; i < 3; i++) {
      var wx = 178 + i * 44;
      px.rect(ctx, wx, 60, 28, 20, C.ink);
      px.rect(ctx, wx + 1, 61, 26, 18, C.steelDark);
      px.dither(ctx, wx + 1, 61, 26, 18, C.gold, 3);
    }

    /* Eingang: dunkler Innenraum, davor zwei Türflügel */
    px.rect(ctx, DOOR_L, 86, DOOR_R - DOOR_L, GROUND - 86, C.ink);
    px.rect(ctx, DOOR_L + 2, 88, DOOR_R - DOOR_L - 4, GROUND - 88, C.shadow);
    px.dither(ctx, DOOR_L + 2, 88, DOOR_R - DOOR_L - 4, GROUND - 88, C.gold, 5);

    /* Beim Öffnen laufen die Flügel seitlich in die Zarge — sie werden also
       nur schmaler, statt über die Wand zu wandern. */
    var mid = (DOOR_L + DOOR_R) / 2;
    var leafW = Math.max(0, 30 - Math.round(doorOpen * 28));
    leaf(ctx, mid - leafW, leafW);
    leaf(ctx, mid, leafW);

    /* Zarge zuletzt, damit die Flügel eingelassen wirken */
    px.rect(ctx, DOOR_L, 86, 3, GROUND - 86, C.steelDark);
    px.rect(ctx, DOOR_R - 3, 86, 3, GROUND - 86, C.steelDark);
    px.rect(ctx, DOOR_L, 86, DOOR_R - DOOR_L, 3, C.steelDark);

    /* Stufe */
    px.rect(ctx, DOOR_L - 8, 148, DOOR_R - DOOR_L + 16, 4, C.floorLit);
    px.rect(ctx, DOOR_L - 8, 148, DOOR_R - DOOR_L + 16, 1, C.ink);
  }

  /* Glas bleibt dunkel — eine helle Platte würde die halbe Fassade erschlagen.
     Erkennbar wird die Tür über Rahmen, Griffleiste und die Spiegelung. */
  function leaf(ctx, x, w) {
    if (w <= 0) return;
    px.rect(ctx, x, 88, w, GROUND - 88, C.wallDark);
    px.dither(ctx, x, 88, w, GROUND - 88, C.steelDark, 3);
    px.rect(ctx, x, 88, w, 2, C.steel);
    px.rect(ctx, x, 118, w, 2, C.steelLit);              /* Griffleiste */
    px.capsule(ctx, [x + 3, 138], [x + w - 3, 106], 1.5, C.steelDark);  /* Spiegelung */
  }

  /* ---------- Sportwagen --------------------------------------------------- */

  function car(ctx, cx, doorOpen, bounce) {
    var gy = GROUND + (bounce || 0);

    px.rect(ctx, cx - 52, gy - 2, 104, 3, C.ink);         /* Schatten */

    for (var i = 0; i < 2; i++) {                         /* Räder */
      var wx = cx + (i ? 28 : -30);
      px.disc(ctx, wx, gy - 8, 8.5, C.ink);
      px.disc(ctx, wx, gy - 8, 5.5, C.steelDark);
      px.disc(ctx, wx - 1, gy - 9, 2.5, C.steelLit);
    }

    /* Die Keilform entsteht aus gestaffelten Kästen, die nach vorn flacher
       werden. Erst alle Umrisse, dann alle Flächen — sonst schneiden sich die
       Konturen gegenseitig ins Blech. */
    var boxes = [
      [cx - 26, gy - 35, 36, 12],   /* Dach, weit hinten = Sportwagen */
      [cx - 50, gy - 26, 44, 19],   /* Heck */
      [cx - 10, gy - 24, 34, 17],   /* Mitte */
      [cx + 20, gy - 21, 22, 14],   /* Schnauze */
      [cx + 40, gy - 18, 12, 11]    /* Spitze */
    ];
    var b;
    for (i = 0; i < boxes.length; i++) {
      b = boxes[i];
      px.rect(ctx, b[0] - 1, b[1] - 1, b[2] + 2, b[3] + 2, C.ink);
    }
    for (i = 0; i < boxes.length; i++) {
      b = boxes[i];
      px.rect(ctx, b[0], b[1], b[2], b[3], C.shirt);
    }

    px.rect(ctx, cx - 23, gy - 33, 14, 8, C.steel);       /* Seitenfenster */
    px.rect(ctx, cx - 7, gy - 33, 15, 8, C.steel);        /* Windschutz */
    px.capsule(ctx, [cx - 5, gy - 26], [cx + 6, gy - 32], 1.5, C.steelLit);
    px.rect(ctx, cx - 50, gy - 13, 94, 2, C.shirtLit);    /* Zierstreifen */
    px.rect(ctx, cx + 45, gy - 16, 7, 4, C.gold);         /* Scheinwerfer */
    px.rect(ctx, cx - 50, gy - 23, 4, 4, C.orange);       /* Rücklicht */
    px.rect(ctx, cx - 55, gy - 31, 13, 4, C.ink);         /* Heckflügel */
    px.rect(ctx, cx - 54, gy - 30, 11, 2, C.shadow);

    if (doorOpen <= 0.01) {
      px.line(ctx, cx - 6, gy - 25, cx - 6, gy - 8, 1, C.ink);   /* Türfuge */
      return;
    }

    /* Offene Tür: dunkler Einstieg plus ein Blatt, das zum Betrachter
       aufschwingt — nach unten-links, das liest sich im Seitenriss richtig. */
    px.rect(ctx, cx - 20, gy - 23, 26, 15, C.ink);
    var hinge = [cx + 6, gy - 22];
    var tip = [cx + 6 - 17 * doorOpen, gy - 19 + 11 * doorOpen];
    px.capsule(ctx, hinge, tip, 15, C.ink);
    px.capsule(ctx, hinge, tip, 12, C.shirt);
    px.capsule(ctx, hinge, tip, 3, C.shirtLit);
  }

  /* ---------- Figur in Rückansicht ----------------------------------------- */

  /* Der Seitenriss aus figure.js kann keine Schulterbreite zeigen — im Profil
     ist Breite schlicht unsichtbar. Der Vorspann bekommt deshalb ein eigenes
     Rig von hinten: er geht schräg vom Betrachter weg zum Eingang, und man
     sieht die V-Form von Schultern zu Taille.

     Alle Maße sind halbe Breiten in Bildpunkten, aus den Muskelwerten des
     Spielstands abgeleitet. Die Untergrenzen sorgen dafür, dass er auch am
     ersten Tag durchtrainiert aussieht; wer weiter wächst, wird breiter. */
  function metrics(scale) {
    var m = MF.game.state.get().muscles;
    function f(id) { return util.clamp(m[id].size / 100, 0, 1); }
    function w(base, span, id, floor) {
      var v = base + f(id) * span;
      return (v < floor ? floor : v) * scale;
    }
    return {
      shoulder: w(10, 9, 'schultern', 14),   /* halbe Schulterbreite */
      lat: w(9, 8, 'ruecken', 12.5),         /* halbe Breite unter den Achseln */
      waist: w(6, 3.5, 'bauch', 8),
      delt: w(4, 4.5, 'schultern', 6),
      arm: w(4, 5, 'bizeps', 6.5),
      fore: w(3.4, 3, 'trizeps', 5),
      thigh: w(7, 6, 'beine', 10),
      calf: w(5, 4, 'waden', 7),
      hip: 6.5 * scale,
      head: 7 * scale
    };
  }

  /* Halbe Rumpfbreite auf der Höhe u (0 = Schulter, 1 = Taille). */
  function torsoW(th, u) {
    if (u < 0.28) return lerp(th.shoulder, th.lat, u / 0.28);
    return lerp(th.lat, th.waist, (u - 0.28) / 0.72);
  }

  /* Rumpf als Stapel waagerechter Kapseln — nur so lässt sich mit den
     vorhandenen Grundformen eine sich verjüngende Fläche zeichnen. */
  function torso(ctx, x, y0, y1, th, color, extra) {
    var N = 11, h = (y1 - y0) / N, i, u, w, y;
    for (i = 0; i < N; i++) {
      u = i / (N - 1);
      w = torsoW(th, u) + (extra || 0);
      y = y0 + i * h;
      px.capsule(ctx, [x - w, y], [x + w, y], h + 1.8 + (extra || 0) * 2, color);
    }
  }

  /* Gelenke der Rückansicht. crouch 1 = noch tief im Wagen. */
  function backPose(x, gy, phase, scale, crouch) {
    var s = Math.sin(phase) * (1 - crouch);
    var bob = Math.abs(Math.cos(phase)) * 1.4 * scale * (1 - crouch);
    return {
      x: x,
      swing: s,
      footY: gy,
      kneeY: gy - (15 - 2 * crouch) * scale,
      hipY: gy - (31 - 13 * crouch) * scale - bob,
      shY: gy - (50 - 14 * crouch) * scale - bob,
      headY: gy - (64 - 16 * crouch) * scale - bob,
      crouch: crouch,
      scale: scale
    };
  }

  function drawBack(ctx, p, th, look, bagColor) {
    var x = p.x, k = p.scale, s = p.swing;
    var skin = look.skin || C.skin;
    var skinDark = look.skinDark || C.skinDark;
    var skinLit = look.skinLit || C.skinLit;

    /* Beine: eines hebt ab, das andere trägt. Das angehobene liegt hinten. */
    var legs = [
      { side: -1, lift: Math.max(0, s) },
      { side: 1, lift: Math.max(0, -s) }
    ];
    if (legs[0].lift < legs[1].lift) legs.reverse();

    function legPts(L) {
      var out = L.side * (1 + L.lift * 1.5) * k;
      return {
        hip: [x + L.side * th.hip, p.hipY],
        knee: [x + L.side * th.hip + out, p.kneeY - L.lift * 4 * k],
        foot: [x + L.side * th.hip + out * 1.4, p.footY - L.lift * 9 * k]
      };
    }

    var i, L, pts;

    /* 1. Kontur */
    for (i = 0; i < legs.length; i++) {
      pts = legPts(legs[i]);
      px.capsule(ctx, pts.hip, pts.knee, th.thigh + 2, C.ink);
      px.capsule(ctx, pts.knee, pts.foot, th.calf + 2, C.ink);
      px.rect(ctx, pts.foot[0] - th.calf * 0.7, pts.foot[1] - 1, th.calf * 1.4, 4 * k + 2, C.ink);
    }
    torso(ctx, x, p.shY - 2 * k, p.hipY + 2 * k, th, C.ink, 1.3);
    px.disc(ctx, x - th.shoulder * 0.9, p.shY + 1 * k, th.delt + 1.5, C.ink);
    px.disc(ctx, x + th.shoulder * 0.9, p.shY + 1 * k, th.delt + 1.5, C.ink);
    px.disc(ctx, x, p.headY, th.head + 1.5, C.ink);

    /* 2. Flächen */
    for (i = 0; i < legs.length; i++) {
      L = legs[i];
      pts = legPts(L);
      var tone = L.lift > 0.05 ? skinDark : skin;
      px.capsule(ctx, pts.hip, pts.knee, th.thigh, tone);
      px.capsule(ctx, pts.knee, pts.foot, th.calf, tone);
      px.rect(ctx, pts.foot[0] - th.calf * 0.7, pts.foot[1] - 1, th.calf * 1.4, 4 * k, look.shoe || C.shadow);
    }

    /* Hals, dann Rumpf im Shirt — die Schultern bleiben frei, das Trägertop
       ist genau die Stelle, an der man die Breite sieht. */
    px.capsule(ctx, [x, p.headY + th.head * 0.6], [x, p.shY], 5 * k, skinDark);
    torso(ctx, x, p.shY - 2 * k, p.hipY + 2 * k, th, look.shirt);

    /* Shorts */
    var sw = th.waist * 1.18;
    px.rect(ctx, x - sw, p.hipY - 3 * k, sw * 2, 11 * k, look.shorts || C.shadow);
    px.rect(ctx, x - 0.7 * k, p.hipY - 3 * k, 1.4 * k, 11 * k, C.ink);

    /* Schultern und Arme */
    var arms = [
      { side: -1, dy: s * 2.5 * k },
      { side: 1, dy: -s * 2.5 * k }
    ];
    for (i = 0; i < arms.length; i++) {
      var a = arms[i];
      var sh = [x + a.side * th.shoulder * 0.9, p.shY + 1 * k];
      var elbow = [x + a.side * (th.shoulder + 1.5 * k), p.shY + 14 * k + a.dy];
      var hand = [x + a.side * (th.shoulder + 2.5 * k), p.shY + 26 * k + a.dy * 1.4];
      px.capsule(ctx, sh, elbow, th.arm + 2, C.ink);
      px.capsule(ctx, elbow, hand, th.fore + 2, C.ink);
      px.capsule(ctx, sh, elbow, th.arm, skin);
      px.capsule(ctx, elbow, hand, th.fore, skin);
      px.disc(ctx, sh[0], sh[1], th.delt, skin);
      px.disc(ctx, sh[0] - 1, sh[1] - 1.5, th.delt * 0.45, skinLit);
      if (a.side > 0 && bagColor) bag(ctx, hand, bagColor, k);
    }

    /* Hinterkopf: fast nur Haar, ein Streifen Nacken darunter. */
    px.disc(ctx, x, p.headY, th.head, skin);
    px.disc(ctx, x, p.headY - 1 * k, th.head * 0.95, look.hair || C.shadow);

    /* 3. Licht: Rückenmitte und Schulterkanten */
    px.capsule(ctx, [x, p.shY + 4 * k], [x, p.hipY - 3 * k], th.waist * 0.5, look.shirtLit);
    px.capsule(ctx, [x - th.lat * 0.75, p.shY + 5 * k], [x - th.waist * 0.6, p.hipY - 4 * k],
      2 * k, look.shirtLit);
    px.capsule(ctx, [x + th.lat * 0.75, p.shY + 5 * k], [x + th.waist * 0.6, p.hipY - 4 * k],
      2 * k, look.shirtLit);
  }

  /* Klamotten aus der Spieleranlage — im Film sieht man, was man gewählt hat. */
  function heroLook() {
    var s = MF.game.state.get();
    var o = MF.data.outfits.look(s && s.player ? s.player.outfit : 'blau');
    o.hair = C.shadow;
    return o;
  }

  function bag(ctx, hand, color, k) {
    var w = 15 * k, h = 10 * k;
    var y = hand[1] + 4 * k;
    px.capsule(ctx, [hand[0], hand[1]], [hand[0], y], 2 * k, C.ink);
    px.rect(ctx, hand[0] - w / 2 - 1, y - 1, w + 2, h + 2, C.ink);
    px.rect(ctx, hand[0] - w / 2, y, w, h, color);
    px.rect(ctx, hand[0] - w / 2, y, w, 2 * k, C.steelLit);
  }

  /* Wo steht er zum Zeitpunkt t? Gibt null, solange er noch im Auto sitzt.

     Er steigt nach vorn zum Betrachter aus (NEAR liegt deutlich tiefer als die
     Standlinie des Wagens) und geht dann schräg nach hinten zum Eingang:
     Bodenlinie steigt, Größe nimmt ab. Diese Diagonale ist der Grund für die
     Rückansicht — nur so sieht man, wie breit er gebaut ist. */
  var NEAR = 171;

  function stage(t, from, to) {
    if (t < T_OPEN) return null;

    if (t < T_OUT) {                       /* Aussteigen */
      var u = seg(t, T_OPEN, T_OUT);
      return {
        x: lerp(CAR_X - 6, from, u),
        gy: lerp(GROUND + 2, NEAR, u),
        crouch: 1 - u, scale: 1.06, alpha: 1, walk: false
      };
    }

    /* Die Tiefe läuft über den ganzen Weg mit, nicht erst am Ende — sonst
       wäre es kein schräger Weg, sondern ein Knick kurz vor der Tür. */
    var v = seg(t, T_OUT, T_GONE);
    var d = v * v * 0.35 + v * 0.65;       /* hinten wird der Weg kürzer */
    return {
      x: lerp(from, to, v),
      gy: lerp(NEAR, GROUND - 3, d),
      crouch: 0,
      scale: lerp(1.06, 0.68, d),
      alpha: 1 - seg(t, T_ARRIVE + 0.15, T_GONE),
      walk: true,
      from: from
    };
  }

  /* ---------- Ein Bild ----------------------------------------------------- */

  function frame(ctx, t) {
    var carX = lerp(-80, CAR_X, outCubic(seg(t, 0, T_STOP)));
    var bounce = 0;
    if (t > T_STOP - 0.1 && t < T_STOP + 0.35) {
      bounce = Math.sin((t - T_STOP + 0.1) / 0.45 * Math.PI * 2) * 1.6;
    }
    /* Türen auf, und wieder zu, sobald beide draußen sind. */
    var carDoor = seg(t, T_STOP, T_OPEN) - seg(t, T_OUT + 0.2, T_OUT + 0.6);
    var gymDoor = seg(t, T_ARRIVE - 0.35, T_ARRIVE + 0.15);

    street(ctx);
    lamp(ctx);
    facade(ctx, gymDoor);
    car(ctx, carX, Math.max(0, carDoor), bounce);

    var st = stage(t, 100, 258);
    if (!st) return;

    /* Schrittfrequenz aus dem zurückgelegten Weg — so rutschen die Füße
       nicht über den Boden. */
    var phase = st.walk ? (st.x - st.from) / 21 * Math.PI : 0;
    var pose = backPose(st.x, st.gy, phase, st.scale, st.crouch);

    if (st.alpha < 1) ctx.globalAlpha = st.alpha;
    drawBack(ctx, pose, metrics(st.scale), heroLook(), C.green);
    ctx.globalAlpha = 1;
  }

  /* ---------- Ablauf ------------------------------------------------------- */

  var CAPTIONS = [
    { at: 0, text: 'Feierabend. Zeit fürs Studio.' },
    { at: T_OUT, text: 'Tasche geschnappt.' },
    { at: T_ARRIVE, text: 'Willkommen bei MacFit.' }
  ];

  function play(onDone) {
    var root = util.byId('intro-root');
    var done = onDone || function () {};
    if (!root) { done(); return function () {}; }

    var stageEl = el('div.cine__stage');
    var caption = el('p.cine__cap');
    var box = el('div.cine', null, [
      stageEl,
      caption,
      el('p.cine__skip', { text: 'Tippen zum Überspringen' })
    ]);
    root.appendChild(box);

    var surface = px.create(stageEl, W, H, 'pix--cine');
    if (!surface.ctx) {                    /* kein Canvas — dann eben ohne */
      root.removeChild(box);
      done();
      return function () {};
    }

    var t = 0, since = STEP, capIdx = -1, finished = false;

    function setCaption() {
      var idx = 0;
      for (var i = 0; i < CAPTIONS.length; i++) if (t >= CAPTIONS[i].at) idx = i;
      if (idx === capIdx) return;
      capIdx = idx;
      caption.textContent = CAPTIONS[idx].text;
      /* Klasse kurz wegnehmen, sonst startet die Einblendung nicht neu. */
      caption.className = 'cine__cap';
      void caption.offsetWidth;
      caption.className = 'cine__cap is-in';
    }

    var ticker = MF.core.ticker.create(function (dt) {
      t += dt;
      since += dt;
      if (t >= DURATION) { finish(); return; }
      if (since < STEP) return;
      since = 0;
      setCaption();
      surface.clear();
      frame(surface.ctx, t);
      surface.present();
    });

    function finish() {
      if (finished) return;
      finished = true;
      ticker.stop();
      box.className = 'cine is-out';
      window.setTimeout(function () {
        if (box.parentNode) box.parentNode.removeChild(box);
        done();
      }, 420);
    }

    setCaption();
    frame(surface.ctx, 0);
    surface.present();
    util.onTap(box, finish);
    ticker.start();

    return finish;
  }

  MF.ui.intro = {
    play: play,
    duration: DURATION,
    /* für die Sichtprüfung: ein einzelnes Bild in einen fremden Kontext */
    frame: frame,
    size: { w: W, h: H }
  };
})(window.MacFit);
