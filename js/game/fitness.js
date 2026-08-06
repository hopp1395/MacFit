/* Der Fitness-Index: eine Zahl von 0 bis 1000, die den Trainingsstand
   zusammenfasst.

   Grundlage ist die Muskelmasse — mehr Training heißt mehr Masse heißt höherer
   Index. Darauf liegt ein Qualitätsfaktor: wer einseitig trainiert, seine
   Gesundheit ruiniert oder mit schlechter Form arbeitet, kommt trotz gleicher
   Masse nicht auf denselben Wert. Der Faktor kann den Index nie unter 60 %
   drücken, die Masse bleibt also immer die bestimmende Größe. */
(function (MF) {
  'use strict';

  var util = MF.core.util;

  var MAX = 1000;
  var MASS_BASE = 28;    /* kg eines völlig untrainierten Körpers */
  var MASS_SPAN = 30;    /* bis zum theoretischen Maximum von 58 kg */

  var RANKS = [
    { min: 0,   name: 'Untrainiert',      tone: 'bad' },
    { min: 80,  name: 'Anfänger',         tone: 'bad' },
    { min: 180, name: 'Freizeitsportler', tone: 'warn' },
    { min: 300, name: 'Solide Basis',     tone: 'warn' },
    { min: 450, name: 'Sportlich',        tone: 'good' },
    { min: 600, name: 'Durchtrainiert',   tone: 'good' },
    { min: 730, name: 'Athletisch',       tone: 'good' },
    { min: 850, name: 'Wettkampfform',    tone: 'good' },
    { min: 930, name: 'Elite',            tone: 'good' }
  ];

  function state() { return MF.game.state.get(); }

  /* Anteil perfekter Wiederholungen über die gesamte Laufbahn. */
  function technique() {
    var st = state().stats;
    if (!st.totalReps) return 0;
    return util.clamp(st.perfectReps / st.totalReps, 0, 1);
  }

  /* Anteil der Tage, an denen überhaupt trainiert wurde. */
  function consistency() {
    var s = state();
    var elapsed = Math.max(1, s.day - 1);
    return util.clamp(s.stats.daysTrained / elapsed, 0, 1);
  }

  /* Die Masse allein, auf 0..1000 gestreckt. Als eigene Funktion, weil auch
     der Rivale danach bewertet wird — nur mit fester Qualitaet statt der
     gerechneten Aufschluesselung. */
  function scoreForMass(mass) {
    return util.clamp((mass - MASS_BASE) / MASS_SPAN, 0, 1) * MAX;
  }

  function massScore() {
    return scoreForMass(MF.game.stats.muscleMass());
  }

  /* 0.6 bis 1.0 — bestraft Einseitigkeit, schlechte Werte und schlampige Form. */
  function quality() {
    var sym = MF.game.stats.symmetry() / 100;
    var health = MF.game.stats.healthAvg() / 100;
    return 0.6 + 0.4 * (
      sym * 0.30 +
      health * 0.35 +
      technique() * 0.20 +
      consistency() * 0.15
    );
  }

  function index() {
    return Math.round(massScore() * quality());
  }

  function rank(value) {
    var v = value === undefined ? index() : value;
    var out = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) {
      if (v >= RANKS[i].min) out = RANKS[i];
    }
    return out;
  }

  /* Nächste Stufe — für die Fortschrittsanzeige. */
  function nextRank(value) {
    var v = value === undefined ? index() : value;
    for (var i = 0; i < RANKS.length; i++) {
      if (RANKS[i].min > v) return RANKS[i];
    }
    return null;
  }

  /* Aufschlüsselung für den Körper-Bildschirm: woher kommt der Wert? */
  function parts() {
    return {
      index: index(),
      massScore: Math.round(massScore()),
      quality: quality(),
      components: [
        { key: 'masse', name: 'Muskelmasse', value: massScore() / MAX, weight: 'Basis' },
        { key: 'symmetrie', name: 'Symmetrie', value: MF.game.stats.symmetry() / 100, weight: '30 %' },
        { key: 'gesundheit', name: 'Gesundheit', value: MF.game.stats.healthAvg() / 100, weight: '35 %' },
        { key: 'technik', name: 'Technik', value: technique(), weight: '20 %' },
        { key: 'konstanz', name: 'Regelmäßigkeit', value: consistency(), weight: '15 %' }
      ]
    };
  }

  MF.game.fitness = {
    MAX: MAX,
    RANKS: RANKS,
    index: index,
    massScore: massScore,
    scoreForMass: scoreForMass,
    quality: quality,
    technique: technique,
    consistency: consistency,
    rank: rank,
    nextRank: nextRank,
    parts: parts
  };
})(window.MacFit);
