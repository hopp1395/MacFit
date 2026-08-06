/* Der Rivale: ein Stammgast, der jeden Tag mittrainiert, ob du kommst oder
   nicht. Er ist kein zweiter Spielstand — gespeichert wird nur seine Masse.
   Alles andere (Fitness-Index, Sprüche, Sätze) faellt aus der Masse und
   seiner Charakterbeschreibung heraus.

   Sein Zuwachs pro Nacht hat drei Faktoren:
     Grundtempo   pace der Figur, gedaempft an seiner eigenen Decke
     Gummiband    faellt er zurueck, legt er zu; zieht er davon, bremst er
     Ruhetag      einmal pro Woche macht er nichts

   Das Gummiband ist Absicht: ohne es waere er nach zwei Wochen entweder
   uneinholbar oder bedeutungslos. So bleibt er in Schlagdistanz, ohne dass
   gutes Spiel folgenlos bliebe — wer dranbleibt, zieht dauerhaft vorbei. */
(function (MF) {
  'use strict';

  var util = MF.core.util;

  var UNLOCK_LEVEL = 2;   /* vorher hat der Spieler genug mit sich zu tun */
  var BASE_GAIN = 0.34;   /* kg pro Nacht bei frischem Trainingsstand */
  var CEILING = 52;       /* dagegen laeuft sein Aufbau asymptotisch */
  var CLOSE = 0.4;        /* bis hierhin gilt es als Gleichstand (kg) */

  function state() { return MF.game.state.get(); }

  function active() {
    var s = state();
    return !!s && s.level >= UNLOCK_LEVEL && !!s.player && !!s.player.created;
  }

  function def() {
    var s = state();
    return s && s.rival.id ? MF.data.rivals.get(s.rival.id) : null;
  }

  /* Beim ersten Mal wird der Rivale festgelegt und knapp vor den Spieler
     gesetzt — ein Rivale, der von Anfang an hinterherlaeuft, zieht nicht. */
  function ensure() {
    if (!active()) return null;
    var s = state();
    if (!s.rival.id) {
      var d = MF.data.rivals.forNumber(s.player.number);
      s.rival.id = d.id;
      s.rival.since = s.day;
      s.rival.mass = MF.game.stats.muscleMass() + 0.6;
      s.rival.sets = 8;
      s.rival.flip = '';
    }
    return def();
  }

  function mass() {
    return state().rival.mass;
  }

  /* Sein Fitness-Index: dieselbe Masse-Kurve wie beim Spieler, nur mit dem
     festen Qualitaetsfaktor der Figur statt der gerechneten Aufschluesselung. */
  function fit() {
    var d = def();
    if (!d) return 0;
    return Math.round(MF.game.fitness.scoreForMass(mass()) * d.quality);
  }

  /* Wo steht der Spieler? diff > 0 heisst: der Spieler ist vorn.
     key beschreibt die Lage AUS SICHT DES RIVALEN — so heissen auch die
     Spruchgruppen in data/rivals.js. */
  function standing() {
    var diff = MF.game.stats.muscleMass() - mass();
    var key = diff >= CLOSE ? 'behind' : (diff <= -CLOSE ? 'ahead' : 'close');
    return { diff: diff, key: key, lead: diff > 0, close: Math.abs(diff) < CLOSE };
  }

  function seed(d) {
    return d.id.charCodeAt(0) % 7;
  }

  /* Ein Spruch zur Lage. Ohne Angabe entscheidet der Tagesstand. */
  function line(key) {
    var d = def();
    if (!d) return '';
    var group = d.lines[key || standing().key] || d.lines.close;
    return group[(state().day + seed(d)) % group.length];
  }

  /* Die Nacht des Rivalen. massBefore/massAfter sind die Werte des Spielers
     vor und nach der Nacht — daraus faellt ab, ob sich die Reihenfolge
     gedreht hat. */
  function tickNight(massBefore, massAfter) {
    var d = ensure();
    if (!d) return null;

    var s = state();
    var r = s.rival;
    var leadBefore = massBefore >= r.mass;
    var rest = ((s.day + seed(d)) % 7) === d.restDay;
    var gain = 0;

    if (!rest) {
      /* Je naeher an seiner Decke, desto weniger kommt dazu. */
      var head = util.clamp(1 - (r.mass - 28) / (CEILING - 28), 0.06, 1);
      /* Gummiband: der Abstand zum Spieler zieht ihn mit. */
      var rubber = util.clamp(1 + (massAfter - r.mass) * 0.30 * d.catchUp, 0.55, 1.7);
      gain = BASE_GAIN * d.pace * head * rubber;
    }

    r.mass += gain;
    r.sets = rest ? 0 : 5 + ((s.day * 3 + seed(d)) % 6);

    var leadAfter = massAfter >= r.mass;
    r.flip = leadBefore && !leadAfter ? 'overtook'
      : (!leadBefore && leadAfter ? 'passed' : '');

    return {
      name: d.short, icon: d.icon, gain: gain, mass: r.mass,
      sets: r.sets, rest: rest, flip: r.flip, diff: massAfter - r.mass
    };
  }

  /* Ein Wechsel an der Spitze wird genau einmal erzaehlt — am Eingang. */
  function takeFlip() {
    var r = state().rival;
    var flip = r.flip || '';
    if (flip) {
      r.flip = '';
      MF.game.state.saveSoon();
    }
    return flip;
  }

  MF.game.rival = {
    UNLOCK_LEVEL: UNLOCK_LEVEL,
    CLOSE: CLOSE,
    active: active,
    ensure: ensure,
    def: def,
    mass: mass,
    fit: fit,
    standing: standing,
    line: line,
    tickNight: tickNight,
    takeFlip: takeFlip
  };
})(window.MacFit);
