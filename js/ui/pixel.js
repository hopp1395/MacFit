/* Pixel-Grafik im Stil früher 90er-Beat-'em-ups (Franko).
   Gezeichnet wird auf einen kleinen Canvas mit echter niedriger Auflösung
   (200 x 130), der per CSS hochskaliert wird — dadurch echte grobe Pixel
   statt weichgezeichneter Vektoren.

   Nach dem Zeichnen läuft jedes Bild durch quantize(): alle Farben werden auf
   eine feste Palette gerastet. Das killt die Kantenglättung der Canvas-API und
   sorgt für die harten Pixelkanten, die den Stil ausmachen. */
(function (MF) {
  'use strict';

  var COLORS = {
    ink: '#141019',
    shadow: '#241f2e',
    wallDark: '#252a38',
    wall: '#39404f',
    wallLit: '#4c5567',
    steelDark: '#434b5c',
    steel: '#69748a',
    steelLit: '#98a2b4',
    floorDark: '#463c2f',
    floor: '#665741',
    floorLit: '#877152',
    /* Hautrampe, sieben Stufen. skinDark, skin und skinLit sind die alten
       Werte und unverändert — alles, was heute damit gezeichnet wird, bleibt
       wie es ist. */
    skinDeep: '#4a2c1c',
    skinShade: '#6b3f26',
    skinDark: '#9d6039',
    skinMid: '#b8764a',
    skin: '#cf8f5c',
    skinLit: '#eeb984',
    skinGlow: '#ffd9ae',
    /* Fahle Haut bei schlechter Gesundheit. Warm entsättigt, nicht neutralgrau:
       ein neutraler Ton kollidiert in nearest() mit der steel/wall-Rampe, und
       dann färben sich Umlenkrollen und Wandkacheln fleischfarben. */
    paleDeep: '#43343a',
    paleShade: '#6a5459',
    paleDark: '#927a7c',
    pale: '#b6a09d',
    paleLit: '#d5c3bc',
    shirt: '#b83a33',
    shirtLit: '#dd5f55',
    jeans: '#33507c',
    jeansLit: '#4a6ba0',
    green: '#4d8a44',
    gold: '#d4a63c',
    orange: '#e8761f',
    white: '#c9d3de'
  };

  /* Palette als RGB-Liste für die Quantisierung. */
  var PALETTE = [];
  (function () {
    for (var name in COLORS) {
      if (!Object.prototype.hasOwnProperty.call(COLORS, name)) continue;
      var hex = COLORS[name];
      PALETTE.push([
        parseInt(hex.substr(1, 2), 16),
        parseInt(hex.substr(3, 2), 16),
        parseInt(hex.substr(5, 2), 16)
      ]);
    }
  })();

  /* 15-Bit-Farbschlüssel -> Palettenindex. Einmal berechnet, dann nur noch
     nachgeschlagen; sonst wäre die Suche pro Pixel zu teuer. */
  var cache = null;

  function nearest(r, g, b) {
    var best = 0, bestD = 1e9;
    for (var i = 0; i < PALETTE.length; i++) {
      var p = PALETTE[i];
      var dr = r - p[0], dg = g - p[1], db = b - p[2];
      var d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function quantize(ctx, w, h) {
    if (!cache) {
      cache = new Int16Array(32768);
      for (var c = 0; c < cache.length; c++) cache[c] = -1;
    }
    var img;
    try {
      img = ctx.getImageData(0, 0, w, h);
    } catch (err) {
      return;   /* z. B. wenn der Canvas noch keine Größe hat */
    }
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
      var key = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
      var idx = cache[key];
      if (idx < 0) {
        idx = nearest(d[i], d[i + 1], d[i + 2]);
        cache[key] = idx;
      }
      var p = PALETTE[idx];
      d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  /* Canvas in niedriger Auflösung, per CSS auf volle Breite gezogen. */
  function create(container, w, h, cls) {
    container.innerHTML = '';
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.className = 'pix ' + (cls || '');
    container.appendChild(canvas);

    var ctx = null;
    try {
      ctx = canvas.getContext('2d', { willReadFrequently: true });
    } catch (err) {
      ctx = canvas.getContext('2d');
    }
    if (ctx) ctx.imageSmoothingEnabled = false;

    return {
      canvas: canvas,
      ctx: ctx,
      w: w,
      h: h,
      clear: function (color) {
        if (!ctx) return;
        ctx.clearRect(0, 0, w, h);
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, w, h);
        }
      },
      present: function () {
        if (ctx) quantize(ctx, w, h);
      }
    };
  }

  /* ---------- Farbrampen -------------------------------------------------- */

  /* Schattiert wird über Stufen, nicht über Farbmischung.

     Vorher mischte jede Zeichenroutine ihre Zwischentöne selbst
     (mix(skin, ink, 0.42) und ähnlich). Das Ergebnis war aber keine
     Palettenfarbe, und quantize() schob es anschließend irgendwohin — die
     Latissimuskanten landeten auf 'floor', die Rückenrinne auf 'floorDark',
     also auf der Farbe des Hallenbodens. Nachgemessen mit derselben
     nearest()-Formel, die hier unten läuft.

     Über einen Rampenindex ist jede gezeichnete Farbe schon ein
     Paletteneintrag; quantize() ist für die Figur dann ein Nulldurchgang. */
  var RAMPS = {
    skin: ['skinDeep', 'skinShade', 'skinDark', 'skinMid', 'skin', 'skinLit', 'skinGlow'],
    pale: ['paleDeep', 'paleShade', 'paleDark', 'pale', 'paleLit']
  };

  /* Liefert eine Funktion, die einen Versatz zur Grundstufe in eine Farbe
     übersetzt: r(0) Grundton, r(-2) Kante, r(1) Licht. Über den Rand hinaus
     wird abgeschnitten, nicht umgebrochen. */
  function ramp(name, base) {
    var list = RAMPS[name] || RAMPS.skin;
    var b = base === undefined ? defaultBase(name) : base;
    return function (i) {
      return COLORS[list[MF.core.util.clamp(Math.round(b + i), 0, list.length - 1)]];
    };
  }

  function defaultBase(name) {
    return name === 'pale' ? 3 : 4;   /* Index von 'pale' bzw. 'skin' */
  }

  /* ---------- Zeichen-Grundformen ---------------------------------------- */

  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /* Gliedmaße: dicke Linie mit runden Enden. */
  function capsule(ctx, from, to, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.stroke();
  }

  function disc(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function line(ctx, x1, y1, x2, y2, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  /* Geschlossene Fläche aus Eckpunkten, wahlweise mit Kontur.

     Die vierte Grundform, und die einzige, die eine **konkave** Kante erzeugen
     kann: capsule, disc und rect sind alle konvex, ihre Vereinigung also auch.
     Anatomie braucht aber Einbuchtungen — die Achselhöhle unter dem Deltamuskel,
     die Kerbe über der Hüfte, den Spalt zwischen den Schenkeln.

     Kontur und Fläche liegen auf demselben Pfad: erst breit stroken, dann
     füllen. Ein aufgeblasenes zweites Polygon wäre aufwendig zu rechnen und
     an spitzen Ecken fehleranfällig. */
  function poly(ctx, pts, color, ink, width) {
    if (!pts || pts.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();

    if (ink) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = width || 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.fill();
  }

  /* Handgezeichnetes Raster, ein Zeichen je Pixel.

     Für die Teile, die als einzige **nicht** mit den Muskelwerten wachsen:
     Gesicht, Faust, Fuß. Die waren als Grundformen gezeichnet — zwei 2 x 2
     Klötzchen als Augen, eine Scheibe als Hand — und sahen entsprechend aus.
     Bei dieser Größe lohnt es sich, jeden Pixel zu setzen.

     Die Werte in key sind entweder ein Palettenname oder ein Rampenversatz;
     dadurch gehen die Stempel den Hautton mit, auch den fahlen. */
  function stamp(ctx, sprite, x, y, r) {
    var rows = sprite.rows, key = sprite.key, py, px_, ch, v;
    for (py = 0; py < rows.length; py++) {
      for (px_ = 0; px_ < rows[py].length; px_++) {
        ch = rows[py].charAt(px_);
        v = key[ch];
        if (v === null || v === undefined) continue;
        ctx.fillStyle = typeof v === 'number' ? r(v) : (COLORS[v] || v);
        ctx.fillRect(Math.round(x) + px_, Math.round(y) + py, 1, 1);
      }
    }
  }

  /* Schachbrett-Raster — das klassische Mittel für Verläufe mit wenig Farben. */
  function dither(ctx, x, y, w, h, color, step) {
    step = step || 2;
    ctx.fillStyle = color;
    for (var py = Math.round(y); py < y + h; py++) {
      for (var px = Math.round(x); px < x + w; px++) {
        if ((px + py) % step === 0) ctx.fillRect(px, py, 1, 1);
      }
    }
  }

  MF.ui.pixel = {
    colors: COLORS,
    ramps: RAMPS,
    ramp: ramp,
    create: create,
    quantize: quantize,
    rect: rect,
    capsule: capsule,
    disc: disc,
    line: line,
    poly: poly,
    stamp: stamp,
    dither: dither
  };
})(window.MacFit);
