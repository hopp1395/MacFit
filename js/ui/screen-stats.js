/* Körper: Avatar, Werte, Gesundheit, Verlauf und Einstellungen. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;

  var HEALTH = [
    { key: 'herz', label: 'Herz', icon: '❤️' },
    { key: 'leber', label: 'Leber', icon: '🫀' },
    { key: 'schlaf', label: 'Schlaf', icon: '😴' },
    { key: 'laune', label: 'Laune', icon: '🙂' }
  ];

  var avatarSvg = null;

  function state() { return MF.game.state.get(); }

  function healthTone(v) {
    if (v >= 70) return 'good';
    if (v >= 40) return 'warn';
    return 'bad';
  }

  /* Mitgliedskarte samt Foto. Das Foto lässt sich hier jederzeit tauschen —
     die Anlage läuft ja nur einmal. */
  function cardPanel() {
    var host = el('section.mcard-host');

    function draw() {
      MF.ui.membercard.mount(host, {
        id: 'stats-card',
        data: function () { return state().player; },
        title: MF.game.progression.currentTitle(),
        editable: true,
        onPhoto: function (url) {
          var p = state().player;
          var before = p.photo || '';
          p.photo = url || '';
          if (MF.game.state.saveNow() === 'error') {
            p.photo = before;
            MF.game.state.saveNow();
            MF.ui.toast.show('Das Foto passt nicht in den Speicher.', 'warn');
          } else {
            MF.ui.toast.show(url ? 'Foto übernommen.' : 'Foto entfernt.', 'good');
          }
          draw();
        }
      });
    }

    draw();
    return host;
  }

  /* Erfolge teilen. Sitzt direkt unter der Karte — geteilt wird die Identität
     samt Werten, nicht irgendeine Zahl aus der Tiefe des Bildschirms. */
  function sharePanel() {
    var btn = el('button.btn.btn--share', { type: 'button', text: '📤 Erfolge teilen' });
    util.onTap(btn, function () { MF.ui.share.show(); });
    return btn;
  }

  function avatarPanel() {
    var s = state();
    var panel = el('section.body-panel');

    var stage = el('div.avatar');
    avatarSvg = MF.ui.avatar.create(stage);
    MF.ui.avatar.update(avatarSvg);

    var info = el('div.body-info');
    info.appendChild(el('div.body-info__mass', { text: util.formatKg(MF.game.stats.muscleMass()) }));
    info.appendChild(el('div.body-info__label', { text: 'Muskelmasse' }));
    info.appendChild(el('div.body-info__title', { text: MF.game.progression.currentTitle() }));

    var sym = MF.game.stats.symmetry();
    info.appendChild(el('div.body-info__row', null, [
      el('span', { text: 'Symmetrie' }),
      el('strong.is-' + healthTone(sym), { text: Math.round(sym) + '%' })
    ]));
    info.appendChild(el('div.body-info__row', null, [
      el('span', { text: 'Wachstum' }),
      el('strong', { text: '×' + util.formatNum(MF.game.stats.growthMultiplier(), 2) })
    ]));
    info.appendChild(el('div.body-info__row', null, [
      el('span', { text: 'Trefferzone' }),
      el('strong', { text: '×' + util.formatNum(MF.game.stats.focusMultiplier(), 2) })
    ]));

    var ceiling = MF.game.stats.sizeCeiling();
    info.appendChild(el('div.body-info__row', null, [
      el('span', { text: 'Limit' }),
      el('strong' + (ceiling > MF.game.stats.NATURAL_CEILING ? '.is-warn' : ''), {
        text: util.formatNum(ceiling, 0)
      })
    ]));
    if (s.stats.natural) {
      info.appendChild(el('div.badge.badge--natural', { text: '🌿 Natural' }));
    }

    panel.appendChild(stage);
    panel.appendChild(info);
    return panel;
  }

  /* Der Fitness-Index mit Aufschlüsselung — sonst bleibt die Zahl beliebig. */
  function fitnessPanel() {
    var p = MF.game.fitness.parts();
    var rank = MF.game.fitness.rank(p.index);
    var next = MF.game.fitness.nextRank(p.index);

    var panel = el('section.fit-panel');

    panel.appendChild(el('div.fit-head', null, [
      el('div.fit-head__main', null, [
        el('div.fit-head__value.is-' + rank.tone, { text: String(p.index) }),
        el('div.fit-head__scale', { text: '/ ' + MF.game.fitness.MAX })
      ]),
      el('div.fit-head__side', null, [
        el('div.fit-head__label', { text: 'Fitness-Index' }),
        el('div.fit-head__rank.is-' + rank.tone, { text: rank.name }),
        el('div.fit-head__next', {
          text: next
            ? (next.min - p.index) + ' bis „' + next.name + '“'
            : 'Höchste Stufe erreicht'
        })
      ])
    ]));

    panel.appendChild(el('div.bar.bar--fit', null, [
      el('div.bar__fill', { style: 'width:' + (p.index / MF.game.fitness.MAX * 100).toFixed(1) + '%' })
    ]));

    p.components.forEach(function (c) {
      panel.appendChild(el('div.fit-row', null, [
        el('span.fit-row__name', { text: c.name }),
        el('div.bar.bar--fit-part', null, [
          el('div.bar__fill', { style: 'width:' + (c.value * 100).toFixed(0) + '%' })
        ]),
        el('span.fit-row__weight', { text: c.weight })
      ]));
    });

    panel.appendChild(el('p.hint', {
      text: 'Die Muskelmasse gibt den Grundwert vor (' + p.massScore + ' Punkte), '
          + 'die vier übrigen Werte strecken oder stauchen ihn auf ×'
          + util.formatNum(p.quality, 2) + '. Einseitiges Training, kaputte '
          + 'Gesundheit und schlampige Form kosten also Index, ohne dass Masse verloren geht.'
    }));

    return panel;
  }

  function healthPanel() {
    var s = state();
    var label = MF.game.stats.healthLabel();
    var panel = el('section');

    panel.appendChild(el('div.section-title', null, [
      el('span', { text: 'Gesundheit' }),
      el('span.section-title__note.is-' + label.tone, { text: label.text })
    ]));

    HEALTH.forEach(function (h) {
      var v = s.health[h.key];
      panel.appendChild(el('div.stat-row', null, [
        el('span.stat-row__icon', { text: h.icon }),
        el('span.stat-row__label', { text: h.label }),
        el('div.bar.bar--health', null, [
          el('div.bar__fill.is-' + healthTone(v), { style: 'width:' + v.toFixed(0) + '%' })
        ]),
        el('span.stat-row__value', { text: Math.round(v) })
      ]));
    });

    return panel;
  }

  function musclePanel() {
    var s = state();
    var panel = el('section');
    panel.appendChild(el('div.section-title', { text: 'Muskelpartien' }));

    var weakest = MF.game.stats.weakestMuscle();

    MF.data.muscles.list.forEach(function (m) {
      var data = s.muscles[m.id];
      var since = s.day - data.lastTrainedDay;
      var note = data.lastTrainedDay === 0
        ? 'noch nie trainiert'
        : (since === 0 ? 'heute trainiert' : 'vor ' + since + ' Tagen');

      panel.appendChild(el('div.muscle-row' + (m.id === weakest.id ? '.is-weak' : ''), null, [
        el('div.muscle-row__head', null, [
          el('span.muscle-row__name', { text: m.name }),
          el('span.muscle-row__note', { text: note }),
          el('span.muscle-row__value', { text: util.formatNum(data.size, 1) })
        ]),
        el('div.bar.bar--muscle', null, [
          el('div.bar__fill', { style: 'width:' + data.size.toFixed(1) + '%' }),
          el('div.bar__ghost', { style: 'width:' + (data.fatigue * 100).toFixed(0) + '%' })
        ])
      ]));
    });

    panel.appendChild(el('p.hint', {
      text: 'Der graue Balken zeigt die Ermüdung. Partien, die länger als vier Tage '
          + 'liegen bleiben, gehen langsam zurück. Natürlich ist bei '
          + MF.game.stats.NATURAL_CEILING + ' Schluss — höher kommt nur, wer nachhilft, '
          + 'und fällt nach der Kur wieder zurück.'
    }));

    return panel;
  }

  function historyPanel() {
    var s = state();
    if (s.history.length < 2) return null;

    var panel = el('section');
    panel.appendChild(el('div.section-title', { text: 'Verlauf' }));

    var values = s.history.map(function (h) { return h.mass; });
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var span = Math.max(0.5, max - min);

    var points = values.map(function (v, i) {
      var x = (i / (values.length - 1)) * 100;
      var y = 34 - ((v - min) / span) * 30;
      return x.toFixed(2) + ',' + y.toFixed(2);
    }).join(' ');

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 36');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'spark');
    svg.innerHTML = '<polyline points="' + points + '" />';
    panel.appendChild(svg);

    panel.appendChild(el('div.spark__legend', null, [
      el('span', { text: util.formatKg(min) }),
      el('span', { text: s.history.length + ' Tage' }),
      el('span', { text: util.formatKg(max) })
    ]));

    return panel;
  }

  function recordsPanel() {
    var s = state();
    var acc = s.stats.totalReps ? (s.stats.perfectReps / s.stats.totalReps) * 100 : 0;
    var panel = el('section');
    panel.appendChild(el('div.section-title', { text: 'Statistik' }));
    panel.appendChild(el('div.report__block', null, [
      statRow('Sätze insgesamt', util.formatNum(s.stats.totalSets)),
      statRow('Wiederholungen', util.formatNum(s.stats.totalReps)),
      statRow('Perfekte Reps', util.formatNum(s.stats.perfectReps) + ' (' + Math.round(acc) + '%)'),
      statRow('Trainingstage', util.formatNum(s.stats.daysTrained) + ' von ' + s.day),
      statRow('Beste Masse', util.formatKg(Math.max(s.stats.peakMass, MF.game.stats.muscleMass())))
    ]));
    return panel;
  }

  function statRow(label, value) {
    return el('div.report__row', null, [
      el('span.report__label', { text: label }),
      el('strong.report__value.is-flat', { text: value })
    ]);
  }

  /* Konto und Cloud-Stand. Der eigentliche Abgleich laeuft von selbst nach
     jedem Speicherpunkt — hier stehen Status und die drei Handgriffe, die
     man ab und zu braucht. */
  function accountBox() {
    var cs = MF.core.cloud.status();
    var box = el('div.savebox' + (cs.error ? '.savebox--bad' : ''));

    box.appendChild(el('div.savebox__head', null, [
      el('span.savebox__dot' + (cs.error ? '.is-bad' : '.is-ok')),
      el('strong', { text: '☁️ Konto' })
    ]));

    box.appendChild(el('span.savebox__text', {
      text: (cs.signedIn ? 'Angemeldet als ' + cs.email + '.' : 'Nicht angemeldet.')
          + (cs.secondsAgo === null ? '' : ' Zuletzt synchronisiert vor ' + cs.secondsAgo + ' s.')
          + (cs.error ? ' Verbindung gestört: ' + cs.error : '')
    }));

    var row = el('div.savebox__row');

    var syncBtn = el('button.btn.btn--ghost.btn--slim', { type: 'button', text: 'Jetzt synchronisieren' });
    util.onTap(syncBtn, function () {
      MF.game.state.saveNow();
      MF.core.cloud.pushNow(function (err) {
        MF.ui.toast.show(
          err ? 'Synchronisieren fehlgeschlagen: ' + err : 'Spielstand liegt in der Cloud.',
          err ? 'bad' : 'good'
        );
        MF.ui.router.refresh('stats');
      });
    });
    row.appendChild(syncBtn);

    var pwBtn = el('button.btn.btn--ghost.btn--slim', { type: 'button', text: 'Passwort ändern' });
    util.onTap(pwBtn, function () {
      MF.core.cloud.sendReset(cs.email, function (err) {
        MF.ui.toast.show(
          err ? 'Das hat nicht geklappt: ' + err : 'E-Mail zum Passwort-Ändern ist unterwegs.',
          err ? 'bad' : 'good'
        );
      });
    });
    row.appendChild(pwBtn);

    var outBtn = el('button.btn.btn--ghost.btn--slim', { type: 'button', text: 'Abmelden' });
    util.onTap(outBtn, function () {
      MF.ui.modal.confirm({
        title: 'Abmelden?',
        text: 'Der Spielstand bleibt in der Cloud erhalten und wird von diesem Gerät '
            + 'entfernt. Beim nächsten Anmelden geht es genau hier weiter.',
        confirmLabel: 'Abmelden',
        onConfirm: function () {
          MF.game.state.saveNow();
          /* Erst sicher in die Cloud, dann raus — sonst waere der letzte
             Fortschritt nur auf diesem Geraet und gleich darauf geloescht. */
          MF.core.cloud.pushNow(function (err) {
            if (err) {
              MF.ui.toast.show('Nicht abgemeldet: der Stand ließ sich nicht in die Cloud '
                + 'schreiben (' + err + ').', 'bad');
              return;
            }
            MF.core.cloud.signOut(function () {
              MF.core.storage.reset();
              MF.core.cloud.clearMarker();
              window.location.reload();
            });
          });
        }
      });
    });
    row.appendChild(outBtn);

    box.appendChild(row);
    return box;
  }

  /* Profil mitnehmen. Der Spielstand haengt sonst an genau diesem Browser auf
     genau diesem Geraet — ein Handywechsel oder ein geleerter Speicher kostet
     alles. */
  function transferBox() {
    var box = el('div.savebox');
    box.appendChild(el('div.savebox__head', null, [
      el('strong', { text: '💾 Profil sichern und übertragen' })
    ]));
    box.appendChild(el('span.savebox__text', {
      text: 'Zusätzlich zur Cloud — als Datei für den Notfall. Legt eine Datei mit '
          + 'allem an: Fortschritt, Geld, Kuren, Statistik und Mitgliedskarte samt Foto.'
    }));

    var row = el('div.savebox__row');

    var saveBtn = el('button.btn.btn--ghost', { type: 'button', text: '⬇ Datei speichern' });
    util.onTap(saveBtn, function () {
      var res = MF.ui.transfer.exportProfile(false);
      MF.ui.toast.show(
        res === 'error' ? 'Die Datei ließ sich nicht anlegen.' : 'Profil gespeichert: ' + MF.ui.transfer.filename(),
        res === 'error' ? 'bad' : 'good'
      );
    });
    row.appendChild(saveBtn);

    /* Am Handy landet ein Download irgendwo im Dateisystem — das Teilen-Blatt
       ist dort der brauchbarere Weg. */
    if (MF.ui.transfer.canSendFile()) {
      var sendBtn = el('button.btn.btn--ghost', { type: 'button', text: '📤 Profil senden' });
      util.onTap(sendBtn, function () { MF.ui.transfer.exportProfile(true); });
      row.appendChild(sendBtn);
    }

    row.appendChild(MF.ui.transfer.pickButton('transfer-file', '📥 Profil laden', function () {
      MF.ui.router.refresh('stats');
    }));

    box.appendChild(row);
    return box;
  }

  function settingsPanel() {
    var s = state();
    var panel = el('section');
    panel.appendChild(el('div.section-title', { text: 'Einstellungen' }));

    var hapticBtn = el('button.btn.btn--ghost', {
      type: 'button',
      text: (s.settings.haptics ? '✓ ' : '✕ ') + 'Vibration'
    });
    util.onTap(hapticBtn, function () {
      s.settings.haptics = !s.settings.haptics;
      MF.core.haptics.setEnabled(s.settings.haptics);
      MF.game.state.saveSoon();
      MF.ui.router.refresh('stats');
    });
    panel.appendChild(hapticBtn);

    var musicBtn = el('button.btn.btn--ghost', {
      type: 'button',
      text: (s.settings.music ? '✓ ' : '✕ ') + 'Titelmusik'
    });
    util.onTap(musicBtn, function () {
      s.settings.music = !s.settings.music;
      MF.core.audio.setEnabled(s.settings.music);
      MF.game.state.saveSoon();
      MF.ui.router.refresh('stats');
    });
    panel.appendChild(musicBtn);

    var soundBtn = el('button.btn.btn--ghost', {
      type: 'button',
      text: (s.settings.sound ? '✓ ' : '✕ ') + 'Geräusche'
    });
    util.onTap(soundBtn, function () {
      s.settings.sound = !s.settings.sound;
      MF.core.audio.setSfxEnabled(s.settings.sound);
      if (s.settings.sound) MF.core.audio.sfx('perfect');   /* kurze Hörprobe */
      MF.game.state.saveSoon();
      MF.ui.router.refresh('stats');
    });
    panel.appendChild(soundBtn);

    /* Klartext zum Speicherstand — der Punkt im HUD allein sagt zu wenig. */
    var st = MF.core.storage.status();
    var saveBox = el('div.savebox' + (st.available ? '' : '.savebox--bad'));
    saveBox.appendChild(el('div.savebox__head', null, [
      el('span.savebox__dot' + (st.available ? '.is-ok' : '.is-bad')),
      el('strong', { text: st.available ? 'Automatisch gespeichert' : 'Speichern nicht möglich' })
    ]));
    saveBox.appendChild(el('span.savebox__text', {
      text: st.available
        ? 'Nach jedem Satz, jeder Nacht und jedem Einkauf — dazu alle 15 Sekunden '
          + 'und beim Schließen der Seite.'
          + (st.secondsAgo === null ? '' : ' Zuletzt vor ' + st.secondsAgo + ' s.')
        : 'Dieser Browser lässt keine Website-Daten zu (z. B. privater Modus). '
          + 'Der Fortschritt geht beim Schließen verloren.'
    }));

    if (st.available) {
      var saveBtn = el('button.btn.btn--ghost.btn--slim', { type: 'button', text: 'Jetzt speichern' });
      util.onTap(saveBtn, function () {
        var res = MF.game.state.saveNow();
        MF.ui.toast.show(
          res === 'error' ? 'Speichern fehlgeschlagen.' : 'Spielstand gespeichert.',
          res === 'error' ? 'bad' : 'good'
        );
        MF.ui.router.refresh('stats');
      });
      saveBox.appendChild(saveBtn);
    }
    panel.appendChild(saveBox);
    panel.appendChild(accountBox());
    panel.appendChild(transferBox());

    /* Spieler zurücksetzen: löscht den Stand und führt direkt in die Anlage —
       sonst stünde man ohne Namen im Spiel. */
    var resetBtn = el('button.btn.btn--danger', { type: 'button', text: 'Spieler zurücksetzen' });
    util.onTap(resetBtn, function () {
      MF.ui.modal.confirm({
        title: 'Spieler löschen?',
        text: 'Name, Tag, Level, Masse und Geld sind danach weg — auch in der Cloud. '
            + 'Danach legst du einen neuen Spieler an. Das lässt sich nicht '
            + 'rückgängig machen.',
        confirmLabel: 'Löschen',
        onConfirm: function () {
          MF.core.storage.reset();
          MF.game.state.set(MF.game.state.createNewState());
          MF.game.state.saveNow();
          /* Sofort auch die Cloud-Zeile ersetzen — sonst wuerde der naechste
             Start den alten Stand wiederbeleben. */
          MF.core.cloud.pushNow();
          MF.ui.hud.render();
          MF.ui.router.go('gym');
          MF.ui.create.show(function (player) {
            MF.ui.toast.show('Willkommen bei MacFit, ' + player.name + '.', 'good');
          });
        }
      });
    });
    panel.appendChild(resetBtn);

    panel.appendChild(el('p.disclaimer', {
      text: 'MacFit ist ein Spiel und reine Satire. Substanzen, Wirkungen und Zahlen sind '
          + 'frei erfunden und weder Empfehlung noch Anleitung. Wer wirklich trainiert, '
          + 'holt sich Rat bei echten Fachleuten.'
    }));

    return panel;
  }

  function render(container) {
    util.clear(container);
    container.appendChild(cardPanel());
    container.appendChild(sharePanel());
    container.appendChild(avatarPanel());
    container.appendChild(fitnessPanel());
    container.appendChild(healthPanel());
    container.appendChild(musclePanel());
    var hist = historyPanel();
    if (hist) container.appendChild(hist);
    container.appendChild(recordsPanel());
    container.appendChild(settingsPanel());
  }

  MF.ui.router.register('stats', { elementId: 'screen-stats', render: render });
})(window.MacFit);
