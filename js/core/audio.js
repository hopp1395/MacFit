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

  /* Leitbild sind die Rueckmeldetoene heutiger Apps: Sinus und Dreieck statt
     Rechteck und Saegezahn, jede Stimme blendet in ein paar Millisekunden ein
     statt hart einzusetzen, Tonhoehen gleiten stufenlos statt in Rastern zu
     springen. Die Geraeusche sollen bestaetigen, nicht auffallen — die Pegel
     liegen bei etwa der Haelfte der frueheren Chip-Fassung, und deren
     4-Bit-Verzerrer ueber dem ganzen Bus ist ersatzlos gestrichen. */

  /* Ein weicher Einzelton, der Grundbaustein: Sinus oder Dreieck, auf Wunsch
     mit stufenlos gleitender Tonhoehe (bendTo) und Tiefpass (cut). */
  function tone(at, freq, dur, vol, opts) {
    var o = opts || {};
    var g = ctx.createGain();
    gainTo(g, at, vol, o.attack || 0.008, dur * 0.25, dur * 0.75);
    var tail = g;
    if (o.cut) {
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = o.cut;
      lp.connect(g);
      tail = lp;
    }
    g.connect(sfxBus);

    var osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, at);
    if (o.bendTo) osc.frequency.exponentialRampToValueAtTime(o.bendTo, at + dur);
    osc.connect(tail);
    osc.start(at); osc.stop(at + dur + 0.05);
  }

  /* Der Bestaetigungston: Sinus mit leiser Oktave darueber, kurzer Anschlag,
     Ausklang wie eine angeschlagene Saite — dieselbe Machart wie das Klavier
     der Titelmusik, nur kuerzer und auf dem Effektbus. */
  function pluck(at, midi, vol, dur) {
    var d = dur || 0.3;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + d);
    g.connect(sfxBus);

    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = hz(midi);
    o.connect(g);
    o.start(at); o.stop(at + d + 0.02);

    var top = ctx.createOscillator();
    var tg = ctx.createGain();
    top.type = 'sine';
    top.frequency.value = hz(midi + 12);
    tg.gain.value = 0.25;
    top.connect(tg); tg.connect(g);
    top.start(at); top.stop(at + d + 0.02);
  }

  /* Aufschlag: ein tiefer Sinus sackt stufenlos ab, dazu ein Hauch tiefpass-
     gefiltertes Rauschen. Ersetzt Klirren und Scheppern — Eisen auf einer
     Gummimatte statt Blech auf Beton. */
  function thud(at, vol, fromHz, toHz) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    g.connect(sfxBus);

    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(fromHz || 120, at);
    o.frequency.exponentialRampToValueAtTime(toHz || 50, at + 0.12);
    o.connect(g);
    o.start(at); o.stop(at + 0.26);

    var src = ctx.createBufferSource();
    src.buffer = noise();
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, at);
    ng.gain.exponentialRampToValueAtTime(vol * 0.5, at + 0.006);
    ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
    src.connect(lp); lp.connect(ng); ng.connect(sfxBus);
    src.start(at); src.stop(at + 0.12);
  }

  /* Luft: Rauschen durch ein breites, wanderndes Band, weich ein- und
     ausgeblendet. Die Rauschtabelle ist nur eine halbe Sekunde lang, deshalb
     in Schleife. Ersetzt das Zischen mit hoher Bandschaerfe. */
  function air(at, fromHz, toHz, dur, vol) {
    var src = ctx.createBufferSource();
    src.buffer = noise();
    src.loop = true;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(fromHz, at);
    bp.frequency.exponentialRampToValueAtTime(Math.max(60, toHz), at + dur);
    bp.Q.value = 1;
    var g = ctx.createGain();
    gainTo(g, at, vol, dur * 0.3, dur * 0.2, dur * 0.5);
    src.connect(bp); bp.connect(g); g.connect(sfxBus);
    src.start(at); src.stop(at + dur + 0.02);
  }

  /* Motor: Dreieck und Sinus eine Oktave auseinander, die Tonhoehe gleitet
     stufenlos, ein tiefer Tiefpass macht ein Brummen daraus. */
  function engine(at, fromMidi, toMidi, dur, vol) {
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    var g = ctx.createGain();
    gainTo(g, at, vol, dur * 0.3, dur * 0.42, dur * 0.28);
    lp.connect(g); g.connect(sfxBus);

    var types = ['triangle', 'sine'];
    for (var v = 0; v < 2; v++) {
      var o = ctx.createOscillator();
      o.type = types[v];
      o.frequency.setValueAtTime(hz(fromMidi - v * 12), at);
      o.frequency.exponentialRampToValueAtTime(hz(toMidi - v * 12), at + dur);
      o.connect(lp);
      o.start(at); o.stop(at + dur + 0.02);
    }
  }

  var SFX = {
    /* Griff ans Gewicht: weicher Aufschlag, dazu ein leiser heller Tick. */
    rack: function (at) {
      thud(at, 0.32);
      tone(at + 0.02, 1900, 0.06, 0.05, { attack: 0.005 });
    },
    /* Saubere Wiederholung: zwei weiche Toene aufwaerts. */
    perfect: function (at) {
      pluck(at, 79, 0.18, 0.16);
      pluck(at + 0.08, 84, 0.2, 0.3);
    },
    /* Unsauber: ein einzelner, dunklerer Ton ohne Glanz. */
    ok: function (at) {
      tone(at, hz(72), 0.2, 0.16, { type: 'triangle', cut: 1400, attack: 0.006 });
    },
    /* Verrissen: ein Ton sackt weich ab, darunter ein gedaempfter Aufschlag —
       erkennbar daneben, ohne wehzutun. */
    miss: function (at) {
      tone(at, hz(64), 0.3, 0.14, { bendTo: hz(50), attack: 0.006 });
      thud(at + 0.05, 0.2, 90, 45);
    },
    /* Satz geschafft: drei ueberlappende Toene aufwaerts, dezent. */
    done: function (at) {
      pluck(at, 72, 0.15, 0.3);
      pluck(at + 0.09, 76, 0.15, 0.3);
      pluck(at + 0.18, 79, 0.17, 0.45);
    },
    /* Aufstieg: vier Toene aufwaerts und ein langer, hoher Schimmer. */
    level: function (at) {
      pluck(at, 72, 0.18, 0.3);
      pluck(at + 0.11, 76, 0.18, 0.3);
      pluck(at + 0.22, 79, 0.18, 0.3);
      pluck(at + 0.33, 84, 0.2, 0.5);
      tone(at + 0.33, hz(91), 0.9, 0.05, { attack: 0.05 });
    },

    /* Kasse: zwei kurze weiche Ticks aufwaerts. */
    coin: function (at) {
      pluck(at, 84, 0.13, 0.09);
      pluck(at + 0.06, 91, 0.15, 0.22);
    },

    /* Feierabend: dieselben drei Toene abwaerts wie immer, nur mit langem
       Ausklang statt hartem Ende. */
    sleep: function (at) {
      pluck(at, 69, 0.16, 0.35);
      pluck(at + 0.18, 65, 0.16, 0.35);
      pluck(at + 0.36, 60, 0.16, 0.7);
    },

    /* Vorspann: Wagen kommt an und bremst. */
    drive: function (at) {
      engine(at, 45, 33, 1.15, 0.22);
      air(at + 0.8, 1800, 700, 0.36, 0.16);      /* Reifen */
    },
    /* Vorspann: Wagen faehrt weg. */
    driveOff: function (at) {
      engine(at, 31, 47, 1.05, 0.22);
    },
    /* Autotuer: dumpfes Zufallen. Lauter als die Geraeusche im Training —
       hier laeuft die Titelmusik darunter und schluckt sonst alles. */
    carDoor: function (at) {
      thud(at, 0.5, 140, 55);
    },
    /* Schiebetuer des Studios: Luft nach oben. Der Wert sieht hoch aus, ist
       er aber nicht: der Bandpass laesst vom Rauschen nur einen Streifen
       durch, der Ausgang liegt weit unter dem Eingang. */
    gymDoor: function (at) {
      air(at, 700, 2200, 0.45, 0.5);
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
       weggeblendet werden. */
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.3;
    sfxBus.connect(out);
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
