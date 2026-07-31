/* Titelmusik und Trainingsgeraeusche.

   Zwei getrennte Wege in denselben Ausgang: die Musik haengt an master und
   wird mit dem Vorspann ein- und ausgeblendet, die Effekte haengen an einem
   eigenen Bus und sind davon unabhaengig. Sonst waeren die Geraeusche im
   Training stumm, weil master nach dem Film heruntergeblendet ist.

   Eigene Komposition im Stil des Dream-Trance der Neunziger: Klavier-Arpeggio
   über einer Moll-Kadenz, Flächen-Pad darunter, ab dem zweiten Takt Kick,
   Offbeat-Bass und eine Leadmelodie. Alles wird zur Laufzeit per Web Audio
   erzeugt — keine Datei, kein Download, laeuft auch ueber file://.

   Wer lieber ein eigenes Stueck haette, legt es als assets/theme.mp3 ab; dann
   spielt das statt des Synthesizers. Die Datei wird beim Start geprueft, das
   Ergebnis kommt aber meist erst nach dem ersten Film an — der erste Vorspann
   laeuft deshalb noch mit dem Synthesizer.

   Autoplay: Browser lassen Ton erst nach einer Nutzergeste zu. Beim allerersten
   Laden bleibt der Vorspann daher stumm; die Musik startet dann beim naechsten
   Film. Das ist Browserrecht, nicht zu umgehen. */
