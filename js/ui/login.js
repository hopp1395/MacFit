/* Anmelde-Gate (MacFit Online). Ohne Konto laeuft das Spiel nicht — das Gate
   liegt als eigener Vollbild-Layer in #gate-root und ist bewusst kein Modal:
   es laesst sich nicht wegtippen, und ein echtes <form> laesst Passwort-
   Manager und Tastatur-Enter normal funktionieren.

   Vier Ansichten in einem: Anmelden, Konto anlegen, Passwort vergessen und
   das neue Passwort nach dem Klick auf den Link aus der Mail. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;

  var TITLES = {
    login: 'Anmelden',
    register: 'Konto anlegen',
    forgot: 'Passwort vergessen',
    newpass: 'Neues Passwort'
  };

  var SUBS = {
    login: 'Melde dich an — dein Spielstand wartet in der Cloud.',
    register: 'Einmal registrieren, dann trainierst du auf jedem Gerät weiter.',
    forgot: 'Wir schicken dir einen Link zum Zurücksetzen an deine E-Mail.',
    newpass: 'Vergib ein neues Passwort für dein Konto.'
  };

  var SUBMITS = {
    login: 'Anmelden',
    register: 'Konto anlegen',
    forgot: 'Link schicken',
    newpass: 'Passwort speichern'
  };

  function root() { return util.byId('gate-root'); }

  function hide() {
    var r = root();
    if (r) util.clear(r);
  }

  /* opts: { onDone, overlay, mode } — onDone laeuft nach erfolgreicher
     Anmeldung (bzw. gespeichertem Passwort), das Gate ist dann schon zu. */
  function show(opts) {
    opts = opts || {};
    var done = opts.onDone || function () {};
    var r = root();
    if (!r) return;

    var mode = opts.mode || 'login';
    var busy = false;

    /* Migration fuer Bestandsspieler: liegt auf dem Geraet ein Stand aus der
       Zeit vor MacFit Online, muss das Gate zwei Dinge leisten — beruhigen
       (der Fortschritt ist nicht weg) und in die richtige Ansicht fuehren.
       Ohne Sync-Marker gab es hier noch nie ein Konto, also ist Registrieren
       der Normalfall, nicht Anmelden. */
    var keep = null;
    if (!opts.overlay && mode !== 'newpass') {
      var localSave = MF.core.storage.load();
      if (localSave && localSave.player && localSave.player.created) {
        keep = { name: localSave.player.name || 'ein Spieler', day: localSave.day || 1 };
        if (!opts.mode && !MF.core.cloud.marker()) mode = 'register';
      }
    }

    function render() {
      util.clear(r);

      var email = null, pw = null;

      if (mode !== 'newpass') {
        email = el('input.field', {
          type: 'email',
          placeholder: 'E-Mail',
          autocomplete: 'email',
          autocapitalize: 'off',
          spellcheck: 'false'
        });
      }
      if (mode !== 'forgot') {
        pw = el('input.field', {
          type: 'password',
          placeholder: mode === 'login' ? 'Passwort' : 'Passwort (mind. 6 Zeichen)',
          autocomplete: mode === 'login' ? 'current-password' : 'new-password'
        });
      }

      var error = el('p.gate__error');
      function fail(msg) {
        error.textContent = msg;
        error.classList.add('is-on');
      }

      var submit = el('button.btn.btn--primary.gate__submit', {
        type: 'submit', text: SUBMITS[mode]
      });

      function go() {
        if (busy) return;
        var mail = email ? String(email.value || '').replace(/\s+/g, '') : '';
        var pass = pw ? String(pw.value || '') : '';
        if (email && !mail) { fail('Bitte trag deine E-Mail ein.'); return; }
        if (pw && !pass) { fail('Bitte trag dein Passwort ein.'); return; }
        if (pw && mode !== 'login' && pass.length < 6) {
          fail('Das Passwort braucht mindestens 6 Zeichen.');
          return;
        }

        busy = true;
        submit.disabled = true;
        submit.textContent = 'Einen Moment…';
        error.classList.remove('is-on');

        function after(err) {
          busy = false;
          submit.disabled = false;
          submit.textContent = SUBMITS[mode];
          if (err) { fail(err); return; }
          if (mode === 'forgot') {
            MF.ui.toast.show('Wenn die Adresse registriert ist, kommt gleich eine E-Mail.', 'good');
            mode = 'login';
            render();
            return;
          }
          if (mode === 'newpass') MF.ui.toast.show('Passwort geändert.', 'good');
          hide();
          done();
        }

        var cloud = MF.core.cloud;
        if (mode === 'login') cloud.signIn(mail, pass, after);
        else if (mode === 'register') cloud.signUp(mail, pass, after);
        else if (mode === 'forgot') cloud.sendReset(mail, after);
        else cloud.updatePassword(pass, after);
      }

      var form = el('form.gate__form');
      if (email) form.appendChild(email);
      if (pw) form.appendChild(pw);
      form.appendChild(error);
      form.appendChild(submit);
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        go();
      });

      function link(text, toMode) {
        var a = el('button.gate__link', { type: 'button', text: text });
        util.onTap(a, function () { mode = toMode; render(); });
        return a;
      }

      var links = el('div.gate__links');
      if (mode === 'login') {
        links.appendChild(link('Neu hier? Konto anlegen', 'register'));
        links.appendChild(link('Passwort vergessen?', 'forgot'));
      } else if (mode === 'register') {
        links.appendChild(link('Schon Mitglied? Anmelden', 'login'));
      } else if (mode === 'forgot') {
        links.appendChild(link('Zurück zur Anmeldung', 'login'));
      }

      var box = el('div.gate__box', null, [
        el('div.gate__logo', { text: 'MacFit' }),
        el('h2.gate__title', { text: TITLES[mode] }),
        el('p.gate__sub', { text: SUBS[mode] }),
        (keep && (mode === 'login' || mode === 'register'))
          ? el('p.gate__keep', {
              text: 'Auf diesem Gerät trainiert ' + keep.name + ' (Tag ' + keep.day + '). '
                  + 'Der Fortschritt bleibt erhalten — nach '
                  + (mode === 'register' ? 'dem Anlegen des Kontos' : 'der Anmeldung')
                  + ' bieten wir die Übernahme an.'
            })
          : null,
        form,
        links
      ]);

      if (mode === 'login' || mode === 'register') {
        box.appendChild(el('p.gate__note', {
          text: 'Gespeichert werden nur deine E-Mail-Adresse und dein Spielstand — '
              + 'bei Supabase in Frankfurt (EU). Kein Tracking, keine Werbung. '
              + 'Konto löschen: kurze Mail an hopp1395@gmail.com.'
        }));
      }

      r.appendChild(el('div.gate' + (opts.overlay ? '.gate--overlay' : ''), null, [box]));
    }

    render();
  }

  /* Nach dem Klick auf den Link aus der Passwort-Mail: die Sitzung besteht
     schon, es fehlt nur das neue Passwort. Liegt ueber allem, was gerade
     laeuft. */
  function showNewPassword(onDone) {
    show({ mode: 'newpass', overlay: true, onDone: onDone });
  }

  /* Endstation ohne Formular: Browser zu alt, Konfiguration fehlt oder kein
     Netz beim allerersten Start. */
  function showBlocked(text) {
    var r = root();
    if (!r) return;
    util.clear(r);

    var reload = el('button.btn.btn--primary', { type: 'button', text: 'Neu laden' });
    util.onTap(reload, function () { window.location.reload(); });

    r.appendChild(el('div.gate', null, [
      el('div.gate__box', null, [
        el('div.gate__logo', { text: 'MacFit' }),
        el('h2.gate__title', { text: 'Da klemmt was' }),
        el('p.gate__sub', { text: text }),
        reload
      ])
    ]));
  }

  MF.ui.login = {
    show: show,
    hide: hide,
    showNewPassword: showNewPassword,
    showBlocked: showBlocked
  };
})(window.MacFit);
