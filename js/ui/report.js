/* Die Modals mit Spielinhalt: Tagesreport, Levelaufstieg, Begrüßung. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;

  var HEALTH_LABELS = { herz: 'Herz', leber: 'Leber', schlaf: 'Schlaf', laune: 'Laune' };

  /* So lange dauert eine Nacht, bevor es weitergeht. Über setSleepSeconds()
     veränderbar — das braucht der Test, der nicht wirklich warten will. */
  var sleepSeconds = 30;

  function deltaText(v, digits) {
    var d = util.round(v, digits === undefined ? 1 : digits);
    return (d > 0 ? '+' : '') + util.formatNum(d, digits === undefined ? 1 : digits);
  }

  function deltaTone(v) {
    if (v > 0.001) return 'good';
    if (v < -0.001) return 'bad';
    return 'flat';
  }

  function line(label, value, tone) {
    return el('div.report__row', null, [
      el('span.report__label', { text: label }),
      el('strong.report__value.is-' + (tone || 'flat'), { text: value })
    ]);
  }

  /* --- Tagesreport ------------------------------------------------------- */

  function show(report) {
    var body = el('div.report');

    body.appendChild(el('div.report__hero', null, [
      el('span.report__hero-value.is-' + deltaTone(report.massDelta), {
        text: deltaText(report.massDelta, 2) + ' kg'
      }),
      el('span.report__hero-label', { text: 'Muskelmasse über Nacht' })
    ]));

    var block = el('div.report__block', null, [
      line('Gesamtmasse', util.formatKg(report.massAfter), 'flat'),
      line('Fitness-Index', report.fitAfter + ' (' + deltaText(report.fitDelta, 0) + ')',
           deltaTone(report.fitDelta)),
      line('Sätze gestern', String(report.setsTrained), 'flat'),
      line('Einnahmen', '+' + util.formatMoney(report.income), 'good')
    ]);
    if (report.coach) {
      var c = report.coach;
      block.appendChild(line('Tagesziel (' + c.title + ')',
        c.status === 'erfuellt' ? 'erfüllt ✔'
          : c.status === 'teilweise' ? c.done + ' von ' + c.total : 'nicht erfüllt',
        c.status === 'erfuellt' ? 'good' : c.status === 'teilweise' ? 'warn' : 'bad'));
    }
    if (report.abo) {
      if (report.abo.planRenewed) {
        block.appendChild(line('Trainingsplan verlängert',
          '−' + util.formatMoney(MF.data.abos.get('trainingsplan').price), 'flat'));
      }
      if (report.abo.planExpired) {
        block.appendChild(line('Trainingsplan', 'abgelaufen', 'warn'));
      }
      if (report.abo.trainerCost) {
        block.appendChild(line('Personal Trainer', '−' + util.formatMoney(report.abo.trainerCost), 'flat'));
      }
    }
    body.appendChild(block);

    if (report.gains.length) {
      body.appendChild(el('div.report__title', { text: 'Entwicklung der Partien' }));
      var list = el('div.report__block');
      report.gains.slice(0, 8).forEach(function (g) {
        list.appendChild(line(g.name, deltaText(g.delta, 2), deltaTone(g.delta)));
      });
      body.appendChild(list);
    } else {
      body.appendChild(el('p.report__empty', {
        text: 'Ohne Trainingsreiz passiert über Nacht nichts.'
      }));
    }

    var healthRows = Object.keys(HEALTH_LABELS).filter(function (k) {
      return Math.abs(report.healthDeltas[k]) >= 0.05;
    });
    if (healthRows.length) {
      body.appendChild(el('div.report__title', { text: 'Gesundheit' }));
      var hblock = el('div.report__block');
      healthRows.forEach(function (k) {
        hblock.appendChild(line(HEALTH_LABELS[k], deltaText(report.healthDeltas[k]), deltaTone(report.healthDeltas[k])));
      });
      body.appendChild(hblock);
    }

    if (report.endedCourses.length) {
      body.appendChild(el('div.report__title', { text: 'Beendet' }));
      var eblock = el('div.report__block');
      report.endedCourses.forEach(function (def) {
        if (def) eblock.appendChild(line(def.icon + ' ' + def.name, 'Kur vorbei', 'flat'));
      });
      body.appendChild(eblock);
    }

    if (report.abo && report.abo.trainerCancelled) {
      body.appendChild(el('div.report__warning', {
        text: 'Dein Trainer ist weg — der Tagessatz war nicht mehr drin. '
            + 'Im Shop kannst du ihn jederzeit neu engagieren.'
      }));
    }

    if (report.burnout) {
      body.appendChild(el('div.report__warning', {
        text: 'Zusammenbruch. Dein Körper hat die Reißleine gezogen: alle Kuren abgesetzt, '
            + 'drei Tage Zwangspause, ein Teil der Masse ist weg.'
      }));
    } else if (report.crash) {
      body.appendChild(el('div.report__warning', {
        text: 'Einbruch nach ' + report.crash.name + ' — noch ' + report.crash.daysLeft
            + ' Tage mit weniger Wachstum und Masseverlust.'
      }));
    }

    /* Die Nacht dauert. Das Fenster bleibt gesperrt, sonst wäre die Wartezeit
       durch Antippen daneben zu umgehen. */
    MF.ui.modal.open({
      title: 'Tag ' + (report.day - 1) + ' abgeschlossen',
      subtitle: sleepSeconds > 0
        ? 'Du schläfst. Der Körper baut jetzt auf.'
        : 'Guten Morgen. Tag ' + report.day + ' beginnt.',
      body: body,
      dismissible: sleepSeconds <= 0,
      actions: [{
        label: 'Weiter trainieren',
        tone: 'primary',
        delaySeconds: sleepSeconds,
        waitText: '🛌 Du schläfst',
        /* Während des Wartens anwählbar; die Wahl liegt im Spielstand und
           gilt ab dann für jede Nacht, bis sie wieder abgewählt wird. */
        auto: {
          label: 'Automatisch weiter trainieren',
          on: !!MF.game.state.get().settings.autoResume,
          onToggle: function (on) {
            MF.game.state.get().settings.autoResume = on;
            MF.game.state.saveNow();
          }
        },
        /* Der neue Tag beginnt wie der erste: Anfahrt ans Studio. */
        onTap: function () { MF.ui.intro.play(); }
      }]
    });
  }

  /* --- Levelaufstieg ----------------------------------------------------- */

  function showLevelUp(info) {
    MF.core.haptics.buzz('levelUp');
    MF.core.audio.sfx('level');

    var body = el('div.levelup');
    body.appendChild(el('div.levelup__badge', { text: 'Lv ' + info.level }));
    body.appendChild(el('div.levelup__title', { text: info.title }));

    if (info.unlocks.length) {
      body.appendChild(el('div.report__title', { text: 'Neu freigeschaltet' }));
      var block = el('div.report__block');
      info.unlocks.forEach(function (u) {
        block.appendChild(line(u.icon + ' ' + u.name, u.kind, 'good'));
      });
      body.appendChild(block);
    } else {
      body.appendChild(el('p.report__empty', { text: 'Mehr Energie, mehr Einkommen.' }));
    }

    MF.ui.modal.open({
      title: 'Level aufgestiegen',
      body: body,
      actions: [{ label: 'Weiter', tone: 'primary' }]
    });
  }

  /* --- Begruessung ------------------------------------------------------- */

  function showIntro() {
    var body = el('div.intro');
    body.appendChild(el('p', {
      text: 'Neues Mitglied bei MacFit. Du fängst schmal an: Geräte, Gewichte und '
          + 'der halbe Shop sind noch gesperrt.'
    }));
    body.appendChild(el('ul.intro__list', null, [
      el('li', { text: 'Gerät wählen, Satz starten — tippe, wenn der Marker in der grünen Zone ist.' }),
      el('li', { text: 'Saubere Form bringt Reiz, Ego-Lifting bringt nichts.' }),
      el('li', { text: 'Energie ist pro Tag begrenzt. Gewachsen wird nachts im Schlaf.' }),
      el('li', { text: 'Im Shop gibt es Hilfsmittel. Manche kosten nur Geld, andere Gesundheit.' })
    ]));
    body.appendChild(el('p.intro__disclaimer', {
      text: 'Alles hier ist Satire und frei erfunden — Wirkungen, Namen und Zahlen haben mit '
          + 'der Realität nichts zu tun. Das Spiel ist kein Trainings- oder Gesundheitsratgeber.'
    }));

    MF.ui.modal.open({
      title: 'Willkommen bei MacFit',
      subtitle: 'Vom Handtuchträger zur Legende.',
      body: body,
      dismissible: false,
      actions: [{ label: 'Los geht’s', tone: 'primary' }]
    });
  }

  MF.ui.report = {
    show: show,
    showLevelUp: showLevelUp,
    showIntro: showIntro,
    sleepSeconds: function () { return sleepSeconds; },
    setSleepSeconds: function (v) { sleepSeconds = Math.max(0, v); }
  };
})(window.MacFit);
