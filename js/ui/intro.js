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
  var fig = MF.ui.figure;
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

  /* ---------- Figuren ------------------------------------------------------ */

  /* Gehende Figur aus Gelenkpunkten. phase treibt den Schritt, crouch 1 sitzt
     noch im Wagen, scale schrumpft sie beim Hineingehen. */
  function walker(x, gy, phase, scale, crouch) {
    var s = Math.sin(phase);
    var bob = Math.abs(Math.cos(phase)) * 1.2 * (1 - crouch);
    /* Der Kopf muss deutlich über der Schulter sitzen: der Rumpf ist eine
       Kapsel und ragt um seine halbe Stärke über den Schulterpunkt hinaus —
       zu eng gesetzt verschwindet der Kopf darin. */
    var hipY = gy - (31 - 13 * crouch) * scale - bob;
    var shY = gy - (50 - 14 * crouch) * scale - bob;
    var headY = gy - (64 - 16 * crouch) * scale - bob;
    var kneeY = gy - (15 - 2 * crouch) * scale;
    var stride = 13 * scale * (1 - crouch);

    function leg(dir) {
      var lift = Math.max(0, dir * s) * (1 - crouch);
      return {
        knee: [x + dir * s * 5 * scale + (2 + 9 * crouch) * scale, kneeY - lift * 3 * scale],
        foot: [x + dir * s * stride + 11 * crouch * scale, gy - lift * 4 * scale]
      };
    }
    var near = leg(1), far = leg(-1);

    return {
      head: [x + 1 * scale, headY],
      shoulder: [x, shY],
      hip: [x, hipY],
      knee: near.knee, foot: near.foot,
      farKnee: far.knee, farFoot: far.foot,
      /* Die nahe Hand trägt die Tasche und schwingt kaum. */
      elbow: [x - s * 3 * scale, shY + 12 * scale],
      hand: [x - s * 2 * scale, shY + 24 * scale],
      farElbow: [x + s * 4 * scale, shY + 12 * scale],
      farHand: [x + s * 6 * scale, shY + 24 * scale]
    };
  }

  function scaleTh(th, k) {
    var out = {};
    for (var key in th) {
      if (Object.prototype.hasOwnProperty.call(th, key)) out[key] = th[key] * k;
    }
    return out;
  }

  /* Klamotten aus der Spieleranlage — im Film sieht man, was man gewählt hat. */
  function heroLook() {
    var s = MF.game.state.get();
    var o = MF.data.outfits.look(s && s.player ? s.player.outfit : 'blau');
    o.hair = C.shadow;
    o.face = 1;
    return o;
  }

  /* Untergrenze für die Statur: der Spieler ist auch am ersten Tag schon
     durchtrainiert. Wer weiter wächst, steigt entsprechend breiter aus —
     deshalb wird gegen den Spielstand gemessen, nicht ersetzt. */
  var ATHLETIC = {
    arm: 8.6, fore: 5.6, torso: 22, shoulder: 8.2, thigh: 13.5, calf: 8.4, head: 7
  };

  function heroThickness() {
    var th = fig.thicknessFromState();
    var out = {};
    for (var key in ATHLETIC) {
      if (!Object.prototype.hasOwnProperty.call(ATHLETIC, key)) continue;
      out[key] = th[key] > ATHLETIC[key] ? th[key] : ATHLETIC[key];
    }
    return out;
  }

  function bag(ctx, hand, color, k) {
    var w = 16 * k, h = 10 * k;
    var y = hand[1] + 5 * k;
    px.capsule(ctx, [hand[0], hand[1]], [hand[0], y], 2 * k, C.ink);
    px.rect(ctx, hand[0] - w / 2 - 1, y - 1, w + 2, h + 2, C.ink);
    px.rect(ctx, hand[0] - w / 2, y, w, h, color);
    px.rect(ctx, hand[0] - w / 2, y, w, 2 * k, C.steelLit);
  }

  function person(ctx, pose, look, th, bagColor, k) {
    fig.draw(ctx, pose, th, look);
    if (bagColor) bag(ctx, pose.hand, bagColor, k);
  }

  /* Wo steht er zum Zeitpunkt t? Gibt null, solange er noch im Auto sitzt.

     Wichtig ist die Tiefe: er steigt zum Betrachter hin aus und läuft auf
     einer näheren Bodenlinie als der Wagen (NEAR statt GROUND). Ohne das
     stünde er scheinbar auf dem Auto statt davor. Am Eingang geht er wieder
     nach hinten — Bodenlinie und Größe wandern zurück Richtung Gebäude. */
  var NEAR = 165;

  function stage(t, from, to) {
    if (t < T_OPEN) return null;

    if (t < T_OUT) {                       /* Aussteigen */
      var u = seg(t, T_OPEN, T_OUT);
      return {
        x: lerp(CAR_X - 4, from, u),
        gy: lerp(GROUND + 3, NEAR, u),
        crouch: 1 - u, scale: 1, alpha: 1, walk: false
      };
    }

    var v = seg(t, T_OUT, T_GONE);
    var late = seg(t, T_ARRIVE - 0.6, T_GONE);   /* letzte Schritte hinein */
    return {
      x: lerp(from, to, v),
      gy: lerp(NEAR, GROUND - 2, late),
      crouch: 0,
      scale: lerp(1, 0.82, late),
      alpha: 1 - seg(t, T_ARRIVE + 0.1, T_GONE),
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

    var st = stage(t, 96, 250);
    if (!st) return;

    /* Schrittfrequenz aus dem zurückgelegten Weg — so rutschen die Füße
       nicht über den Boden. */
    var phase = st.walk ? (st.x - st.from) / 26 * Math.PI : 0;
    var pose = walker(st.x, st.gy, phase, st.scale, st.crouch);

    if (st.alpha < 1) ctx.globalAlpha = st.alpha;
    person(ctx, pose, heroLook(), scaleTh(heroThickness(), st.scale), C.green, st.scale);
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
