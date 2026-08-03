/* Cloud-Anbindung an Supabase: Konto (E-Mail + Passwort) und Spielstand.

   Der localStorage bleibt der schnelle Zwischenspeicher — hier wird nur
   nachgezogen, nie blockiert. Jeder gelungene lokale Speicherpunkt
   ('save:done') stoesst mit kurzer Verzoegerung einen Upload an. Ein Marker
   im localStorage haelt fest, welcher Cloud-Stand zuletzt bestaetigt wurde;
   beim naechsten Start entscheidet decideBoot() damit, ob die Cloud oder
   dieses Geraet den juengeren Stand hat.

   supabase-js (js/vendor/supabase.js) uebernimmt Sitzung, Token-Erneuerung
   und den Ruecksprung aus der Passwort-Mail. Fehlt die Bibliothek, fetch
   oder die Konfiguration, meldet isSupported() false — das Spiel zeigt dann
   einen Hinweis statt zu starten. */
(function (MF) {
  'use strict';

  var MARKER_KEY = 'macfit.cloud.v1';
  var PUSH_DELAY_MS = 2500;   /* buendelt schnelle Save-Folgen zu einem Upload */
  var RETRY_SECONDS = 30;

  var client = null;
  var supported = false;
  var authUser = null;        /* { id, email } oder null */
  var pushTimer = null;
  var retryTimer = null;
  var pending = false;        /* letzter Upload scheiterte, Nachschub steht aus */
  var lastSyncAt = 0;
  var lastError = null;
  var quietSignOut = false;   /* gewolltes Abmelden loest keinen Hinweis aus */

  function now() { return +new Date(); }

  /* --- Sync-Marker --------------------------------------------------------- */

  function readMarker() {
    try {
      var raw = window.localStorage.getItem(MARKER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function writeMarker(m) {
    try { window.localStorage.setItem(MARKER_KEY, JSON.stringify(m)); } catch (err) { /* egal */ }
  }

  function clearMarker() {
    try { window.localStorage.removeItem(MARKER_KEY); } catch (err) { /* egal */ }
  }

  function markDirty() {
    var m = readMarker() || {};
    m.dirty = true;
    writeMarker(m);
  }

  function markSynced(updatedAt) {
    writeMarker({
      user: authUser ? authUser.id : '',
      syncedAt: updatedAt,
      dirty: false
    });
  }

  /* --- Start-Entscheidung --------------------------------------------------
     Reine Funktion, damit sie sich ohne Netz durchtesten laesst.
     row    = { data, updatedAt } aus der Cloud oder null
     local  = Spielstand aus dem localStorage oder null
     marker = Sync-Marker oder null, uid = Konto-Id.
     Client-Uhren sind nicht vergleichbar — verglichen wird deshalb nur, ob
     der Cloud-Stand noch der ist, den dieses Geraet zuletzt selbst
     hochgeladen hat (syncedAt), und ob seither lokal etwas dazukam (dirty). */
  function decideBoot(row, local, marker, uid) {
    if (!row && !local) return 'fresh';
    if (!row) return 'adopt';
    if (!local) return 'cloud';
    /* Lokaler Stand von einem anderen (oder gar keinem) Konto: Cloud zaehlt. */
    if (!marker || marker.user !== uid) return 'cloud';
    var unchanged = String(row.updatedAt) === String(marker.syncedAt);
    if (unchanged) return marker.dirty ? 'local' : 'cloud';
    return marker.dirty ? 'ask' : 'cloud';
  }

  /* --- Fehlertexte ---------------------------------------------------------- */

  function mapError(err) {
    var msg = String((err && (err.message || err.error_description)) || err || '');
    if (/invalid login credentials/i.test(msg)) return 'E-Mail oder Passwort ist falsch.';
    if (/already registered/i.test(msg)) return 'Diese E-Mail ist bereits registriert.';
    if (/password should|at least 6/i.test(msg)) return 'Das Passwort braucht mindestens 6 Zeichen.';
    if (/rate limit|too many/i.test(msg)) return 'Zu viele Versuche — warte kurz und probier es nochmal.';
    if (/valid email|invalid format|unable to validate/i.test(msg)) return 'Das ist keine gültige E-Mail-Adresse.';
    if (/not confirmed/i.test(msg)) return 'Diese E-Mail ist noch nicht bestätigt — schau in dein Postfach.';
    if (/failed to fetch|networkerror|load failed|network request/i.test(msg)) return 'Keine Verbindung zum Server.';
    return msg || 'Unbekannter Fehler.';
  }

  /* --- Aufbau --------------------------------------------------------------- */

  function init() {
    if (!window.supabase || !window.fetch || !MF.cloudConfig
        || !MF.cloudConfig.url || !MF.cloudConfig.anonKey) {
      supported = false;
      return;
    }
    try {
      client = window.supabase.createClient(MF.cloudConfig.url, MF.cloudConfig.anonKey);
    } catch (err) {
      supported = false;
      return;
    }
    supported = true;

    client.auth.onAuthStateChange(function (event, sess) {
      authUser = (sess && sess.user) ? { id: sess.user.id, email: sess.user.email } : null;
      if (event === 'PASSWORD_RECOVERY') MF.core.events.emit('cloud:recovery');
      if (event === 'SIGNED_OUT') {
        if (quietSignOut) { quietSignOut = false; return; }
        MF.core.events.emit('cloud:signedout');
      }
    });

    /* Der Upload haengt sich an die vorhandenen Speicherpunkte — keiner der
       Save-Aufrufer im Spiel weiss von der Cloud. */
    MF.core.events.on('save:done', function () {
      markDirty();
      schedulePush();
    });
  }

  function isSupported() { return supported; }

  function user() { return authUser; }

  function getSession(done) {
    client.auth.getSession().then(function (res) {
      var sess = (res && res.data) ? res.data.session : null;
      authUser = (sess && sess.user) ? { id: sess.user.id, email: sess.user.email } : null;
      done(sess);
    })['catch'](function () {
      done(null);
    });
  }

  /* --- Konto ----------------------------------------------------------------
     Alle Rueckrufe: done(fehlertext | null). */

  function signIn(email, pw, done) {
    client.auth.signInWithPassword({ email: email, password: pw }).then(function (res) {
      if (res.error) { done(mapError(res.error)); return; }
      var u = res.data && res.data.user;
      authUser = u ? { id: u.id, email: u.email } : null;
      done(null);
    })['catch'](function (err) { done(mapError(err)); });
  }

  function signUp(email, pw, done) {
    client.auth.signUp({ email: email, password: pw }).then(function (res) {
      if (res.error) { done(mapError(res.error)); return; }
      /* Ohne Session ist die E-Mail-Bestaetigung eingeschaltet — dann geht es
         erst nach dem Klick in der Mail weiter. */
      if (!res.data || !res.data.session) {
        done('Fast geschafft — bestätige zuerst deine E-Mail und melde dich dann an.');
        return;
      }
      var u = res.data.user;
      authUser = u ? { id: u.id, email: u.email } : null;
      done(null);
    })['catch'](function (err) { done(mapError(err)); });
  }

  function signOut(done) {
    quietSignOut = true;
    client.auth.signOut().then(function () {
      authUser = null;
      if (done) done(null);
    })['catch'](function () {
      /* Auch wenn der Server nicht antwortet: lokal ist die Sitzung weg. */
      authUser = null;
      if (done) done(null);
    });
  }

  function sendReset(email, done) {
    client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    }).then(function (res) {
      done(res.error ? mapError(res.error) : null);
    })['catch'](function (err) { done(mapError(err)); });
  }

  function updatePassword(pw, done) {
    client.auth.updateUser({ password: pw }).then(function (res) {
      done(res.error ? mapError(res.error) : null);
    })['catch'](function (err) { done(mapError(err)); });
  }

  /* --- Spielstand ------------------------------------------------------------ */

  /* done(fehlertext, row) — row = { data, updatedAt } oder null, wenn das
     Konto noch keinen Stand hat. */
  function loadSave(done) {
    if (!authUser) { done('Nicht angemeldet.', null); return; }
    client.from('saves').select('data, updated_at')
      .eq('user_id', authUser.id).maybeSingle()
      .then(function (res) {
        if (res.error) { done(mapError(res.error), null); return; }
        if (!res.data) { done(null, null); return; }
        lastSyncAt = now();
        lastError = null;
        done(null, { data: res.data.data, updatedAt: res.data.updated_at });
      })['catch'](function (err) { done(mapError(err), null); });
  }

  function schedulePush() {
    if (!supported || !authUser) return;
    if (pushTimer) window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(function () {
      pushTimer = null;
      pushNow();
    }, PUSH_DELAY_MS);
  }

  function pushFailed(msg, done) {
    pending = true;
    lastError = msg;
    MF.core.events.emit('cloud:error', { error: msg });
    /* Solange etwas aussteht, wird in Ruhe weiterprobiert. */
    if (!retryTimer) {
      retryTimer = window.setInterval(function () {
        if (!pending) {
          window.clearInterval(retryTimer);
          retryTimer = null;
          return;
        }
        pushNow();
      }, RETRY_SECONDS * 1000);
    }
    if (done) done(msg);
  }

  function pushNow(done) {
    if (!supported || !authUser) { if (done) done('Nicht angemeldet.'); return; }
    if (pushTimer) { window.clearTimeout(pushTimer); pushTimer = null; }
    var s = MF.game.state.get();
    if (!s) { if (done) done('Kein Spielstand.'); return; }

    client.from('saves')
      .upsert({ user_id: authUser.id, data: s })
      .select('updated_at').single()
      .then(function (res) {
        if (res.error) { pushFailed(mapError(res.error), done); return; }
        pending = false;
        lastError = null;
        lastSyncAt = now();
        markSynced(res.data.updated_at);
        MF.core.events.emit('cloud:synced', { at: lastSyncAt });
        if (done) done(null);
      })['catch'](function (err) { pushFailed(mapError(err), done); });
  }

  /* --- Anzeige --------------------------------------------------------------- */

  function status() {
    var m = readMarker();
    return {
      supported: supported,
      signedIn: !!authUser,
      email: authUser ? authUser.email : '',
      lastSyncAt: lastSyncAt,
      secondsAgo: lastSyncAt ? Math.round((now() - lastSyncAt) / 1000) : null,
      pending: pending || !!pushTimer || !!(m && m.dirty),
      error: lastError
    };
  }

  MF.core.cloud = {
    init: init,
    isSupported: isSupported,
    getSession: getSession,
    user: user,
    signIn: signIn,
    signUp: signUp,
    signOut: signOut,
    sendReset: sendReset,
    updatePassword: updatePassword,
    loadSave: loadSave,
    pushNow: pushNow,
    marker: readMarker,
    markSynced: markSynced,
    clearMarker: clearMarker,
    decideBoot: decideBoot,
    status: status
  };
})(window.MacFit);
