/* Coaching-Abos kaufen, kündigen und über Nacht abrechnen. Was die Abos
   inhaltlich tun (Zielpartien, Analyse), steht in coach.js — hier geht es
   nur ums Geld und die Laufzeit. */
(function (MF) {
  'use strict';

  function state() { return MF.game.state.get(); }

  function planActive() { return state().coach.planDays > 0; }
  function trainerActive() { return !!state().coach.trainer; }

  function isActive(id) {
    return id === 'trainer' ? trainerActive() : planActive();
  }

  function isUnlocked(def) {
    return state().level >= def.unlockLevel;
  }

  function canBuy(def) {
    if (!isUnlocked(def)) {
      return { ok: false, reason: 'Ab Level ' + def.unlockLevel };
    }
    if (isActive(def.id)) {
      return { ok: false, reason: 'Läuft bereits' };
    }
    if (!MF.game.economy.canAfford(def.price)) {
      return { ok: false, reason: 'Zu teuer' };
    }
    return { ok: true };
  }

  function buy(def) {
    var check = canBuy(def);
    if (!check.ok) return check;

    var c = state().coach;
    MF.game.economy.spend(def.price);
    if (def.id === 'trainingsplan') {
      c.planDays = def.days;
      /* Startpunkt der Rotation nur beim Neueinstieg setzen — eine
         Verlängerung soll den Split nicht zurück auf den Push-Tag werfen. */
      c.planStart = state().day;
    } else {
      /* Der erste Tagessatz ist sofort fällig — sonst gäbe es einen
         Gratis-Analysetag mit Kündigung vor der Nacht. */
      c.trainer = true;
    }
    c.todayPlan = null;   /* Ziele sofort neu bestimmen */

    MF.core.events.emit('abo:bought', def);
    MF.game.state.saveNow();
    return { ok: true };
  }

  function cancelTrainer() {
    state().coach.trainer = false;
    state().coach.todayPlan = null;
    MF.game.state.saveNow();
  }

  function setPlanAuto(on) {
    state().coach.planAuto = !!on;
    MF.game.state.saveNow();
  }

  /* Eine Nacht weiterschalten. Läuft in sleep() NACH dem Einkommen, damit der
     Tagessatz aus dem frischen Geld bezahlt werden kann. */
  function tickNight() {
    var c = state().coach;
    var plan = MF.data.abos.get('trainingsplan');
    var trainer = MF.data.abos.get('trainer');
    var out = { planRenewed: false, planExpired: false, trainerCost: 0, trainerCancelled: false };

    if (c.planDays > 0) {
      c.planDays -= 1;
      if (c.planDays <= 0) {
        if (c.planAuto && MF.game.economy.canAfford(plan.price)) {
          MF.game.economy.spend(plan.price);
          c.planDays = plan.days;
          out.planRenewed = true;
        } else {
          c.planDays = 0;
          out.planExpired = true;   /* keine Schulden — das Abo läuft einfach aus */
        }
      }
    }

    if (c.trainer) {
      if (MF.game.economy.canAfford(trainer.price)) {
        MF.game.economy.spend(trainer.price);
        out.trainerCost = trainer.price;
      } else {
        c.trainer = false;
        out.trainerCancelled = true;
      }
    }

    c.todayPlan = null;   /* der neue Tag bestimmt seine Ziele selbst */
    return out;
  }

  MF.game.abos = {
    planActive: planActive,
    trainerActive: trainerActive,
    isActive: isActive,
    isUnlocked: isUnlocked,
    canBuy: canBuy,
    buy: buy,
    cancelTrainer: cancelTrainer,
    setPlanAuto: setPlanAuto,
    tickNight: tickNight
  };
})(window.MacFit);
