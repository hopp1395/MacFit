/* Freunde in der Cloud — reiner Datenverkehr, kein Spielwissen.

   Hier stehen genau die neun Abfragen gegen die beiden Tabellen aus
   sql/freunde.sql. Was hineingeht und herauskommt, sind schlichte Objekte;
   was ein Profil bedeutet und wann es sich lohnt, eines zu schreiben,
   entscheidet js/game/friends.js.

   Alle Rueckrufe: done(fehlertext | null, daten). Kein Aufruf wirft.

   Die Zeilen der Tabelle friend_links tragen die Einladung UND die
   Freundschaft:

     from_user  wer eingeladen hat
     to_user    wer eingeladen wurde
     status     'offen' -> 'angenommen'

   Ablehnen, Zurueckziehen und Entfernen sind alle dasselbe: die Zeile
   verschwindet. Das spart einen dritten Zustand, den sonst jede Abfrage
   mitfiltern muesste. */
(function (MF) {
  'use strict';

  /* Ohne 0/O und 1/I: ein Code wird abgetippt oder durchtelefoniert, und
     genau daran scheitern sonst die Haelfte der Versuche. 32 Zeichen auf
     sechs Stellen sind gut eine Milliarde Moeglichkeiten. */
  var CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  var CODE_LEN = 6;

  /* Postgres meldet einen Verstoss gegen eine unique-Bedingung so. */
  var DUPLICATE = '23505';

  function db() { return MF.core.cloud.client(); }

  function uid() {
    var u = MF.core.cloud.user();
    return u ? u.id : '';
  }

  function fail(done) {
    return function (err) { done(MF.core.cloud.errorText(err), null); };
  }

  /* Ein zufaelliger Freundescode. Ob er frei ist, zeigt erst das Schreiben —
     deshalb probiert game/friends.js mehrere durch. */
  function newCode() {
    var out = '';
    for (var i = 0; i < CODE_LEN; i++) {
      out += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    return out;
  }

  /* Tippfehler abfangen, bevor sie zur Abfrage werden: Leerzeichen und ein
     vorangestelltes MF- fallen weg, Kleinbuchstaben werden gross. Was das
     Alphabet nicht kennt, bleibt stehen — sonst wuerde aus einem falschen
     Code still ein anderer gueltiger. */
  function cleanCode(raw) {
    return String(raw || '').toUpperCase().replace(/\s|-/g, '').replace(/^MF/, '');
  }

  function isCode(code) {
    if (code.length !== CODE_LEN) return false;
    for (var i = 0; i < code.length; i++) {
      if (CODE_CHARS.indexOf(code.charAt(i)) < 0) return false;
    }
    return true;
  }

  /* --- Profile --------------------------------------------------------- */

  var PROFILE_COLS = 'user_id, code, name, level, mass, fit, sets, day, outfit, '
                   + 'def, health, shape, updated_at';

  /* Das eigene Profil oder null, wenn noch keines veroeffentlicht ist. */
  function mine(done) {
    if (!uid()) { done('Nicht angemeldet.', null); return; }
    db().from('profiles').select(PROFILE_COLS).eq('user_id', uid()).maybeSingle()
      .then(function (res) {
        if (res.error) { done(MF.core.cloud.errorText(res.error), null); return; }
        done(null, res.data || null);
      })['catch'](fail(done));
  }

  /* Anlegen oder auffrischen. done('belegt') heisst: den Code hat schon
     jemand anderes — der Aufrufer probiert dann einen neuen. */
  function publish(card, done) {
    if (!uid()) { done('Nicht angemeldet.', null); return; }
    var row = {
      user_id: uid(), code: card.code, name: card.name, level: card.level,
      mass: card.mass, fit: card.fit, sets: card.sets, day: card.day,
      outfit: card.outfit, def: card.def, health: card.health, shape: card.shape
    };
    db().from('profiles').upsert(row).select(PROFILE_COLS).single()
      .then(function (res) {
        if (res.error) {
          done(res.error.code === DUPLICATE ? 'belegt'
            : MF.core.cloud.errorText(res.error), null);
          return;
        }
        done(null, res.data);
      })['catch'](fail(done));
  }

  /* Aus der Suche verschwinden. Die Verbindungen loeschen sich nicht mit —
     darum kuemmert sich der Aufrufer, damit auf der Gegenseite kein Freund
     ohne Namen stehen bleibt. */
  function unpublish(done) {
    if (!uid()) { done('Nicht angemeldet.', null); return; }
    db().from('profiles')['delete']().eq('user_id', uid())
      .then(function (res) {
        done(res.error ? MF.core.cloud.errorText(res.error) : null, null);
      })['catch'](fail(done));
  }

  /* Suche ueber den Freundescode. done(null, null) = es gibt niemanden. */
  function byCode(code, done) {
    db().from('profiles').select(PROFILE_COLS).eq('code', code).maybeSingle()
      .then(function (res) {
        if (res.error) { done(MF.core.cloud.errorText(res.error), null); return; }
        done(null, res.data || null);
      })['catch'](fail(done));
  }

  /* Mehrere Profile auf einmal — die Verbindungen liefern nur Kontokennungen,
     Name und Zahlen stehen im Profil. Rueckgabe: { kennung: profil }. */
  function byIds(ids, done) {
    if (!ids.length) { done(null, {}); return; }
    db().from('profiles').select(PROFILE_COLS)['in']('user_id', ids)
      .then(function (res) {
        if (res.error) { done(MF.core.cloud.errorText(res.error), null); return; }
        var map = {};
        (res.data || []).forEach(function (p) { map[p.user_id] = p; });
        done(null, map);
      })['catch'](fail(done));
  }

  /* --- Verbindungen ------------------------------------------------------ */

  /* Alles, woran das eigene Konto beteiligt ist — Einladungen in beide
     Richtungen und bestehende Freundschaften in einer Liste. Die Row Level
     Security filtert bereits, der Filter hier ist nur die Absicht im
     Klartext. */
  function links(done) {
    var me = uid();
    if (!me) { done('Nicht angemeldet.', null); return; }
    db().from('friend_links').select('id, from_user, to_user, status, created_at')
      .or('from_user.eq.' + me + ',to_user.eq.' + me)
      .then(function (res) {
        if (res.error) { done(MF.core.cloud.errorText(res.error), null); return; }
        done(null, res.data || []);
      })['catch'](fail(done));
  }

  /* done('schon eingeladen') heisst: in diese Richtung gibt es die Zeile
     bereits. Das ist kein Fehler, sondern eine Auskunft. */
  function invite(toId, done) {
    if (!uid()) { done('Nicht angemeldet.', null); return; }
    db().from('friend_links')
      .insert({ from_user: uid(), to_user: toId, status: 'offen' })
      .select('id, from_user, to_user, status, created_at').single()
      .then(function (res) {
        if (res.error) {
          done(res.error.code === DUPLICATE ? 'schon eingeladen'
            : MF.core.cloud.errorText(res.error), null);
          return;
        }
        done(null, res.data);
      })['catch'](fail(done));
  }

  function accept(id, done) {
    db().from('friend_links')
      .update({ status: 'angenommen', answered_at: new Date().toISOString() })
      .eq('id', id)
      .then(function (res) {
        done(res.error ? MF.core.cloud.errorText(res.error) : null, null);
      })['catch'](fail(done));
  }

  /* Ablehnen, zurueckziehen, entfernen — alles derselbe Griff. */
  function drop(id, done) {
    db().from('friend_links')['delete']().eq('id', id)
      .then(function (res) {
        done(res.error ? MF.core.cloud.errorText(res.error) : null, null);
      })['catch'](fail(done));
  }

  MF.core.friends = {
    CODE_LEN: CODE_LEN,
    newCode: newCode,
    cleanCode: cleanCode,
    isCode: isCode,
    mine: mine,
    publish: publish,
    unpublish: unpublish,
    byCode: byCode,
    byIds: byIds,
    links: links,
    invite: invite,
    accept: accept,
    drop: drop
  };
})(window.MacFit);
