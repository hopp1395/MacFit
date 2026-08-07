/* Die Kachel „Freunde": eigener Code, Einladungen, Liste — und der Griff,
   mit dem ein Freund den Stammgast im Rivalenplatz ablöst.

   Gerechnet und geladen wird in game/friends.js; hier steht nur, wie es
   aussieht. Nach jeder Aktion kommt die Antwort aus dem Ereignis
   'friends:changed' (verdrahtet in js/main.js) — deshalb zeichnet keine
   Funktion hier von sich aus neu.

   Die Freischaltung ist bewusst ein eigener Schritt und keine Nebenwirkung
   des Hinschauens: erst danach liegt überhaupt ein Profil in der Cloud, und
   erst dann kann jemand den eigenen Code finden. Was dabei sichtbar wird,
   steht vorher da — nicht im Kleingedruckten. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;

  function state() { return MF.game.state.get(); }
  function game() { return MF.game.friends; }

  function fullCode(code) { return 'MF-' + code; }

  /* ---------- Kleinteile ---------------------------------------------------- */

  function meta(f) {
    if (f.gone) return 'Hat die Freunde-Funktion abgeschaltet.';
    return 'Level ' + f.level + ' · ' + util.formatKg(f.mass)
      + ' · FIT ' + f.fit + ' · Tag ' + f.day;
  }

  function slimBtn(label, tone, onTap) {
    var btn = el('button.btn.btn--' + (tone || 'ghost') + '.btn--slim',
      { type: 'button', text: label });
    util.onTap(btn, onTap);
    return btn;
  }

  /* Eine Zeile in einer der drei Listen. actions ist ein Feld von Knöpfen. */
  function row(f, actions) {
    return el('div.friend' + (f.gone ? '.is-gone' : ''), null, [
      el('span.friend__icon', { text: f.icon }),
      el('div.friend__who', null, [
        el('div.friend__name', { text: f.name }),
        el('div.friend__meta', { text: meta(f) })
      ]),
      el('div.friend__actions', null, actions)
    ]);
  }

  function after(err, goodText) {
    if (err) { MF.ui.toast.show(err, 'bad'); return; }
    if (goodText) MF.ui.toast.show(goodText, 'good');
  }

  /* ---------- Der eigene Code ----------------------------------------------- */

  /* Teilen, wenn das Gerät es kann — sonst in die Zwischenablage, sonst
     wenigstens groß im Toast. Auf dem Handy ist die Teilen-Auswahl der
     kürzeste Weg in einen Chat, und genau dorthin gehört ein Code. */
  function shareCode() {
    var code = fullCode(game().code());
    var text = 'Mein MacFit-Freundescode: ' + code;

    if (window.navigator && window.navigator.share) {
      try {
        window.navigator.share({ title: 'MacFit', text: text })['catch'](function () {});
        return;
      } catch (err) { /* weiter unten */ }
    }
    if (window.navigator && window.navigator.clipboard) {
      window.navigator.clipboard.writeText(code).then(function () {
        MF.ui.toast.show('Freundescode kopiert: ' + code, 'good');
      })['catch'](function () {
        MF.ui.toast.show('Dein Freundescode: ' + code);
      });
      return;
    }
    MF.ui.toast.show('Dein Freundescode: ' + code);
  }

  function codeBox() {
    var box = el('div.savebox');
    box.appendChild(el('div.savebox__head', null, [
      el('span.savebox__dot.is-ok'),
      el('strong', { text: '🎟️ Dein Freundescode' })
    ]));

    var codeNode = el('div.friend__code.is-tap', { text: fullCode(game().code()) });
    util.onTap(codeNode, shareCode);
    box.appendChild(codeNode);

    box.appendChild(el('span.savebox__text', {
      text: 'Gib ihn weiter, dann kann dich jemand einladen. Antippen zum Teilen '
          + 'oder Kopieren. Er verrät nichts über dein Konto — deine E-Mail und '
          + 'dein Spielstand bleiben, wo sie sind.'
    }));
    return box;
  }

  /* ---------- Einladen ------------------------------------------------------- */

  function inviteForm() {
    var wrap = el('div.friend__invite');

    var input = el('input.field', {
      type: 'text',
      placeholder: 'Code, z. B. MF-K7P2QX',
      autocapitalize: 'characters',
      autocomplete: 'off',
      spellcheck: 'false',
      maxlength: '12'
    });
    wrap.appendChild(input);

    var btn = el('button.btn.btn--ghost.btn--slim', { type: 'button', text: 'Einladen' });
    util.onTap(btn, function () {
      var raw = input.value;
      if (!String(raw || '').trim()) {
        MF.ui.toast.show('Trag erst den Code deines Freundes ein.', 'warn');
        return;
      }
      btn.disabled = true;
      game().sendInvite(raw, function (err, name) {
        btn.disabled = false;
        if (err) { MF.ui.toast.show(err, 'warn'); return; }
        input.value = '';
        MF.ui.toast.show('Einladung an ' + name + ' ist raus.', 'good');
      });
    });
    wrap.appendChild(btn);

    return wrap;
  }

  /* ---------- Die drei Listen ------------------------------------------------ */

  function invitesBlock(list) {
    if (!list.length) return null;
    var box = el('div.friend__group');
    box.appendChild(el('div.rival__cmp-title', {
      text: list.length === 1 ? 'Einladung' : list.length + ' Einladungen'
    }));

    list.forEach(function (f) {
      box.appendChild(row(f, [
        slimBtn('Annehmen', 'primary', function () {
          game().acceptInvite(f.linkId, function (err) {
            after(err, f.name + ' ist jetzt dein Freund.');
          });
        }),
        slimBtn('Ablehnen', 'ghost', function () {
          game().drop(f.linkId, function (err) { after(err, 'Einladung abgelehnt.'); });
        })
      ]));
    });
    return box;
  }

  function sentBlock(list) {
    if (!list.length) return null;
    var box = el('div.friend__group');
    box.appendChild(el('div.rival__cmp-title', { text: 'Gesendet — warten auf Antwort' }));

    list.forEach(function (f) {
      box.appendChild(row(f, [
        slimBtn('Zurückziehen', 'ghost', function () {
          game().drop(f.linkId, function (err) { after(err, 'Einladung zurückgezogen.'); });
        })
      ]));
    });
    return box;
  }

  /* Der Knopf, um den es eigentlich geht: den Freund an die Stelle des
     Stammgasts setzen. Vor Level 2 gibt es gar keinen Rivalenplatz. */
  function rivalButton(f) {
    if (f.gone) return null;

    if (game().isRival(f)) {
      return slimBtn('Stammgast zurück', 'ghost', function () {
        MF.game.rival.useNpc();
        MF.game.state.saveNow();
        MF.core.events.emit('friends:changed');
        MF.ui.toast.show('Neben dir trainiert wieder ein Stammgast.', 'good');
      });
    }

    if (!MF.game.rival.active()) {
      var locked = slimBtn('Als Rivale', 'ghost', function () {
        MF.ui.toast.show('Den Rivalenplatz gibt es ab Level '
          + MF.game.rival.UNLOCK_LEVEL + '.', 'warn');
      });
      locked.classList.add('is-locked');
      return locked;
    }

    return slimBtn('Als Rivale', 'primary', function () {
      if (!game().useAsRival(f)) return;
      MF.core.events.emit('friends:changed');
      MF.ui.toast.show(f.name + ' trainiert ab jetzt neben dir.', 'good');
    });
  }

  function listBlock(list) {
    var box = el('div.friend__group');
    box.appendChild(el('div.rival__cmp-title', {
      text: list.length ? 'Deine Freunde (' + list.length + ')' : 'Noch keine Freunde'
    }));

    if (!list.length) {
      box.appendChild(el('p.hint', {
        text: 'Schick deinen Code an jemanden, der auch MacFit spielt — oder trag '
            + 'unten seinen ein. Sobald ihr verbunden seid, kannst du ihn '
            + 'anstelle der Stammgäste neben dich stellen.'
      }));
      return box;
    }

    list.forEach(function (f) {
      var actions = [];
      var rv = rivalButton(f);
      if (rv) actions.push(rv);
      actions.push(slimBtn('Entfernen', 'ghost', function () {
        MF.ui.modal.confirm({
          title: 'Freund entfernen?',
          text: f.name + ' verschwindet aus deiner Liste und du aus seiner. '
              + 'Ihr könnt euch jederzeit neu einladen.',
          confirmLabel: 'Entfernen',
          onConfirm: function () {
            game().drop(f.linkId, function (err) { after(err, f.name + ' entfernt.'); });
          }
        });
      }));

      var node = row(f, actions);
      if (game().isRival(f)) {
        node.classList.add('is-rival');
        node.appendChild(el('span.friend__flag', { text: 'trainiert neben dir' }));
      }
      box.appendChild(node);
    });

    return box;
  }

  /* ---------- Freischalten und abschalten ------------------------------------ */

  function offerBox() {
    var box = el('div.savebox');
    box.appendChild(el('div.savebox__head', null, [
      el('span.savebox__dot.is-warn'),
      el('strong', { text: '🤝 Freunde freischalten' })
    ]));
    box.appendChild(el('span.savebox__text', {
      text: 'Danach bekommst du einen Freundescode. Wer ihn hat, kann dich einladen — '
          + 'und ein angenommener Freund kann anstelle der Stammgäste neben dir '
          + 'trainieren, mit seinen echten Zahlen. Sichtbar werden dabei nur '
          + 'Mitgliedsname, Level, Masse, Fitness-Index, Sätze und deine Figur. '
          + 'Nicht sichtbar: E-Mail, Foto, Geld, Kuren, Spielstand. Abschalten '
          + 'kannst du es jederzeit — dann ist das Profil wieder weg.'
    }));

    var btn = el('button.btn.btn--primary', { type: 'button', text: 'Freunde freischalten' });
    util.onTap(btn, function () {
      btn.disabled = true;
      btn.textContent = 'Einen Moment …';
      game().enable(function (err) {
        if (err) {
          btn.disabled = false;
          btn.textContent = 'Freunde freischalten';
          MF.ui.toast.show('Das hat nicht geklappt: ' + err, 'bad');
          return;
        }
        MF.ui.toast.show('Freunde sind freigeschaltet — dein Code steht oben.', 'good');
      });
    });
    box.appendChild(btn);
    return box;
  }

  function footer() {
    var bar = el('div.friend__foot');

    bar.appendChild(slimBtn('Aktualisieren', 'ghost', function () {
      game().refresh(function (err) {
        after(err, err ? '' : 'Alles auf dem neuesten Stand.');
      });
    }));

    bar.appendChild(slimBtn('Freunde abschalten', 'ghost', function () {
      MF.ui.modal.confirm({
        title: 'Freunde abschalten?',
        text: 'Dein Profil wird gelöscht und alle Verbindungen werden gelöst — auch '
            + 'auf der Gegenseite. Trainiert gerade ein Freund neben dir, rückt ein '
            + 'Stammgast nach. Dein Spielstand bleibt davon unberührt.',
        confirmLabel: 'Abschalten',
        onConfirm: function () {
          game().disable(function (err) {
            after(err, err ? '' : 'Freunde abgeschaltet, dein Profil ist gelöscht.');
          });
        }
      });
    }));

    return bar;
  }

  /* ---------- Der Bereich ----------------------------------------------------- */

  function panel() {
    var box = el('section.friends');
    var f = state().friends;

    box.appendChild(el('div.section-title', null, [
      el('span', { text: 'Freunde' }),
      el('span.section-title__note', {
        text: game().enabled()
          ? (f.list.length === 1 ? '1 Freund' : f.list.length + ' Freunde')
          : 'nicht freigeschaltet'
      })
    ]));

    if (!game().enabled()) {
      box.appendChild(el('p.card__desc', {
        text: 'Die Stammgäste im Studio sind erfunden. Ein Freund ist es nicht: '
            + 'seine Masse, sein Index und seine Sätze kommen aus seinem eigenen '
            + 'Training — und er sieht dich genauso.'
      }));
      box.appendChild(offerBox());
      return box;
    }

    box.appendChild(codeBox());

    var inv = invitesBlock(f.invites);
    if (inv) box.appendChild(inv);

    box.appendChild(listBlock(f.list));

    var sent = sentBlock(f.sent);
    if (sent) box.appendChild(sent);

    box.appendChild(el('div.rival__cmp-title', { text: 'Freund einladen' }));
    box.appendChild(inviteForm());
    box.appendChild(footer());

    return box;
  }

  /* Was unter „Freunde" auf der Kachel steht. Eine wartende Einladung schlägt
     alles andere — sie ist das Einzige hier, das eine Antwort braucht. */
  function tileSub() {
    if (!game().enabled()) return 'aus';
    var f = state().friends;
    if (f.invites.length) {
      return f.invites.length === 1 ? '1 Einladung' : f.invites.length + ' Einladungen';
    }
    if (!f.list.length) return 'noch keine';
    return f.list.length === 1 ? '1 Freund' : f.list.length + ' Freunde';
  }

  MF.ui.friends = { panel: panel, tileSub: tileSub };
})(window.MacFit);
