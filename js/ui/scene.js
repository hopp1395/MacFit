/* Baut aus Kulisse, Gerät, Figur und Hintergrundleuten eine Gym-Szene auf dem
   Pixel-Canvas. Jedes Bild wird komplett neu gezeichnet — bei 220 x 128 Pixeln
   ist das billiger als jede Teilaktualisierung.

   Zwei Verwendungen:
     mountSession  große Szene während eines Satzes, animiert vom Marker
     mountAmbient  Band auf dem Gym-Bildschirm, läuft für sich */
(function (MF) {
  'use strict';

  var px = MF.ui.pixel;
  var fig = MF.ui.figure;
  var C = px.colors;
  var SC = MF.data.scenes;
  var FLOOR = SC.FLOOR;

  /* ---------- Kulisse ------------------------------------------------------ */

  function backdrop(ctx, w, h, horizon) {
    px.rect(ctx, 0, 0, w, horizon, C.wallDark);
    px.rect(ctx, 0, horizon, w, h - horizon, C.floorDark);

    /* Fliesenfugen an der Wand */
    for (var x = 0; x < w; x += 24) {
      px.line(ctx, x, 0, x, horizon, 1, C.wall);
    }
    px.line(ctx, 0, Math.round(horizon * 0.45), w, Math.round(horizon * 0.45), 1, C.wall);

    /* Bodenkante und ein bisschen Struktur */
    px.rect(ctx, 0, horizon, w, 2, C.ink);
    px.rect(ctx, 0, horizon + 2, w, 2, C.floor);
    px.dither(ctx, 0, horizon + 4, w, h - horizon - 4, C.floor, 3);

    /* Im flachen Band ist für Wandinventar kein Platz. */
    if (horizon < 50) return;

    /* Spiegel */
    var mw = Math.round(w * 0.30);
    px.rect(ctx, 8, horizon - 46, mw, 40, C.ink);
    px.rect(ctx, 9, horizon - 45, mw - 2, 38, C.wallLit);
    px.dither(ctx, 9, horizon - 45, mw - 2, 38, C.wall, 2);

    /* Hantelständer */
    var rx = Math.round(w * 0.68);
    var rw = Math.round(w * 0.26);
    px.rect(ctx, rx, horizon - 20, rw, 3, C.ink);
    px.rect(ctx, rx, horizon - 10, rw, 3, C.ink);
    for (var i = 0; i < 5; i++) {
      var dx = rx + 5 + i * (rw - 10) / 4;
      px.disc(ctx, dx, horizon - 24, 3.5, C.ink);
      px.disc(ctx, dx, horizon - 24, 2.5, C.steelDark);
      px.disc(ctx, dx, horizon - 14, 3.5, C.ink);
      px.disc(ctx, dx, horizon - 14, 2.5, C.steel);
    }

    /* Ein Plakat an der Wand — kleiner Gruß an die 90er. */
    px.rect(ctx, Math.round(w * 0.46), 8, 20, 26, C.ink);
    px.rect(ctx, Math.round(w * 0.46) + 1, 9, 18, 24, C.shirt);
    px.rect(ctx, Math.round(w * 0.46) + 4, 13, 12, 3, C.gold);
    px.dither(ctx, Math.round(w * 0.46) + 3, 19, 14, 11, C.ink, 2);
  }

  /* ---------- Gerät aus der Datenbeschreibung ------------------------------ */

  function drawEquip(ctx, items) {
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.t === 'rect') {
        px.rect(ctx, it.x - 1, it.y - 1, it.w + 2, it.h + 2, C.ink);
        px.rect(ctx, it.x, it.y, it.w, it.h, it.c);
        px.rect(ctx, it.x, it.y, it.w, 1, C.steelLit);
      } else if (it.t === 'line') {
        px.capsule(ctx, [it.x1, it.y1], [it.x2, it.y2], it.w + 2, C.ink);
        px.capsule(ctx, [it.x1, it.y1], [it.x2, it.y2], it.w, it.c);
      } else if (it.t === 'circle') {
        px.disc(ctx, it.cx, it.cy, it.r + 1, C.ink);
        px.disc(ctx, it.cx, it.cy, it.r, it.c);
      }
    }
  }

  /* Eine ganze Szene an eine Stelle im Bild zeichnen. Alle Szenen sind mit
     Boden auf FLOOR gezeichnet, hier wird auf die Zielposition umgerechnet. */
  function drawScene(ctx, scene, t, opts) {
    var scale = opts.scale === undefined ? 1 : opts.scale;
    var cx = opts.cx === undefined ? 100 : opts.cx;
    var floorY = opts.floorY === undefined ? FLOOR : opts.floorY;

    ctx.save();
    ctx.translate(cx - 100 * scale, floorY - FLOOR * scale);
    ctx.scale(scale, scale);
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;

    drawEquip(ctx, scene.equip);

    var pose = SC.poseAt(scene, t);

    /* Anstrengungszittern nahe der schweren Endlage: ein halber Pixel,
       deterministisch aus der Zeit (kein Zufall — Aufzeichnungen bleiben
       reproduzierbar), mit t*t auf die Endlage b gewichtet. Ist die Hand
       am Gerät fest (Stange, Holm), zittert stattdessen der Körper. */
    if (opts.time) {
      var tr = Math.sin(opts.time * 42) * 0.55 * t * t;
      if (tr) {
        if (scene.hold && scene.hold.hand) {
          pose.shoulder = [pose.shoulder[0] + tr, pose.shoulder[1]];
          pose.head = [pose.head[0] + tr, pose.head[1]];
          pose.hip = [pose.hip[0] + tr * 0.6, pose.hip[1]];
        } else {
          pose.hand = [pose.hand[0] + tr, pose.hand[1] + tr * 0.6];
          pose.elbow = [pose.elbow[0] + tr * 0.7, pose.elbow[1]];
        }
      }
    }

    if (scene.cable) {
      px.capsule(ctx, scene.cable, pose.hand, 3, C.ink);
      px.capsule(ctx, scene.cable, pose.hand, 1.5, C.steelLit);
    }

    var look = { face: scene.face === undefined ? 1 : scene.face, supine: !!scene.supine };
    if (opts.colors) {
      for (var key in opts.colors) {
        if (Object.prototype.hasOwnProperty.call(opts.colors, key)) look[key] = opts.colors[key];
      }
    }
    fig.draw(ctx, pose, opts.thickness || fig.thicknessFromState(), look);
    fig.drawImplement(ctx, scene.implement, pose);

    drawEquip(ctx, scene.front);

    ctx.restore();
    return pose;
  }

  /* ---------- Hintergrundleute -------------------------------------------- */

  var NPC_SHIRTS = [C.jeans, C.green, C.gold, C.steel, C.shirt];

  function pickExtras(excludeScene, layout) {
    var pool = SC.ambient.filter(function (id) { return SC.get(id) !== excludeScene; });
    var out = [];
    for (var i = 0; i < layout.length && pool.length; i++) {
      var id = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      out.push({
        scene: SC.get(id),
        cx: layout[i].cx,
        floorY: layout[i].floorY,
        scale: layout[i].scale,
        alpha: layout[i].alpha,
        thickness: fig.npcThickness(i + 3),
        colors: {
          shirt: NPC_SHIRTS[(i + Math.floor(Math.random() * 5)) % NPC_SHIRTS.length],
          shirtLit: C.steelLit,
          shorts: C.shadow,
          /* Hintergrundleute sitzen zwei Stufen tiefer auf derselben Rampe —
             sie sollen zurücktreten, ohne dass ihr Hautton aus der Reihe fällt.
             Vorher waren die drei Töne einzeln gesetzt, und der dunkelste war
             'shadow', also gar keine Hautfarbe. */
          ramp: px.ramp('skin', 2)
        },
        speed: 0.3 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2
      });
    }
    return out;
  }

  function drawExtras(ctx, extras, time) {
    for (var i = 0; i < extras.length; i++) {
      var e = extras[i];
      e.time = time;
      drawScene(ctx, e.scene, (Math.sin(time * e.speed * 2 + e.phase) + 1) / 2, e);
    }
  }

  /* ---------- Szene während eines Satzes ----------------------------------- */

  function mountSession(container, exerciseId) {
    var scene = SC.forExercise(exerciseId);
    var surface = px.create(container, 220, 128, 'pix--scene');
    var ctx = surface.ctx;
    var horizon = 84;

    var extras = pickExtras(scene, [
      { cx: 24, floorY: 82, scale: 0.38, alpha: 0.75 },
      { cx: 196, floorY: 80, scale: 0.34, alpha: 0.7 }
    ]);

    var time = 0;
    var since = 0;
    var STEP = 1 / 30;   /* 30 Bilder/s reichen — der Marker läuft weiter mit 60. */

    function render(phase) {
      if (!ctx) return;
      surface.clear();
      backdrop(ctx, 220, 128, horizon);
      drawExtras(ctx, extras, time);
      drawScene(ctx, scene, phase, {
        cx: 110, floorY: 122, scale: 0.94, time: time,
        colors: MF.data.outfits.look(MF.game.state.get().player.outfit)
      });
      surface.present();
    }

    render(0);

    return {
      name: scene.name,
      update: function (phase, dt) {
        time += dt || 0;
        since += dt || 0;
        if (since < STEP) return;
        since = 0;
        render(phase);
      },
      flash: function (kind) {
        surface.canvas.className = 'pix pix--scene is-' + kind;
        window.setTimeout(function () {
          surface.canvas.className = 'pix pix--scene';
        }, 240);
      }
    };
  }

  /* ---------- Band auf dem Gym-Bildschirm ---------------------------------- */

  var ambientTicker = null;

  function mountAmbient(container) {
    stopAmbient();
    /* Flaches, breites Band — es soll Atmosphäre liefern, nicht Platz fressen. */
    var W = 360, H = 62;
    var surface = px.create(container, W, H, 'pix--ambient');
    var ctx = surface.ctx;
    if (!ctx) return null;

    var horizon = 24;
    var extras = pickExtras(null, [
      { cx: 46, floorY: 60, scale: 0.42, alpha: 1 },
      { cx: 148, floorY: 57, scale: 0.36, alpha: 0.9 },
      { cx: 244, floorY: 54, scale: 0.31, alpha: 0.78 },
      { cx: 322, floorY: 51, scale: 0.26, alpha: 0.65 }
    ]);

    var time = 0;
    var since = 0;
    ambientTicker = MF.core.ticker.create(function (dt) {
      time += dt;
      since += dt;
      /* Kulisse — 15 Bilder/s sind reichlich und schonen den Akku. */
      if (since < 1 / 15) return;
      since = 0;
      surface.clear();
      backdrop(ctx, W, H, horizon);
      drawExtras(ctx, extras, time);
      surface.present();
    });
    ambientTicker.start();
    return surface.canvas;
  }

  function stopAmbient() {
    if (ambientTicker) {
      ambientTicker.stop();
      ambientTicker = null;
    }
  }

  /* Im Hintergrund muss nichts laufen. */
  document.addEventListener('visibilitychange', function () {
    if (!ambientTicker) return;
    if (document.visibilityState === 'hidden') ambientTicker.stop();
    else ambientTicker.start();
  });

  MF.ui.scene = {
    mountSession: mountSession,
    mountAmbient: mountAmbient,
    stopAmbient: stopAmbient,
    drawScene: drawScene,
    backdrop: backdrop
  };
})(window.MacFit);
