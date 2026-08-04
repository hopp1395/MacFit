/* Start des Spiels. Laedt den Spielstand, baut die Oberflaeche, verdrahtet
   die Ereignisse. Muss als letztes Skript eingebunden werden. */
(function (MF) {
  'use strict';

  /* Ohne Konto laeuft nichts mehr: erst die Anmeldung (Gate), dann die
     Entscheidung, welcher Spielstand zaehlt (Cloud oder Geraet), dann der
     bisherige Start. */
  function boot() {
    var cloud = MF.core.cloud;

    /* Der Link aus der Passwort-Mail meldet sich frueh im Start — der
       Listener muss deshalb vor init() stehen, nicht erst in wireEvents(). */
    MF.core.events.on('cloud:recovery', function () {
      MF.ui.login.showNewPassword();
    });

    cloud.init();

    if (!cloud.isSupported()) {
      MF.ui.login.showBlocked(MF.cloudConfig && MF.cloudConfig.url
        ? 'Dieser Browser ist zu alt für MacFit Online. Bitte nutze einen aktuellen Browser.'
        : 'MacFit Online ist noch nicht eingerichtet — es fehlen die Zugangsdaten.');
      return;
    }

    cloud.getSession(function (session) {
      if (session) { chooseSave(); return; }
      autoMigrate(function (ok) {
        if (ok) { chooseSave(); return; }
        MF.ui.login.show({ onDone: chooseSave });
      });
    });
  }

  /* Nach automatischer Kontoanlage wird der Alt-Stand ohne Rueckfrage
     uebernommen — es ist das frische Konto genau dieses Spielers. */
  var autoAdopt = false;

  /* Migration fuer Bestandsspieler: wer schon eine Mitgliedskarte hat,
     bekommt sein Konto automatisch — Benutzername aus Name und Kartennummer,
     Passwort die Kartennummer. Die E-Mail wird spaeter unter der Karte im
     Koerper-Menue nachgetragen. done(true) = angemeldet.

     Nur solange dieses Geraet noch nie mit einem Konto abgeglichen war
     (kein Marker): danach gehoert der Login dem Spieler — sonst wuerde nach
     einem Konto mit nachgetragener E-Mail hier ein zweites Konto entstehen. */
  function autoMigrate(done) {
    var cloud = MF.core.cloud;
    var local = MF.core.storage.load();

    if (!local || !local.player || !local.player.created
        || !local.player.number || cloud.marker()) {
      done(false);
      return;
    }

    var email = cloud.memberEmail(local.player.name, local.player.number);
    var pw = String(local.player.number);

    /* Erst anmelden (das Konto kann von einem frueheren Besuch stammen),
       sonst anlegen. Scheitert beides, bleibt das normale Gate. */
    cloud.signIn(email, pw, function (err) {
      if (!err) { done(true); return; }
      cloud.signUp(email, pw, function (err2) {
        if (err2) { done(false); return; }
        autoAdopt = true;
        MF.ui.toast.show('Dein Konto wurde automatisch aus der Mitgliedskarte angelegt.', 'good');
        done(true);
      });
    });
  }

  /* Angemeldet — jetzt den Stand bestimmen. Die Cloud fuehrt; der lokale
     Speicher ist nur der Puffer dieses Geraets. */
  function chooseSave() {
    var cloud = MF.core.cloud;

    cloud.loadSave(function (err, row) {
      var local = MF.core.storage.load();

      if (err) {
        /* Cloud gerade nicht erreichbar. Gehoert der lokale Stand zu diesem
           Konto, geht es damit weiter — der Marker schiebt spaeter nach.
           Sonst hilft nur neu laden: ein fremder Stand darf das Konto nicht
           ueberschreiben. */
        var m = cloud.marker();
        var u = cloud.user();
        if (local && m && u && m.user === u.id) {
          startGame(MF.game.state.hydrate(local));
          MF.ui.toast.show('Keine Verbindung — dein Stand wird später synchronisiert.', 'warn');
          return;
        }
        MF.ui.login.showBlocked('Keine Verbindung zum Server. Prüfe dein Internet und lade die Seite neu.');
        return;
      }

      var uid = cloud.user() ? cloud.user().id : '';
      var verdict = cloud.decideBoot(row, local, cloud.marker(), uid);

      if (verdict === 'fresh') { startGame(MF.game.state.createNewState()); return; }
      if (verdict === 'cloud') {
        cloud.markSynced(row.updatedAt);
        startGame(MF.game.state.hydrate(row.data));
        return;
      }
      if (verdict === 'local') {
        /* Der letzte Upload hat gefehlt (z. B. beim Schliessen) — nachschieben. */
        startGame(MF.game.state.hydrate(local));
        cloud.pushNow();
        return;
      }
      if (verdict === 'adopt') {
        if (autoAdopt) {
          startGame(MF.game.state.hydrate(local));
          MF.core.cloud.pushNow();
          return;
        }
        askAdoption(local);
        return;
      }
      askWhich(row, local);
    });
  }

  /* Neues Konto, aber auf dem Geraet liegt schon ein Stand aus der Zeit vor
     MacFit Online: einmalig anbieten, ihn zu uebernehmen. */
  function askAdoption(local) {
    var name = (local.player && local.player.name) || 'ein Spieler';
    var day = local.day || 1;

    MF.ui.modal.open({
      title: 'Spielstand gefunden',
      subtitle: 'Auf diesem Gerät trainiert bereits ' + name + ' (Tag ' + day + ').',
      body: MF.core.util.el('p', {
        text: 'Soll dieser Stand in dein Konto übernommen werden? Er wandert dann '
            + 'in die Cloud und steht auf allen Geräten bereit.'
      }),
      dismissible: false,
      actions: [
        {
          label: 'Übernehmen', tone: 'primary',
          onTap: function () {
            startGame(MF.game.state.hydrate(local));
            MF.core.cloud.pushNow();
          }
        },
        {
          label: 'Neu anfangen', tone: 'ghost',
          onTap: function () {
            MF.ui.modal.open({
              title: 'Wirklich neu anfangen?',
              subtitle: 'Der Stand von ' + name + ' auf diesem Gerät wird dabei überschrieben.',
              dismissible: false,
              actions: [
                { label: 'Zurück', tone: 'ghost', onTap: function () { askAdoption(local); } },
                { label: 'Neu anfangen', tone: 'danger', onTap: function () {
                    startGame(MF.game.state.createNewState());
                  } }
              ]
            });
          }
        }
      ]
    });
  }

  /* Cloud und Geraet sind auseinandergelaufen (zwei Geraete, beide mit
     eigenen Aenderungen) — das entscheidet der Spieler, nicht der Code. */
  function askWhich(row, local) {
    var cloudDay = (row.data && row.data.day) || 1;
    var localDay = local.day || 1;

    MF.ui.modal.open({
      title: 'Welcher Stand zählt?',
      subtitle: 'Cloud und dieses Gerät sind unterschiedlich weit.',
      body: MF.core.util.el('p', {
        text: 'Cloud: Tag ' + cloudDay + ' — dieses Gerät: Tag ' + localDay + '. '
            + 'Der jeweils andere Stand wird überschrieben.'
      }),
      dismissible: false,
      actions: [
        {
          label: 'Cloud (Tag ' + cloudDay + ')', tone: 'primary',
          onTap: function () {
            MF.core.cloud.markSynced(row.updatedAt);
            startGame(MF.game.state.hydrate(row.data));
          }
        },
        {
          label: 'Dieses Gerät (Tag ' + localDay + ')', tone: 'ghost',
          onTap: function () {
            startGame(MF.game.state.hydrate(local));
            MF.core.cloud.pushNow();
          }
        }
      ]
    });
  }

  /* Der bisherige Start — laeuft, sobald feststeht, welcher Stand gilt. */
  function startGame(s) {
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

    /* Den gewaehlten Stand sofort in den lokalen Puffer schreiben — ein
       Cloud-Stand waere sonst bis zum ersten Speicherpunkt nur im Speicher. */
    MF.game.state.saveNow();

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

  /* Begruessung beim Wiederkommen: was die Serie gerade wert ist. Nur ein
     Toast, kein Fenster — es soll locken, nicht aufhalten. */
  function greetStreak() {
    var st = MF.game.streak.status();
    if (st.claimedToday) return;

    if (st.days > 0) {
      var next = st.days + 1;
      MF.ui.toast.show('🔥 ' + st.days + ' Tage in Folge. Ein Satz heute macht ' + next
        + ' daraus — ' + MF.core.util.formatMoney(25 * Math.min(next, MF.game.streak.MAX_STEP))
        + ' warten.', 'good');
    } else if (st.broken) {
      MF.ui.toast.show('Willkommen zurück. Deine längste Serie: ' + st.best
        + ' Tage — heute geht eine neue los.', 'warn');
    }
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
              + 'Auch die Anmeldung wird nicht gemerkt — beim nächsten Start heißt es '
              + 'neu einloggen. In einem normalen Fenster passiert beides automatisch.'
        }),
        actions: [{ label: 'Verstanden', tone: 'primary' }]
      });
      return;
    }

    greetStreak();
  }

  /* Am Eingang haengt das Schwarze Brett: nach der Anfahrt einmal pro Tag
     den Zettel zeigen. Waehrend der Anlage und nach dem Feierabend-Film
     bleibt es zu. */
  function showBoardAtEntrance(info) {
    if (!info || info.mode !== 'arrive') return;
    var s = MF.game.state.get();
    if (!s || !s.player.created || MF.ui.create.needed()) return;
    if (s.challenge.shownDay === s.day) return;

    s.challenge.shownDay = s.day;
    MF.game.state.saveSoon();
    MF.ui.shop.showBoard();
  }

  function wireEvents() {
    var on = MF.core.events.on;

    on('intro:done', showBoardAtEntrance);

    on('set:finished', function () {
      MF.ui.hud.render();
    });

    /* Trainingsserie: der erste Satz des Tages zahlt sie aus. */
    on('streak:day', function (info) {
      MF.core.audio.sfx('coin');
      MF.core.haptics.buzz('perfect');
      MF.ui.toast.show(
        info.continued
          ? '🔥 Serie: ' + info.days + ' Tage in Folge — +'
            + MF.core.util.formatMoney(info.reward.money) + ' und +' + info.reward.xp + ' XP.'
          : 'Neue Serie gestartet — +' + MF.core.util.formatMoney(info.reward.money)
            + ' und +' + info.reward.xp + ' XP. Morgen wieder, dann wird es mehr.',
        'good');
      MF.ui.hud.render();
    });

    /* Zettel vom Schwarzen Brett geschafft — Kasse klingelt sofort. */
    on('challenge:done', function (info) {
      MF.core.audio.sfx('coin');
      MF.ui.toast.show('📌 ' + info.def.title + ' geschafft — +'
        + MF.core.util.formatMoney(info.reward.money) + ' und +'
        + info.reward.xp + ' XP.', 'good');
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

    /* Cloud-Stoerungen nur dezent melden — das Spiel laeuft lokal weiter,
       und der Nachschub probiert es von selbst wieder. */
    var lastCloudWarn = 0;
    on('cloud:error', function () {
      var t = +new Date();
      if (t - lastCloudWarn < 60000) return;
      lastCloudWarn = t;
      MF.ui.toast.show('Cloud gerade nicht erreichbar — es wird lokal weitergespielt.', 'warn');
    });

    /* Sitzung weg (abgelaufen oder auf anderem Weg beendet): das Spiel bleibt
       stehen, wo es ist, nur die Anmeldung wird als Schicht darueber geholt. */
    on('cloud:signedout', function () {
      MF.ui.toast.show('Du wurdest abgemeldet.', 'warn');
      MF.ui.login.show({
        overlay: true,
        onDone: function () {
          MF.ui.toast.show('Wieder angemeldet.', 'good');
          MF.core.cloud.pushNow();
        }
      });
    });

    /* Beim Verlassen der Seite auf jeden Fall sichern — lokal und, so weit
       der Browser den Request noch rauslaesst, auch in die Cloud. Geht der
       Upload verloren, holt ihn der Marker beim naechsten Start nach. */
    window.addEventListener('pagehide', function () {
      MF.game.state.saveNow();
      MF.core.cloud.pushNow();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        MF.game.state.saveNow();
        MF.core.cloud.pushNow();
      }
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
    state: function () { return MF.game.state.get(); },
    /* Startet den kompletten Boot erneut — fuer Tests und die Konsole. */
    reboot: boot
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.MacFit);
