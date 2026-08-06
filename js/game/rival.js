/* Der Rivale: wer neben dir trainiert. Heute ist das immer ein NPC aus
   data/rivals.js — spaeter soll an derselben Stelle ein Freund stehen
   koennen, mit seinen echten Zahlen aus der Cloud.

   Deshalb liegt zwischen Spielstand und Oberflaeche genau eine Funktion:
   view(). Sie liefert Name, Symbol, Masse, Fitness-Index und Saetze, egal
   woher sie kommen. Alles darueber (Begruessung, Vergleich, Tagesbericht)
   fragt nur view() und weiss nicht, ob da ein NPC oder ein Mensch steht.

   Der Unterschied liegt allein im Nachschub:
     NPC     tickNight() rechnet seine Nacht aus (Tempo, Gummiband, Ruhetag)
     Freund  tickNight() rechnet nichts — die Zahlen kommen per setFriend()
             aus dem Konto des Freundes, der Abgleich steht noch aus

   Der Zuwachs des NPC hat drei Faktoren:
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

  function isFriend() {
    var s = state();
    return !!s && s.rival.source === 'freund';
  }

  /* Die Figur hinter einem NPC — bei einem Freund gibt es keine. */
  function def() {
    var s = state();
    if (!s || isFriend() || !s.rival.id) return null;
    return MF.data.rivals.get(s.rival.id);
  }

  /* Beim ersten Mal wird der NPC festgelegt und knapp vor den Spieler
     gesetzt — ein Rivale, der von Anfang an hinterherlaeuft, zieht nicht.
     Steht schon ein Freund im Platz, bleibt er unangetastet. */
  function ensure() {
    if (!active()) return null;
    var s = state();
    if (!s.rival.id) {
      var d = MF.data.rivals.forNumber(s.player.number);
      s.rival.source = 'npc';
      s.rival.id = d.id;
      s.rival.since = s.day;
      s.rival.mass = MF.game.stats.muscleMass() + 0.6;
      s.rival.sets = 8;
      s.rival.flip = '';
    }
    return view();
  }

  /* Der eine Blick auf den Rivalen, den die Oberflaeche kennt. */
  function view() {
    var s = state();
    if (!s || !s.rival.id) return null;
    var r = s.rival;

    if (isFriend()) {
      return {
        source: 'freund', npc: false, id: r.id,
        name: r.name || 'Dein Freund',
        short: (r.name || 'Freund').split(' ')[0],
        icon: r.icon || '🤝',
        trait: 'Trainiert in einem anderen Studio — die Zahlen kommen aus '
             + 'dem Konto.',
        mass: r.mass, fit: r.fit, sets: r.sets, since: r.since,
        synced: r.synced,
        outfit: r.outfit || 'schwarz', health: 80, shape: null
      };
    }

    var d = MF.data.rivals.get(r.id);
    if (!d) return null;
    return {
      source: 'npc', npc: true, id: d.id,
      name: d.name, short: d.short, icon: d.icon, trait: d.trait,
      mass: r.mass,
      /* Beim NPC faellt der Index aus der Masse ab: dieselbe Kurve wie beim
         Spieler, nur mit dem festen Qualitaetsfaktor der Figur. */
      fit: Math.round(MF.game.fitness.scoreForMass(r.mass) * d.quality),
      sets: r.sets, since: r.since, synced: 0,
      outfit: d.outfit, health: d.health, shape: d.shape
    };
  }

  /* Sein Koerper fuers Posenbild: aus der einen Zahl, die von ihm gespeichert
     ist, werden die acht Partiegroessen zurueckgerechnet — verteilt nach dem
     shape der Figur. Ein Freund bekommt die gleichmaessige Verteilung, bis
     seine echten Werte aus dem Konto kommen. */
  function body() {
    var v = view();
    if (!v) return null;
    return {
      muscles: MF.game.stats.sizesForMass(v.mass, v.shape),
      health: v.health
    };
  }

  function mass() {
    return state().rival.mass;
  }

  function fit() {
    var v = view();
    return v ? v.fit : 0;
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

  /* Ein Spruch zur Lage. Nur NPCs reden — ein Freund sagt hier nichts, fuer
     ihn zeigt die Oberflaeche stattdessen die nackten Zahlen. */
  function line(key) {
    var d = def();
    if (!d) return '';
    var group = d.lines[key || standing().key] || d.lines.close;
    return group[(state().day + seed(d)) % group.length];
  }

  /* Einen Freund an die Stelle des NPC setzen. Die Cloud-Anbindung fehlt
     noch — was sie spaeter liefert, steht hier schon vollstaendig drin. */
  function setFriend(info) {
    if (!info || !info.id) return false;
    var s = state();
    var r = s.rival;
    r.source = 'freund';
    r.id = String(info.id);
    r.name = info.name || '';
    r.icon = info.icon || '';
    r.mass = Number(info.mass) || 0;
    r.fit = Math.round(Number(info.fit) || 0);
    r.sets = Math.round(Number(info.sets) || 0);
    r.since = info.since || s.day;
    r.synced = s.day;
    r.greetedDay = 0;
    r.flip = '';
    MF.game.state.saveNow();
    return true;
  }

  /* Frische Zahlen zu einem bereits eingetragenen Freund. */
  function updateFriend(info) {
    if (!isFriend() || !info) return false;
    var s = state();
    var r = s.rival;
    if (info.mass !== undefined) r.mass = Number(info.mass) || 0;
    if (info.fit !== undefined) r.fit = Math.round(Number(info.fit) || 0);
    if (info.sets !== undefined) r.sets = Math.round(Number(info.sets) || 0);
    if (info.name) r.name = info.name;
    r.synced = s.day;
    MF.game.state.saveSoon();
    return true;
  }

  /* Zurueck zum NPC — der alte Stand des Freundes wird dabei vergessen. */
  function useNpc() {
    var s = state();
    s.rival.source = 'npc';
    s.rival.id = '';
    s.rival.name = '';
    s.rival.icon = '';
    s.rival.fit = 0;
    s.rival.synced = 0;
    s.rival.greetedDay = 0;
    return ensure();
  }

  /* Die Nacht des Rivalen. massBefore/massAfter sind die Werte des Spielers
     vor und nach der Nacht — daraus faellt ab, ob sich die Reihenfolge
     gedreht hat. Beim Freund waechst hier nichts: seine Zahlen kommen aus
     seinem eigenen Spiel, der Fuehrungswechsel wird trotzdem erkannt. */
  function tickNight(massBefore, massAfter) {
    if (!ensure()) return null;

    var s = state();
    var r = s.rival;
    var d = def();
    var leadBefore = massBefore >= r.mass;
    var rest = false;
    var gain = 0;

    if (d) {
      rest = ((s.day + seed(d)) % 7) === d.restDay;
      if (!rest) {
        /* Je naeher an seiner Decke, desto weniger kommt dazu. */
        var head = util.clamp(1 - (r.mass - 28) / (CEILING - 28), 0.06, 1);
        /* Gummiband: der Abstand zum Spieler zieht ihn mit. */
        var rubber = util.clamp(1 + (massAfter - r.mass) * 0.30 * d.catchUp, 0.55, 1.7);
        gain = BASE_GAIN * d.pace * head * rubber;
      }
      r.mass += gain;
      r.sets = rest ? 0 : 5 + ((s.day * 3 + seed(d)) % 6);
    }

    var leadAfter = massAfter >= r.mass;
    r.flip = leadBefore && !leadAfter ? 'overtook'
      : (!leadBefore && leadAfter ? 'passed' : '');

    var v = view();
    return {
      name: v.short, icon: v.icon, npc: v.npc, gain: gain, mass: r.mass,
      sets: v.sets, rest: rest, flip: r.flip, diff: massAfter - r.mass
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
    isFriend: isFriend,
    ensure: ensure,
    view: view,
    body: body,
    def: def,
    mass: mass,
    fit: fit,
    standing: standing,
    line: line,
    setFriend: setFriend,
    updateFriend: updateFriend,
    useNpc: useNpc,
    tickNight: tickNight,
    takeFlip: takeFlip
  };
})(window.MacFit);
