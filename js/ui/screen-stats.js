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
        /* Ein Meistertitel schlaegt den Levelnamen — er ist erkaempft. */
        title: state().contest.title || MF.game.progression.currentTitle(),
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

  /* Automatisch angelegte Konten (Migration): direkt unter der Karte steht,
     wie der Zugang lautet, und E-Mail plus eigenes Passwort lassen sich
     nachtragen. Das ersetzt den frueheren Datei-Export: mit vollstaendigem
     Konto trainiert man auf jedem weiteren Geraet ohne Einschraenkungen
     weiter, der Stand kommt automatisch mit. Verschwindet, sobald eine
     echte Adresse am Konto haengt. */
  function accountHintPanel() {
    var cloud = MF.core.cloud;
    var cs = cloud.status();
    if (!cs.signedIn || !cloud.isMemberEmail(cs.email)) return null;

    var p = state().player;
    var box = el('section.savebox', { id: 'account-hint' });

    box.appendChild(el('div.savebox__head', null, [
      el('span.savebox__dot.is-warn'),
      el('strong', { text: '✉️ Konto vervollständigen' })
    ]));
    box.appendChild(el('span.savebox__text', {
      text: 'Dein Konto wurde automatisch aus der Mitgliedskarte angelegt — '
          + 'Benutzername: ' + cloud.memberUsername(p.name, p.number)
          + ', Passwort: deine Mitgliedsnummer. Trag E-Mail und eigenes Passwort '
          + 'nach: danach meldest du dich damit auf jedem weiteren Gerät an und '
          + 'trainierst ohne Einschränkungen weiter — dein Stand kommt '
          + 'automatisch mit.'
    }));

    var mailInput = el('input.field', {
      type: 'email',
      placeholder: 'deine@mail.de',
      autocomplete: 'email',
      autocapitalize: 'off',
      spellcheck: 'false'
    });
    box.appendChild(mailInput);

    var pwInput = el('input.field', {
      type: 'password',
      placeholder: 'Neues Passwort (mind. 6 Zeichen, freiwillig)',
      autocomplete: 'new-password'
    });
    box.appendChild(pwInput);

    var btn = el('button.btn.btn--ghost.btn--slim', { type: 'button', text: 'E-Mail übernehmen' });
    util.onTap(btn, function () {
      var mail = String(mailInput.value || '').replace(/\s+/g, '');
      var pw = String(pwInput.value || '');
      if (mail.indexOf('@') < 1 || cloud.isMemberEmail(mail)) {
        MF.ui.toast.show('Bitte trag eine echte E-Mail-Adresse ein.', 'warn');
        return;
      }
      if (pw && pw.length < 6) {
        MF.ui.toast.show('Das Passwort braucht mindestens 6 Zeichen.', 'warn');
        return;
      }
      btn.disabled = true;
      cloud.updateEmail(mail, function (err) {
        if (err) {
          btn.disabled = false;
          MF.ui.toast.show('Das hat nicht geklappt: ' + err, 'bad');
          return;
        }
        function finished() {
          btn.disabled = false;
          MF.ui.toast.show('Bestätigungs-Mail ist unterwegs — nach dem Klick darin gilt die neue Adresse.', 'good');
        }
        if (!pw) { finished(); return; }
        cloud.updatePassword(pw, function (err2) {
          if (err2) {
            btn.disabled = false;
            MF.ui.toast.show('E-Mail übernommen, aber das Passwort nicht: ' + err2, 'warn');
            return;
          }
          finished();
        });
      });
    });
    box.appendChild(btn);

    return box;
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

    /* Der zweite Wert neben der Masse: er entscheidet, wie viel davon man
       sieht — und ob gerade Massephase oder Definitionsphase ist. */
    var fat = MF.game.fat;
    var mark = fat.label();
    info.appendChild(el('div.body-info__row', null, [
      el('span', { text: 'Körperfett' }),
      el('strong.is-' + mark.tone, { text: util.formatNum(fat.percent(), 1) + ' %' })
    ]));
    info.appendChild(el('div.bar.bar--fat', null, [
      el('div.bar__fill.is-' + mark.tone, {
        style: 'width:' + (fat.definition() * 100).toFixed(0) + '%'
      })
    ]));
    info.appendChild(el('div.body-info__label', { text: mark.text }));

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

  /* Die Trainer-Analyse — nur wer den Tagessatz zahlt, bekommt Klartext.
     Vor Level 7 taucht das Panel gar nicht auf, danach wirbt es dezent. */
  function trainerPanel() {
    var s = state();
    var trainerDef = MF.data.abos.get('trainer');

    if (!MF.game.abos.trainerActive()) {
      if (s.level < trainerDef.unlockLevel) return null;
      var box = el('div.savebox');
      box.appendChild(el('div.savebox__head', null, [
        el('span.savebox__dot'),
        el('strong', { text: '🎯 Personal Trainer' })
      ]));
      box.appendChild(el('span.savebox__text', {
        text: 'Engagier im Shop einen Trainer — er analysiert Körper und Training '
            + 'und nimmt sich jeden Tag deine schwächsten Partien vor. '
            + util.formatMoney(trainerDef.price) + ' pro Tag, jederzeit kündbar.'
      }));
      return box;
    }

    var a = MF.game.coach.analysis();
    var plan = MF.game.coach.todayTargets();
    var panel = el('section');

    /* Zuerst die Ansage des Tages — dieselbe, die am Eingang kommt. Wer sie
       dort weggetippt hat, findet sie hier wieder. */
    var brief = MF.ui.trainer.panel();
    if (brief) panel.appendChild(brief);

    panel.appendChild(el('div.section-title', { text: '🎯 Trainer-Analyse' }));

    panel.appendChild(el('div.report__block', null, [
      el('div.report__row', null, [
        el('span.report__label', { text: 'Größte Baustelle' }),
        el('strong.report__value.is-warn', { text: a.componentAdvice.name })
      ])
    ]));
    panel.appendChild(el('p.hint', { text: a.componentAdvice.text }));

    var mblock = el('div.report__block');
    a.weakest3.forEach(function (m) {
      mblock.appendChild(el('div.report__row', null, [
        el('span.report__label', { text: m.name }),
        el('strong.report__value.is-flat', { text: 'Stand ' + util.formatNum(m.size, 1) })
      ]));
    });
    panel.appendChild(el('div.report__title', { text: 'Nachholbedarf' }));
    panel.appendChild(mblock);

    a.healthFlags.forEach(function (flag) {
      panel.appendChild(el('p.card__warning', { text: '⚠ ' + flag }));
    });

    /* Der Trainer schaut zuerst auf die Gesundheit — und sagt konkret,
       welche Einheit den schwachen Wert wieder hochholt. */
    if (a.healthTip) {
      var hbox = el('div.savebox' + (a.healthTip.urgent ? '.savebox--bad' : ''), {
        id: 'trainer-health'
      });
      hbox.appendChild(el('div.savebox__head', null, [
        el('span.savebox__dot' + (a.healthTip.urgent ? '.is-bad' : '.is-warn')),
        el('strong', { text: '❤️ Gesundheit zuerst' })
      ]));
      hbox.appendChild(el('span.savebox__text', { text: a.healthTip.text }));
      if (a.healthTip.exercise) {
        var ex = a.healthTip.exercise;
        var toGym = el('button.btn.btn--ghost.btn--slim', {
          type: 'button', text: ex.icon + ' ' + ex.name + ' im Gym'
        });
        util.onTap(toGym, function () {
          state().settings.muscle = ex.muscle;
          MF.game.state.saveSoon();
          MF.ui.router.go('gym');
        });
        hbox.appendChild(toGym);
      }
      panel.appendChild(hbox);
    }

    /* Der Trainer schickt einen auch mal einkaufen — mehrere Vorschläge,
       vom dringendsten abwärts. */
    if (a.shopTips && a.shopTips.length) {
      panel.appendChild(el('div.section-title', null, [
        el('span', { text: 'Einkaufsliste des Trainers' }),
        el('span.section-title__note', { text: a.shopTips.length + ' Vorschläge' })
      ]));
      panel.appendChild(MF.ui.trainer.shopList(a.shopTips));
    }

    if (plan && plan.targets.length) {
      var names = [];
      plan.targets.forEach(function (t) {
        var ex = MF.data.exercises.get(t.exercise);
        var m = MF.data.muscles.get(t.muscle);
        if (ex && m) names.push(m.name + ' (' + ex.name + ')');
      });
      panel.appendChild(el('p.hint', { text: 'Heute dran: ' + names.join(', ') + '.' }));
    }

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
      if (data.injuryDays > 0) {
        note = 'gezerrt — noch ' + data.injuryDays + (data.injuryDays === 1 ? ' Tag' : ' Tage');
      }

      panel.appendChild(el('div.muscle-row' + (m.id === weakest.id ? '.is-weak' : ''), null, [
        el('div.muscle-row__head', null, [
          el('span.muscle-row__name', { text: (data.injuryDays > 0 ? '🤕 ' : '') + m.name }),
          el('span.muscle-row__note' + (data.injuryDays > 0 ? '.is-bad' : ''), { text: note }),
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

  /* Der Verlauf: erst die Kurve, dann die Tage einzeln. Nur die Kurve war zu
     wenig — man sieht daran, dass es aufwaerts ging, aber nicht, woran es lag.
     Die Liste stellt jedem Tag gegenueber, wie viele Saetze er gekostet und
     was die Nacht daraus gemacht hat. Standardmaessig die letzten sieben,
     der Rest auf Wunsch. */
  var HIST_SHORT = 7;
  var histAll = false;

  /* Die Kurve. Welche Reihe gezeichnet wird, entscheidet pick(). */
  function sparkline(rows, pick) {
    var values = rows.map(pick);
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var span = Math.max(0.5, max - min);

    var points = values.map(function (v, i) {
      var x = values.length < 2 ? 50 : (i / (values.length - 1)) * 100;
      var y = 34 - ((v - min) / span) * 30;
      return x.toFixed(2) + ',' + y.toFixed(2);
    }).join(' ');

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 36');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'spark');
    svg.innerHTML = '<polyline points="' + points + '" />';
    return svg;
  }

  /* Eine Zeile im Verlauf. Fehlende Felder kommen aus alten Spielstaenden,
     die nur Tag und Masse gespeichert haben. */
  function historyRow(h, prev) {
    var gain = h.gain;
    if (gain === undefined || gain === null) {
      gain = prev ? util.round(h.mass - prev.mass, 2) : 0;
    }
    var tone = gain > 0.005 ? 'good' : (gain < -0.005 ? 'bad' : 'flat');

    var meta = [];
    if (h.sets !== undefined && h.sets !== null) {
      meta.push(h.sets + (h.sets === 1 ? ' Satz' : ' Sätze'));
    }
    if (h.fit !== undefined && h.fit !== null) meta.push('FIT ' + h.fit);
    if (h.level) meta.push('Lv ' + h.level);

    var row = el('div.hist-row' + (h.sets === 0 ? '.is-rest' : ''), null, [
      el('div.hist-row__head', null, [
        el('span.hist-row__day', { text: 'Tag ' + h.day }),
        el('span.hist-row__mass', { text: util.formatKg(h.mass) }),
        el('strong.hist-row__delta.is-' + tone, {
          text: (gain > 0 ? '+' : '') + util.formatNum(gain, 2) + ' kg'
        })
      ])
    ]);
    if (meta.length) {
      row.appendChild(el('span.hist-row__meta', { text: meta.join(' · ') }));
    }
    return row;
  }

  function historyPanel() {
    var s = state();
    if (!s.history.length) return null;

    var panel = el('section');
    panel.appendChild(el('div.section-title', null, [
      el('span', { text: 'Verlauf' }),
      el('span.section-title__note', {
        text: s.history.length + (s.history.length === 1 ? ' Tag' : ' Tage')
      })
    ]));

    if (s.history.length >= 2) {
      panel.appendChild(sparkline(s.history, function (h) { return h.mass; }));

      var values = s.history.map(function (h) { return h.mass; });
      panel.appendChild(el('div.spark__legend', null, [
        el('span', { text: util.formatKg(Math.min.apply(null, values)) }),
        el('span', { text: 'Muskelmasse' }),
        el('span', { text: util.formatKg(Math.max.apply(null, values)) })
      ]));
    }

    /* Neueste zuerst — was gestern war, interessiert mehr als Tag 3. */
    var rows = s.history.slice();
    var hidden = 0;
    if (!histAll && rows.length > HIST_SHORT) {
      hidden = rows.length - HIST_SHORT;
      rows = rows.slice(hidden);
    }

    var list = el('div.hist', { id: 'hist-list' });
    for (var i = rows.length - 1; i >= 0; i--) {
      var idx = hidden + i;    /* Platz im vollen Verlauf — fuer den Vorgaenger */
      list.appendChild(historyRow(rows[i], idx > 0 ? s.history[idx - 1] : null));
    }
    panel.appendChild(list);

    if (hidden > 0 || histAll) {
      var more = el('button.btn.btn--ghost.btn--slim', {
        type: 'button',
        id: 'hist-more',
        text: histAll ? 'Nur die letzten ' + HIST_SHORT + ' Tage' : 'Alle ' + s.history.length + ' Tage zeigen'
      });
      util.onTap(more, function () {
        histAll = !histAll;
        MF.ui.router.refresh('stats');
      });
      panel.appendChild(more);
    }

    panel.appendChild(el('p.hint', {
      text: 'Jede Zeile ist ein abgeschlossener Tag: links die Gesamtmasse am '
          + 'Morgen danach, rechts, was die Nacht gebracht hat. Tage ohne Satz '
          + 'stehen blass — ohne Reiz wächst nichts, und ab dem fünften Ruhetag '
          + 'geht eine Partie zurück.'
    }));

    return panel;
  }

  function recordsPanel() {
    var s = state();
    var acc = s.stats.totalReps ? (s.stats.perfectReps / s.stats.totalReps) * 100 : 0;
    var st = MF.game.streak.status();
    var panel = el('section');
    panel.appendChild(el('div.section-title', { text: 'Statistik' }));
    panel.appendChild(el('div.report__block', null, [
      statRow('🔥 Serie', st.days === 0
        ? 'noch keine' + (st.best ? ' (Bestwert ' + st.best + ')' : '')
        : st.days + (st.days === 1 ? ' Tag' : ' Tage') + ' in Folge'
          + (st.best > st.days ? ' (Bestwert ' + st.best + ')' : '')),
      statRow('Sätze insgesamt', util.formatNum(s.stats.totalSets)),
      statRow('Wiederholungen', util.formatNum(s.stats.totalReps)),
      statRow('Perfekte Reps', util.formatNum(s.stats.perfectReps) + ' (' + Math.round(acc) + '%)'),
      statRow('Trainingstage', util.formatNum(s.stats.daysTrained) + ' von ' + s.day),
      statRow('Beste Masse', util.formatKg(Math.max(s.stats.peakMass, MF.game.stats.muscleMass())))
    ]));

    /* Die Bühne bekommt einen eigenen Block — sie ist das einzige, wofür
       man antritt statt zu trainieren. */
    if (MF.game.contest.unlocked() || s.contest.entries) {
      panel.appendChild(el('div.section-title', null, [
        el('span', { text: '🏆 Meisterschaften' }),
        el('span.section-title__note', {
          text: MF.game.contest.doneToday() ? 'heute erledigt'
            : 'nächste an Tag ' + MF.game.contest.nextDay()
        })
      ]));

      var rows = [
        statRow('Angetreten', s.contest.entries + (s.contest.entries === 1 ? ' mal' : ' mal')),
        statRow('Siege', String(s.contest.wins)),
        statRow('Beste Platzierung', s.contest.best ? 'Platz ' + s.contest.best : '–'),
        statRow('Titel', s.contest.title || 'noch keiner')
      ];
      panel.appendChild(el('div.report__block', null, rows));

      if (s.contest.history.length) {
        var list = el('div.report__block');
        s.contest.history.slice(-5).reverse().forEach(function (h) {
          var def = MF.data.contest.get(h.klasse);
          list.appendChild(el('div.report__row', null, [
            el('span.report__label', {
              text: 'Tag ' + h.day + ' · ' + (def ? def.name : h.klasse)
            }),
            el('strong.report__value.is-' + (h.rank === 1 ? 'good' : 'flat'), {
              text: 'Platz ' + h.rank + ' von ' + h.starters
            })
          ]));
        });
        panel.appendChild(list);
      }
    }

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
          + ' Dein Spielstand wandert automatisch mit: einfach auf jedem weiteren '
          + 'Gerät anmelden und ohne Einschränkungen weitertrainieren.'
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

    /* Welche Fassung gerade laeuft. Steht sonst nur im Vorspann und am Gate —
       hier ist sie jederzeit nachschlagbar, etwa wenn am Handy unklar ist,
       ob eine Neuerung schon angekommen ist. Ein Tipp sieht sofort nach. */
    var version = el('p.version-note', {
      id: 'version-note',
      text: 'MacFit v' + MF.version + ' · tippen, um auf eine neue Fassung zu prüfen'
    });
    util.onTap(version, function () {
      MF.ui.toast.show('Suche nach einer neuen Fassung …');
      MF.core.update.reloadIfNew(function () {
        MF.ui.toast.show('v' + MF.version + ' ist schon die neueste Fassung.', 'good');
      });
    });
    panel.appendChild(version);

    return panel;
  }

  /* ---------- Bereiche als Kacheln ---------------------------------------- */

  /* Der Koerper-Bildschirm war eine einzige lange Kolonne: Karte, Figur,
     Index, Gesundheit, Partien, Verlauf, Statistik und Einstellungen alle
     untereinander. Am Handy scrollt man daran vorbei, statt etwas zu finden.

     Jetzt sitzt oben dasselbe Kachelraster wie im Gym und im Shop, darunter
     steht nur der gewaehlte Bereich. Sechs Kacheln gehen glatt in die drei
     Spalten des Rasters auf. Die Wahl haengt am Spielstand, damit man nach
     einem Blick ins Gym wieder dort landet, wo man war. */
  var TABS = [
    {
      key: 'figur', name: 'Figur',
      sub: function () { return util.formatKg(MF.game.stats.muscleMass()); }
    },
    {
      key: 'werte', name: 'Werte',
      sub: function () { return 'FIT ' + MF.game.fitness.index(); }
    },
    {
      key: 'partien', name: 'Partien',
      sub: function () {
        var s = state();
        var hurt = MF.data.muscles.ids.filter(function (id) {
          return s.muscles[id].injuryDays > 0;
        }).length;
        if (hurt) return hurt === 1 ? '1 gezerrt' : hurt + ' gezerrt';
        return 'schwach: ' + MF.game.stats.weakestMuscle().name;
      }
    },
    {
      key: 'trainer', name: 'Trainer',
      sub: function () {
        if (MF.game.abos.trainerActive()) return 'im Dienst';
        var def = MF.data.abos.get('trainer');
        return state().level < def.unlockLevel ? 'ab Level ' + def.unlockLevel : 'nicht gebucht';
      }
    },
    {
      key: 'verlauf', name: 'Verlauf',
      sub: function () {
        var n = state().history.length;
        return n ? n + (n === 1 ? ' Tag' : ' Tage') : 'noch leer';
      }
    },
    {
      key: 'system', name: 'Einstellungen',
      sub: function () { return 'v' + MF.version; }
    }
  ];

  function activeTab() {
    var want = state().settings.bodyTab;
    for (var i = 0; i < TABS.length; i++) {
      if (TABS[i].key === want) return want;
    }
    return 'figur';
  }

  function tabGrid() {
    var current = activeTab();
    var grid = el('div.mgrid');

    TABS.forEach(function (t) {
      var tile = el('button.mtile' + (current === t.key ? '.is-active' : ''),
        { type: 'button' }, [
          el('span.mtile__name', { text: t.name }),
          el('span.mtile__sub', { text: t.sub() })
        ]);
      util.onTap(tile, function () {
        state().settings.bodyTab = t.key;
        MF.game.state.saveSoon();
        MF.ui.router.refresh('stats');
      });
      grid.appendChild(tile);
    });

    return grid;
  }

  function render(container) {
    util.clear(container);

    /* Der Hinweis auf das halbe Konto steht ueber den Kacheln: er ist eine
       einmalige Aufforderung und verschwindet, sobald eine echte Adresse am
       Konto haengt — hinter einer Kachel wuerde er nie gelesen. Der Sprung
       aus dem Dialog am Eingang (js/main.js) landet ebenfalls direkt darauf. */
    var hint = accountHintPanel();
    if (hint) container.appendChild(hint);

    container.appendChild(tabGrid());

    var tab = activeTab();

    if (tab === 'figur') {
      container.appendChild(cardPanel());
      container.appendChild(sharePanel());
      container.appendChild(avatarPanel());
      return;
    }

    if (tab === 'werte') {
      container.appendChild(fitnessPanel());
      container.appendChild(healthPanel());
      return;
    }

    if (tab === 'partien') {
      container.appendChild(musclePanel());
      return;
    }

    if (tab === 'trainer') {
      var rival = MF.ui.rival.panel();
      if (rival) container.appendChild(rival);
      var trainer = trainerPanel();
      if (trainer) container.appendChild(trainer);
      if (!rival && !trainer) {
        container.appendChild(el('p.hint', {
          text: 'Noch ist hier niemand. Ein Rivale findet sich von selbst, '
              + 'sobald du ein paar Tage trainiert hast — einen Personal Trainer '
              + 'engagierst du im Shop.'
        }));
      }
      return;
    }

    if (tab === 'verlauf') {
      var histPanel = historyPanel();
      if (histPanel) container.appendChild(histPanel);
      else {
        container.appendChild(el('p.hint', {
          text: 'Der Verlauf beginnt nach der ersten Nacht — schlaf einmal, '
              + 'dann steht hier, was daraus geworden ist.'
        }));
      }
      container.appendChild(recordsPanel());
      return;
    }

    container.appendChild(settingsPanel());
  }

  MF.ui.router.register('stats', { elementId: 'screen-stats', render: render });

  /* Von aussen gezielt in einen Bereich springen. Seit der Bildschirm in
     Kacheln geteilt ist, reicht router.go('stats') nicht mehr: der Knopf in
     der Kopfleiste, der Vergleich beim Rivalen und die Analyse des Trainers
     landeten sonst auf der zuletzt gewaehlten Kachel statt auf der gemeinten. */
  function go(tab) {
    state().settings.bodyTab = tab;
    MF.game.state.saveSoon();
    MF.ui.router.go('stats');
  }

  /* Die Aufschluesselung wird auch woanders gebraucht: der FIT-Wert in der
     Kopfleiste zeigt sie beim Antippen im Fenster. */
  MF.ui.stats = { fitnessPanel: fitnessPanel, go: go };
})(window.MacFit);
