/* Start des Spiels. Laedt den Spielstand, baut die Oberflaeche, verdrahtet
   die Ereignisse. Muss als letztes Skript eingebunden werden. */
(function (MF) {
  'use strict';

  function boot() {
    var loaded = MF.core.storage.load();
    var s = loaded ? MF.game.state.hydrate(loaded) : MF.game.state.createNewState();
    MF.game.state.set(s);

    /* Level immer aus den XP ableiten — falls sich Schwellen geaendert haben. */
    s.level = MF.data.levels.levelForXp(s.xp);
    MF.core.haptics.setEnabled(s.settings.haptics);
    MF.core.audio.setEnabled(s.settings.music);
    MF.core.audio.setSfxEnabled(s.settings.sound);
    MF.core.audio.init();

    MF.ui.hud.render();
    MF.ui.router.initTabs();
    MF.ui.router.go('gym');

    wireEvents();

    /* Sicherheitsnetz gegen vergessene Speicherpunkte und Browser, die beim
       Schließen kein pagehide liefern. */
    MF.game.state.startAutosave(15);

    document.body.classList.add('is-ready');

    /* Vorspann zuerst — Dialoge kämen sonst hinter dem Film zu liegen und
       wären beim Wegtippen schon quittiert. */
    MF.ui.intro.play(afterIntro);
  }

  /* Erst der Film, dann die Anlage, dann die Hinweise — in dieser Reihenfolge,
     sonst lägen Dialoge unsichtbar hinter dem Vorspann.

     Der Spielstand wird hier bewusst jedes Mal neu geholt: wer in der Anlage
     ein Profil importiert, hat danach ein anderes Objekt im Spiel, und ein
     festgehaltenes würde ins Leere schreiben. */
  function afterIntro() {
    if (MF.ui.create.needed()) {
      MF.ui.create.show(afterCreate);
      return;
    }
    afterCreate();
  }

  function afterCreate() {
    var s = MF.game.state.get();

    if (!s.seenIntro) {
      s.seenIntro = true;
      MF.game.state.saveNow();
      MF.ui.report.showIntro();
    }

    /* Wenn der Browser keine Website-Daten zulässt, muss der Spieler das
       wissen, bevor er eine Stunde Fortschritt verliert. */
    if (!MF.core.storage.isAvailable()) {
      MF.ui.modal.open({
        title: 'Fortschritt kann nicht gespeichert werden',
        subtitle: 'Dieser Browser lässt keine Website-Daten zu.',
        body: MF.core.util.el('p', {
          text: 'Das passiert im privaten Modus oder wenn Website-Daten blockiert sind. '
              + 'Du kannst normal spielen, aber beim Schließen des Tabs ist alles weg. '
              + 'In einem normalen Fenster wird automatisch gespeichert.'
        }),
        actions: [{ label: 'Verstanden', tone: 'primary' }]
      });
    }
  }

  function wireEvents() {
    var on = MF.core.events.on;

    on('set:finished', function () {
      MF.ui.hud.render();
    });

    on('day:ended', function () {
      MF.ui.hud.render();
      MF.ui.router.refresh();
    });

    on('money:changed', function () {
      MF.ui.hud.render();
    });

    on('energy:changed', function () {
      MF.ui.hud.render();
    });

    on('screen:changed', function () {
      MF.ui.hud.render();
    });

    /* Beim Verlassen der Seite auf jeden Fall sichern. */
    window.addEventListener('pagehide', function () { MF.game.state.saveNow(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') MF.game.state.saveNow();
    });
  }

  /* Kleine Konsolen-Helfer fuers Balancing. */
  MF.debug = {
    sleepDays: function (n) {
      var last = null;
      for (var i = 0; i < (n || 1); i++) last = MF.game.day.sleep();
      MF.ui.hud.render();
      MF.ui.router.refresh();
      return last;
    },
    addXp: function (n) {
      MF.game.progression.addXp(n);
      MF.ui.hud.render();
      MF.ui.router.refresh();
    },
    addMoney: function (n) {
      MF.game.economy.earn(n);
      MF.ui.router.refresh();
    },
    /* Einen kompletten Satz mit vorgegebener Form simulieren. */
    fakeSet: function (exerciseId, formScore, weightIndex) {
      var ex = MF.data.exercises.get(exerciseId);
      if (!ex) return null;
      var wi = weightIndex === undefined ? 1 : weightIndex;
      MF.game.training.beginSet(ex, wi);
      var hits = [];
      for (var i = 0; i < ex.reps; i++) {
        hits.push(i / ex.reps < (formScore === undefined ? 0.8 : formScore) ? 'perfect' : 'miss');
      }
      var res = MF.game.training.finishSet(ex, wi, hits);
      MF.ui.hud.render();
      MF.ui.router.refresh();
      return res;
    },
    state: function () { return MF.game.state.get(); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.MacFit);
