/* Freunde: was veroeffentlicht wird, wann abgeglichen wird, und wie ein
   Freund an die Stelle des NPC-Rivalen kommt.

   Der Datenverkehr steht in js/core/friends.js — hier steht nur, was er
   bedeutet.

   Drei Dinge sind wichtig:

   1. Nichts davon passiert ungefragt. Solange der Spieler die Funktion nicht
      selbst freischaltet, gibt es kein Profil in der Cloud und ihn findet
      niemand. enable() legt es an, disable() raeumt es samt aller
      Verbindungen wieder weg.

   2. Der Freundescode ist bewusst NICHT die Mitgliedsnummer. Die Nummer
      haengt am automatisch angelegten Konto (cloud.memberEmail) — waere sie
      der Code, muesste sie bei einer Kollision neu gewuerfelt werden, und
      damit waere der Benutzername eines Bestandsspielers ein anderer als
      der, der auf seiner Karte steht. Der Code darf dagegen beliebig oft
      neu gezogen werden, bis einer frei ist.

   3. Der Spielstand bleibt privat. Veroeffentlicht wird nur die Visitenkarte:
      Name, Code, Level, Masse, Index, Saetze, Tag, Outfit, Definition,
      Gesundheit und die Verhaeltnisse der acht Partien fuers Posenbild.

   Der Zwischenspeicher (s.friends.list/invites/sent) steht im Spielstand,
   damit die Kachel im Koerper-Bildschirm ohne Netzabfrage sagen kann, dass
   eine Einladung wartet. Er ist reine Anzeige — die Wahrheit steht in der
   Datenbank und wird bei jedem refresh() neu geholt. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var api = MF.core.friends;

  var ICON = '🤝';
  var THROTTLE_MS = 20000;   /* haeufiger als das lohnt kein Abgleich */

  var lastRefresh = 0;
  var busy = false;

  function state() { return MF.game.state.get(); }

  function block() {
    var s = state();
    return s ? s.friends : null;
  }

  function enabled() {
    var f = block();
    return !!(f && f.on && f.code);
  }

  function code() {
    var f = block();
    return f ? f.code : '';
  }

  function changed() {
    MF.game.state.saveSoon();
    MF.core.events.emit('friends:changed');
  }

  /* --- Die eigene Visitenkarte -------------------------------------------- */

  /* Die acht Partien im Verhaeltnis zu ihrem Mittel. stats.sizesForMass()
     rechnet daraus auf der Gegenseite wieder Groessen zurueck — so posiert
     ein Freund mit seiner eigenen Figur und nicht mit der Gleichverteilung. */
  function shapeOf() {
    var s = state();
    var ids = MF.data.muscles.ids;
    var sum = 0;
    ids.forEach(function (id) { sum += s.muscles[id].size; });
    var mean = sum / ids.length;
    if (mean <= 0) return null;
    var out = {};
    ids.forEach(function (id) {
      out[id] = util.round(s.muscles[id].size / mean, 3);
    });
    return out;
  }

  function card() {
    var s = state();
    /* Saetze vom letzten abgeschlossenen Tag: waehrend des laufenden Tages
       ist die Zahl noch am Wachsen, und ein Freund soll nicht dadurch
       fleissiger aussehen, dass man ihn abends abfragt. */
    var last = s.history.length ? s.history[s.history.length - 1] : null;
    return {
      code: s.friends.code,
      name: s.player.name || 'Mitglied',
      level: s.level,
      mass: util.round(MF.game.stats.muscleMass(), 2),
      fit: MF.game.fitness.index(),
      sets: last ? last.sets : 0,
      day: s.day,
      outfit: s.player.outfit || 'blau',
      def: util.round(MF.game.fat.definition(), 3),
      health: Math.round(MF.game.stats.healthAvg()),
      shape: shapeOf()
    };
  }

  /* Aus einer Profilzeile wird die Ansicht, die Oberflaeche und Rivale
     kennen. linkId gehoert zur Verbindung, nicht zum Profil — ohne sie
     liesse sich eine Einladung nicht beantworten. */
  function toFriend(row, linkId, since) {
    return {
      id: row.user_id, linkId: linkId, since: since || '',
      code: row.code, name: row.name || 'Mitglied', icon: ICON,
      level: row.level || 1, mass: Number(row.mass) || 0,
      fit: Math.round(Number(row.fit) || 0), sets: Math.round(Number(row.sets) || 0),
      day: row.day || 1, outfit: row.outfit || 'blau',
      def: Number(row.def) || 0.5, health: Math.round(Number(row.health) || 80),
      shape: row.shape || null
    };
  }

  /* Ein Konto ohne Profil: der Freund hat die Funktion wieder abgeschaltet.
     Die Verbindung bleibt sichtbar, damit sie sich entfernen laesst. */
  function ghost(id, linkId) {
    return {
      id: id, linkId: linkId, since: '', code: '', name: 'Nicht mehr sichtbar',
      icon: '👻', level: 1, mass: 0, fit: 0, sets: 0, day: 1, outfit: 'schwarz',
      def: 0.5, health: 80, shape: null, gone: true
    };
  }

  /* --- Freischalten und abschalten ---------------------------------------- */

  /* done(fehlertext | null). Ein belegter Code wird neu gewuerfelt; nach
     sechs Fehlschlaegen ist eher etwas anderes kaputt als das Glueck. */
  function enable(done) {
    var s = state();
    var tries = 0;

    function attempt() {
      if (!s.friends.code) s.friends.code = api.newCode();
      api.publish(card(), function (err, row) {
        if (err === 'belegt') {
          s.friends.code = '';
          if (++tries > 6) { done('Es ließ sich gerade kein freier Code finden.'); return; }
          attempt();
          return;
        }
        if (err) { done(err); return; }
        s.friends.on = true;
        s.friends.code = row.code;
        MF.game.state.saveNow();
        refresh(function () { done(null); });
      });
    }

    attempt();
  }

  /* Abschalten raeumt auch die Verbindungen ab. Bliebe nur das Profil weg,
     stuende man bei allen Freunden als "Nicht mehr sichtbar" in der Liste —
     ein Geist, den nur die andere Seite wegklicken kann. */
  function disable(done) {
    var s = state();
    var ids = [];
    [s.friends.list, s.friends.invites, s.friends.sent].forEach(function (group) {
      group.forEach(function (f) { if (f.linkId) ids.push(f.linkId); });
    });

    var left = ids.length;
    function finish() {
      api.unpublish(function (err) {
        if (err) { done(err); return; }
        s.friends.on = false;
        s.friends.code = '';
        s.friends.list = [];
        s.friends.invites = [];
        s.friends.sent = [];
        if (MF.game.rival.isFriend()) MF.game.rival.useNpc();
        MF.game.state.saveNow();
        MF.core.events.emit('friends:changed');
        done(null);
      });
    }

    if (!left) { finish(); return; }
    ids.forEach(function (id) {
      api.drop(id, function () {
        if (--left === 0) finish();
      });
    });
  }

  /* Die eigenen Zahlen auffrischen. Laeuft nach jeder Nacht und beim Start —
     ohne das saehe ein Freund ewig den Stand vom Tag der Freischaltung. */
  function push(done) {
    if (!enabled()) { if (done) done(null); return; }
    api.publish(card(), function (err) {
      /* Ein belegter Code kann hier nicht mehr auftreten: die Zeile
         existiert bereits mit genau diesem Code. */
      if (done) done(err === 'belegt' ? null : err);
    });
  }

  /* --- Abgleich ------------------------------------------------------------ */

  /* Verbindungen und Profile in einem Rutsch. done(fehlertext | null). */
  function refresh(done) {
    var go = done || function () {};
    if (!enabled()) { go(null); return; }
    if (busy) { go(null); return; }
    busy = true;

    api.links(function (err, rows) {
      if (err) { busy = false; go(err); return; }

      /* Die Sitzung kann zwischen den beiden Abfragen ablaufen — dann ist
         hier kein Konto mehr, und ohne die eigene Kennung liesse sich nicht
         entscheiden, wer bei einer Verbindung der andere ist. */
      var u = MF.core.cloud.user();
      if (!u) { busy = false; go('Nicht angemeldet.'); return; }

      var me = u.id;
      var others = rows.map(function (r) {
        return r.from_user === me ? r.to_user : r.from_user;
      });

      api.byIds(others, function (err2, map) {
        busy = false;
        if (err2) { go(err2); return; }

        var s = state();
        var list = [], invites = [], sent = [];

        rows.forEach(function (r) {
          var otherId = r.from_user === me ? r.to_user : r.from_user;
          var p = map[otherId];
          var f = p ? toFriend(p, r.id, r.created_at) : ghost(otherId, r.id);
          if (r.status === 'angenommen') list.push(f);
          else if (r.to_user === me) invites.push(f);
          else sent.push(f);
        });

        s.friends.list = list;
        s.friends.invites = invites;
        s.friends.sent = sent;
        lastRefresh = +new Date();

        syncRivalFrom(list);
        changed();
        go(null);
      });
    });
  }

  /* Nur abgleichen, wenn es sich lohnt — das haengt an jedem Oeffnen der
     Kachel und soll nicht bei jedem Antippen den Server fragen. */
  function refreshSoon(done) {
    if (+new Date() - lastRefresh < THROTTLE_MS) { if (done) done(null); return; }
    refresh(done);
  }

  /* Steht ein Freund im Rivalenplatz, bekommt er hier seine frischen Zahlen.
     Ist die Freundschaft weg, ruecken die Stammgaeste nach — aber nur bei
     einer erfolgreichen Abfrage, sonst wuerde ein Funkloch den Freund
     hinauswerfen. */
  function syncRivalFrom(list) {
    if (!MF.game.rival.isFriend()) return;
    var id = state().rival.id;
    var found = null;
    list.forEach(function (f) { if (f.id === id) found = f; });

    if (!found) {
      MF.game.rival.useNpc();
      MF.core.events.emit('friends:rivalgone');
      return;
    }
    if (found.gone) return;   /* Profil abgeschaltet: alte Zahlen behalten */
    MF.game.rival.updateFriend(found);
  }

  /* --- Einladen und beantworten -------------------------------------------- */

  /* done(fehlertext | null, name). Eine Gegeneinladung wird angenommen statt
     beantwortet — wer sich gegenseitig einlaedt, meint dasselbe. */
  function sendInvite(raw, done) {
    var s = state();
    var want = api.cleanCode(raw);

    if (!api.isCode(want)) {
      done('Ein Freundescode hat ' + api.CODE_LEN + ' Zeichen, zum Beispiel MF-K7P2QX.');
      return;
    }
    if (want === s.friends.code) { done('Das ist dein eigener Code.'); return; }

    api.byCode(want, function (err, p) {
      if (err) { done(err); return; }
      if (!p) { done('Zu diesem Code gibt es niemanden. Vertippt?'); return; }

      var already = null, incoming = null;
      s.friends.list.forEach(function (f) { if (f.id === p.user_id) already = f; });
      s.friends.invites.forEach(function (f) { if (f.id === p.user_id) incoming = f; });

      if (already) { done(p.name + ' ist schon dein Freund.'); return; }
      if (incoming) {
        acceptInvite(incoming.linkId, function (e2) { done(e2, p.name); });
        return;
      }

      api.invite(p.user_id, function (err2) {
        if (err2 === 'schon eingeladen') {
          done('Du hast ' + p.name + ' bereits eingeladen — jetzt liegt es an ihm.');
          return;
        }
        if (err2) { done(err2); return; }
        refresh(function () { done(null, p.name); });
      });
    });
  }

  function acceptInvite(linkId, done) {
    api.accept(linkId, function (err) {
      if (err) { done(err); return; }
      refresh(function () { done(null); });
    });
  }

  /* Ablehnen, Einladung zurueckziehen, Freundschaft beenden. */
  function drop(linkId, done) {
    api.drop(linkId, function (err) {
      if (err) { done(err); return; }
      refresh(function () { done(null); });
    });
  }

  /* --- Rivalenplatz --------------------------------------------------------- */

  function isRival(friend) {
    var s = state();
    return MF.game.rival.isFriend() && s.rival.id === friend.id;
  }

  function useAsRival(friend) {
    if (!friend || friend.gone) return false;
    return MF.game.rival.setFriend(friend);
  }

  function pendingCount() {
    var f = block();
    return f ? f.invites.length : 0;
  }

  MF.game.friends = {
    ICON: ICON,
    enabled: enabled,
    code: code,
    card: card,
    enable: enable,
    disable: disable,
    push: push,
    refresh: refresh,
    refreshSoon: refreshSoon,
    sendInvite: sendInvite,
    acceptInvite: acceptInvite,
    drop: drop,
    isRival: isRival,
    useAsRival: useAsRival,
    pendingCount: pendingCount
  };
})(window.MacFit);
