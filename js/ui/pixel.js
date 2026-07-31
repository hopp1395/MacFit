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
    skinDark: '#9d6039',
    skin: '#cf8f5c',
    skinLit: '#eeb984',
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
    create: create,
    quantize: quantize,
    rect: rect,
    capsule: capsule,
    disc: disc,
    line: line,
    dither: dither
  };
})(window.MacFit);
