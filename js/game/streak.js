/* Die Trainingsserie: an wie vielen ECHTEN Tagen hintereinander wurde
   trainiert. Das ist der einzige Ort im Spiel, der das Kalenderdatum kennt
   — der Rest rechnet in Spieltagen, die per Schlafen weiterlaufen.

   Belohnt wird der erste abgeschlossene Satz eines Tages. Wer einen Tag
   auslaesst, faengt wieder bei eins an; die laengste Serie bleibt als
   Bestwert stehen. Absichtlich milde: kein Verlust von Fortschritt, nur
   ein Bonus, den man liegen laesst. */
(function (MF) {
  'use strict';

  var util = MF.core.util;

  var MAX_STEP = 7;        /* ab einer Woche waechst der Bonus nicht weiter */
  var MONEY_PER_DAY = 25;
  var XP_PER_DAY = 12;

  function state() { return MF.game.state.get(); }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* Ortszeit, nicht UTC — der Spieler lebt in seiner Zeitzone. */
  function keyFor(date) {
    var d = date || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function dayBefore(key) {
    var parts = String(key).split('-');
    if (parts.length !== 3) return '';
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() - 1);
    return keyFor(d);
  }

  function step() {
    return Math.min(state().streak.days, MAX_STEP);
  }

  function reward() {
    var n = step();
    return { money: MONEY_PER_DAY * n, xp: XP_PER_DAY * n };
  }

  /* Wurde heute schon abgerechnet? */
  function claimedToday(today) {
    return state().streak.lastDay === (today || keyFor());
  }

  /* Nach dem ersten Satz des Tages: Serie fortschreiben und auszahlen.
     today ist nur fuer den Test da — normal zaehlt der echte Kalender. */
  function touch(today) {
    var s = state();
    var key = today || keyFor();
    if (s.streak.lastDay === key) return null;

    var continued = s.streak.lastDay === dayBefore(key);
    s.streak.days = continued ? s.streak.days + 1 : 1;
    s.streak.lastDay = key;
    if (s.streak.days > s.streak.best) s.streak.best = s.streak.days;

    var pay = reward();
    MF.game.economy.earn(pay.money);
    var up = MF.game.progression.addXp(pay.xp);
    s.health.laune = util.clamp(s.health.laune + 2, 0, 100);
    MF.game.state.saveNow();

    var info = { days: s.streak.days, best: s.streak.best, reward: pay,
                 continued: continued, levelUp: up || null };
    MF.core.events.emit('streak:day', info);
    return info;
  }

  /* Steht die Serie noch, wenn der Spieler das Spiel oeffnet? */
  function status(today) {
    var s = state();
    var key = today || keyFor();
    var alive = s.streak.lastDay === key || s.streak.lastDay === dayBefore(key);
    return {
      days: alive ? s.streak.days : 0,
      best: s.streak.best,
      claimedToday: s.streak.lastDay === key,
      /* Serie gerissen: gestern nichts gemacht, obwohl schon mal trainiert. */
      broken: !alive && !!s.streak.lastDay
    };
  }

  /* Erster fertiger Satz des Tages loest die Abrechnung aus. */
  MF.core.events.on('set:finished', function () {
    touch();
  });

  MF.game.streak = {
    MAX_STEP: MAX_STEP,
    keyFor: keyFor,
    dayBefore: dayBefore,
    reward: reward,
    claimedToday: claimedToday,
    touch: touch,
    status: status
  };
})(window.MacFit);