(function (MF) {
  'use strict';

  var Ctor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  var supported = !!Ctor;

  var enabled = true;      /* Musik erlaubt                   */
  var sfxOn = true;        /* Geraeusche erlaubt              */
  var wanted = false;      /* soll gerade Musik laufen?       */
  var armed = false;       /* wartet auf die erste Nutzergeste */

  var ctx = null, master = null, sfxBus = null, noiseBuf = null;
  var timer = 0, next = 0, step = 0;

  var file = null, fileState = 'unknown';   /* unknown | ready | missing */
  var FILE = 'assets/theme.mp3';

  /* ---------- Takt und Tonvorrat ------------------------------------------- */

  var BPM = 138;
  var BEAT = 60 / BPM;
  var S16 = BEAT / 4;          /* eine Sechzehntel        */
  var BAR = 16;                /* Sechzehntel pro Takt    */
  var AHEAD = 0.25;            /* so weit im Voraus planen */
  var TICK = 25;               /* ms zwischen zwei Planungen */

  /* a-Moll – F – C – G. Die Standardkadenz des Genres; die Melodie darueber
     ist eigen. root ist der Basston, tones sind die Toene fuers Arpeggio. */
  var CHORDS = [
    { root: 45, tones: [57, 60, 64, 69] },
    { root: 41, tones: [53, 57, 60, 65] },
    { root: 48, tones: [60, 64, 67, 72] },
    { root: 43, tones: [55, 59, 62, 67] }
  ];

  /* Zeigt in tones; 4 bedeutet Grundton eine Oktave hoeher. */
  var ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 4, 3, 2, 1, 2];

  /* Leadmelodie je Takt: [Sechzehntel im Takt, Note, Laenge in Sechzehnteln] */
  var MELODY = [
    [[0, 76, 6], [6, 81, 4], [10, 79, 6]],
    [[0, 77, 4], [4, 76, 4], [8, 72, 8]],
    [[0, 79, 6], [6, 76, 4], [10, 74, 6]],
    [[0, 74, 4], [4, 71, 4], [8, 67, 8]]
  ];

  function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  /* ---------- Stimmen ------------------------------------------------------ */

  function gainTo(node, at, peak, attack, hold, release) {
    var g = node.gain;
    g.setValueAtTime(0.0001, at);
    g.exponentialRampToValueAtTime(peak, at + attack);
    g.setValueAtTime(peak, at + attack + hold);
    g.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
  }

  /* Klavier: Dreieck mit schneller Abklingkurve, darueber ein leiser Oberton.
     Kein echtes Klavier, aber im Pixelbild passt es zusammen. */
  function piano(at, midi, vol) {
    var g = ctx.createGain();
    g.connect(master);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.55);

    var o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = hz(midi);
    o.connect(g);
    o.start(at); o.stop(at + 0.6);

    var top = ctx.createOscillator();
    var tg = ctx.createGain();
    top.type = 'sine';
    top.frequency.value = hz(midi + 12);
    tg.gain.value = 0.3;
    top.connect(tg); tg.connect(g);
    top.start(at); top.stop(at + 0.6);
  }

  /* Flaeche: vier verstimmte Saegezaehne hinter einem Tiefpass, langsam auf
     und wieder ab — das Bett, auf dem alles andere liegt. */
  function pad(at, tones) {
    var dur = BAR * S16;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(600, at);
    lp.frequency.linearRampToValueAtTime(1400, at + dur * 0.6);
    lp.frequency.linearRampToValueAtTime(700, at + dur);

    var g = ctx.createGain();
    gainTo(g, at, 0.16, dur * 0.35, dur * 0.2, dur * 0.5);
    lp.connect(g); g.connect(master);

    for (var i = 0; i < tones.length; i++) {
      for (var d = 0; d < 2; d++) {
        var o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(tones[i] - 12);
        o.detune.value = d ? 7 : -7;
        o.connect(lp);
        o.start(at); o.stop(at + dur * 1.1);
      }
    }
  }

  function lead(at, midi, len) {
    var dur = len * S16;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2800;

    var g = ctx.createGain();
    gainTo(g, at, 0.13, 0.05, Math.max(0.02, dur - 0.22), 0.16);
    lp.connect(g); g.connect(master);

    for (var d = 0; d < 2; d++) {
      var o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(midi);
      o.detune.value = d ? 6 : -6;
      o.connect(lp);
      o.start(at); o.stop(at + dur + 0.25);
    }
  }

  function bass(at, midi) {
    var g = ctx.createGain();
    g.connect(master);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.34, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);

    var o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = hz(midi);
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    o.connect(lp); lp.connect(g);
    o.start(at); o.stop(at + 0.25);
  }

  function kick(at) {
    var g = ctx.createGain();
    g.connect(master);
    g.gain.setValueAtTime(0.9, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.26);

    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, at);
    o.frequency.exponentialRampToValueAtTime(45, at + 0.09);
    o.connect(g);
    o.start(at); o.stop(at + 0.3);
  }

  function noise() {
    if (noiseBuf) return noiseBuf;
    var n = Math.floor(ctx.sampleRate * 0.5);
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function hat(at) {
    var src = ctx.createBufferSource();
    src.buffer = noise();
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.09, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
    src.connect(hp); hp.connect(g); g.connect(master);
    src.start(at); src.stop(at + 0.1);
  }

  /* ---------- Planung ------------------------------------------------------ */

  /* Ein Sechzehntel einplanen. age = wie viele Takte schon gelaufen sind; das
     Schlagwerk und die Melodie setzen erst im zweiten Takt ein, damit das
     Stueck aufbaut statt sofort loszupoltern. */
  function schedule(i, at) {
    var inBar = i % BAR;
    var age = Math.floor(i / BAR);
    var ch = CHORDS[age % CHORDS.length];

    if (inBar === 0) pad(at, ch.tones);

    var n = ARP[inBar];
    piano(at, n < 4 ? ch.tones[n] : ch.tones[0] + 12, 0.15);

    if (age < 1) return;

    if (inBar % 4 === 0) kick(at);
    if (inBar % 4 === 2) { hat(at); bass(at, ch.root); }

    var line = MELODY[age % MELODY.length];
    for (var m = 0; m < line.length; m++) {
      if (line[m][0] === inBar) lead(at, line[m][1], line[m][2]);
    }
  }

  function pump() {
    if (!ctx || !wanted) return;
    var horizon = ctx.currentTime + AHEAD;
    while (next < horizon) {
      schedule(step, next);
      step++;
      next += S16;
    }
  }

  /* ---------- Trainingsgeraeusche ------------------------------------------ */

  /* Vorbild sind Amiga 500 und C64: Rechteck- und Saegezahnwellen statt
     Sinustoenen, harte Kanten statt weicher Huellkurven, Tonhoehen, die in
     Stufen springen. Der ganze Bus laeuft am Ende durch ein grobes Raster —
     das ist der Beigeschmack der alten 8-Bit-Wandler und macht mehr vom
     Charakter aus als die Wellenform selbst. */

  var CRUNCH = 15;        /* Stufen pro Halbwelle, also gut 4 Bit */

  function crusher() {
    var n = 1024;
    var curve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.round(x * CRUNCH) / CRUNCH;
    }
    var ws = ctx.createWaveShaper();
    ws.curve = curve;
    return ws;
  }

  /* Ein Ton mit der Kante eines Chip-Bausteins: sofort da, kein Einblenden,
     am Ende ein kurzer Abfall statt eines Ausklangs. */
  function chip(at, freq, dur, type, vol, cut) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.setValueAtTime(vol, at + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    var tail = g;
    if (cut) {
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = cut;
      lp.connect(g);
      tail = lp;
    }
    g.connect(sfxBus);

    var o = ctx.createOscillator();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, at);
    o.connect(tail);
    o.start(at); o.stop(at + dur + 0.02);
    return o;
  }

  /* Der Arpeggio-Trick des C64: ein einziger Oszillator springt im Rhythmus
     der Bildwiederholung durch die Toene eines Akkords. Klingt nach Akkord,
     kostet aber nur eine Stimme — und genau danach klingt es auch. */
  function sidArp(at, midis, dur, vol, rate) {
    var frame = rate || 0.02;               /* 1/50 s, wie beim Original */
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.setValueAtTime(vol, at + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    g.connect(sfxBus);

    var o = ctx.createOscillator();
    o.type = 'square';
    var steps = Math.max(1, Math.floor(dur / frame));
    for (var i = 0; i < steps; i++) {
      o.frequency.setValueAtTime(hz(midis[i % midis.length]), at + i * frame);
    }
    o.connect(g);
    o.start(at); o.stop(at + dur + 0.02);
  }

  /* Eisen: kurzer Rauschstoss durch ein schmales Band. Das ist die
     Amiga-Seite — dort kam so etwas als kurzes Sample von der Diskette. */
  function clank(at, freq, dur, vol) {
    var src = ctx.createBufferSource();
    src.buffer = noise();
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 3;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(bp); bp.connect(g); g.connect(sfxBus);
    src.start(at); src.stop(at + dur + 0.02);
  }

  /* Tonhoehe, die in Stufen faellt oder steigt — das Rutschen einer Sirene
     gab es auf dem SID nicht, dort wurde in Rastern gerechnet. */
  function slide(at, fromMidi, toMidi, dur, vol, type) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.setValueAtTime(vol, at + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    g.connect(sfxBus);

    var o = ctx.createOscillator();
    o.type = type || 'square';
    var steps = Math.max(2, Math.round(dur / 0.02));
    for (var i = 0; i < steps; i++) {
      var m = fromMidi + (toMidi - fromMidi) * (i / (steps - 1));
      o.frequency.setValueAtTime(hz(Math.round(m)), at + i * (dur / steps));
    }
    o.connect(g);
    o.start(at); o.stop(at + dur + 0.02);
  }

  var SFX = {
    /* Griff ans Gewicht: Scheibe klirrt, Rahmen wummert. */
    rack: function (at) {
      clank(at, 2400, 0.07, 0.34);
      clank(at + 0.05, 1500, 0.12, 0.2);
      slide(at, 45, 33, 0.14, 0.22, 'triangle');
    },
    /* Saubere Wiederholung: Akkord nach oben, dazu das Klacken des Gewichts. */
    perfect: function (at) {
      clank(at, 2000, 0.05, 0.3);
      sidArp(at + 0.01, [72, 76, 79, 84], 0.18, 0.2);
      chip(at + 0.19, hz(84), 0.11, 'square', 0.16);
    },
    /* Unsauber: zwei Stufen, dumpfer, kein Glanz oben drauf. */
    ok: function (at) {
      clank(at, 1400, 0.05, 0.22);
      sidArp(at + 0.01, [67, 72], 0.12, 0.17, 0.03);
    },
    /* Verrissen: Tonhoehe faellt in Stufen, dazu ein Scheppern. */
    miss: function (at) {
      slide(at, 62, 38, 0.26, 0.24, 'sawtooth');
      clank(at + 0.02, 700, 0.22, 0.24);
    },
    /* Satz geschafft: die Fanfare, die auf dem C64 hinter jedem Level stand. */
    done: function (at) {
      sidArp(at, [60, 64, 67], 0.12, 0.2, 0.025);
      sidArp(at + 0.12, [64, 67, 72], 0.12, 0.2, 0.025);
      sidArp(at + 0.24, [67, 72, 76], 0.34, 0.22, 0.025);
      clank(at + 0.24, 3000, 0.1, 0.2);
    },
    /* Aufstieg: laenger, eine Stufe hoeher, mit Nachschlag. */
    level: function (at) {
      sidArp(at, [60, 64, 67, 72], 0.24, 0.2, 0.025);
      sidArp(at + 0.24, [64, 67, 72, 76], 0.24, 0.2, 0.025);
      sidArp(at + 0.48, [67, 72, 76, 79], 0.55, 0.24, 0.02);
      chip(at + 0.48, hz(84), 0.5, 'square', 0.1, 3000);
    }
  };

  function sfx(name) {
    if (!sfxOn || !supported) return;
    var make = SFX[name];
    if (!make || !build()) return;
    if (ctx.state === 'suspended' && ctx.resume) {
      try { ctx.resume(); } catch (err) { return; }
    }
    if (ctx.state === 'suspended') return;
    try {
      make(ctx.currentTime + 0.005);
    } catch (err) {
      /* Ein misslungenes Geraeusch darf das Training nicht anhalten. */
    }
  }

  /* ---------- Aufbau und Steuerung ----------------------------------------- */

  function build() {
    if (ctx) return true;
    try {
      ctx = new Ctor();
    } catch (err) {
      supported = false;
      return false;
    }

    var out = ctx.destination;
    if (ctx.createDynamicsCompressor) {
      var comp = ctx.createDynamicsCompressor();
      comp.connect(ctx.destination);
      out = comp;
    }

    master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(out);

    /* Eigener Weg fuer die Geraeusche, damit sie nicht mit der Musik
       weggeblendet werden — und mit dem Raster am Ende. */
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.55;
    if (ctx.createWaveShaper && typeof Float32Array !== 'undefined') {
      var ws = crusher();
      sfxBus.connect(ws);
      ws.connect(out);
    } else {
      sfxBus.connect(out);
    }
    return true;
  }

  /* Wartet auf die erste Beruehrung irgendwo und startet dann nach — aber nur,
     wenn zu dem Zeitpunkt ueberhaupt noch Musik laufen soll. Wer den Vorspann
     wegtippt, bekommt keinen Nachschlag. */
  function arm() {
    if (armed || typeof document === 'undefined' || !document.addEventListener) return;
    armed = true;
    /* Bewusst in der Blasenphase: so hat der Tipp aufs Bild seinen eigenen
       Griff schon gehabt. Wer den Film wegtippt, hat dann wanted = false und
       bekommt keine Musik mehr nachgeschoben. Nachtraeglich per setTimeout ginge
       nicht — das Freischalten muss innerhalb der Geste passieren. */
    var fire = function () {
      document.removeEventListener('pointerdown', fire, false);
      document.removeEventListener('keydown', fire, false);
      armed = false;
      if (wanted) start();
    };
    document.addEventListener('pointerdown', fire, false);
    document.addEventListener('keydown', fire, false);
  }

  function startFile() {
    if (fileState !== 'ready' || !file) return false;
    try {
      file.currentTime = 0;
      file.volume = 0.6;
      var p = file.play();
      if (p && p['catch']) p['catch'](function () { arm(); });
      return true;
    } catch (err) {
      return false;
    }
  }

  function startSynth() {
    if (!build()) return;
    if (ctx.state === 'suspended' && ctx.resume) {
      try { ctx.resume(); } catch (err) { /* egal, arm() faengt es */ }
    }
    if (ctx.state === 'suspended') { arm(); return; }

    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.5);

    step = 0;
    next = ctx.currentTime + 0.06;
    if (timer) window.clearInterval(timer);
    timer = window.setInterval(pump, TICK);
    pump();
  }

  function start() {
    if (!enabled) return;
    wanted = true;
    if (startFile()) return;
    if (!supported) return;
    startSynth();
  }

  /* Ausblenden statt hart abwuergen — der Vorspann blendet sich ebenfalls weg. */
  function stop(fade) {
    wanted = false;
    var secs = fade === undefined ? 0.45 : fade;

    if (file && !file.paused) {
      try { file.pause(); } catch (err) { /* ignorieren */ }
    }
    if (!ctx) return;
    if (timer) { window.clearInterval(timer); timer = 0; }
    try {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + secs);
    } catch (err) { /* ignorieren */ }
  }

  /* Eigene Datei suchen. Fehlt sie, bleibt es beim Synthesizer. */
  function init() {
    if (typeof document === 'undefined' || !document.createElement) return;
    var node;
    try {
      node = document.createElement('audio');
    } catch (err) {
      return;
    }
    if (!node || !node.addEventListener || node.canPlayType === undefined) return;

    node.loop = true;
    node.preload = 'auto';
    node.addEventListener('canplaythrough', function () {
      fileState = 'ready';
      file = node;
    });
    node.addEventListener('error', function () { fileState = 'missing'; });
    node.src = FILE;
  }

  MF.core.audio = {
    init: init,
    start: start,
    stop: stop,
    sfx: sfx,
    setEnabled: function (v) {
      enabled = !!v;
      if (!enabled) stop(0.25);
    },
    isEnabled: function () { return enabled; },
    setSfxEnabled: function (v) { sfxOn = !!v; },
    isSfxEnabled: function () { return sfxOn; },
    isSupported: function () { return supported; }
  };
})(window.MacFit);
