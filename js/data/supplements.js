/* Shop-Waren. Gekauftes wirkt sofort als "Kur" über mehrere Tage.
   Alles frei erfunden und überzeichnet — keine Mengen, keine Anwendung,
   keine Bezugsquellen. Das Spiel ist Satire, kein Ratgeber.

   effects (solange die Kur läuft):
     growth  Bonus auf Muskelwachstum      (additiv auf Multiplikator 1.0)
     regen   Bonus auf nächtliche Erholung
     energy  zusätzliche Energie pro Tag
     focus   breitere Trefferzone beim Training
   health (pro Nacht, negativ = Schaden, positiv = Erholung):
     herz / leber / schlaf / laune
   crash: Tage mit Einbruch nach Kurende (Massenverlust + Wachstumsmalus) */
(function (MF) {
  'use strict';

  var LIST = [
    /* ---------- Basis: harmlos, klein, ehrlich --------------------------- */
    { id: 'whey', name: 'Whey-Protein', icon: '🥛', tier: 'basis',
      price: 45, unlockLevel: 1, days: 7,
      effects: { growth: 0.12 },
      health: {},
      desc: 'Vanille. Immer Vanille. Deckt den Eiweißbedarf ohne Drama.' },

    { id: 'creatin', name: 'Creatin-Monohydrat', icon: '⚗️', tier: 'basis',
      price: 70, unlockLevel: 2, days: 10,
      effects: { growth: 0.16, energy: 8 },
      health: {},
      desc: 'Das am besten untersuchte Supplement überhaupt. Unspektakulär wirksam.' },

    { id: 'koffein', name: 'Koffein-Kick', icon: '☕', tier: 'basis',
      price: 30, unlockLevel: 2, days: 5,
      effects: { focus: 0.18, energy: 14 },
      health: { schlaf: -1.5 },
      desc: 'Wach, fokussiert, hellwach um drei Uhr nachts.' },

    { id: 'magnesium', name: 'Magnesium & Zink', icon: '🌙', tier: 'basis',
      price: 35, unlockLevel: 3, days: 8,
      effects: { regen: 0.18 },
      health: { schlaf: 2.5, laune: 1 },
      desc: 'Weniger Krämpfe, besserer Schlaf. Langweilig und gut.' },

    { id: 'eaa', name: 'EAA-Komplex', icon: '🧃', tier: 'basis',
      price: 90, unlockLevel: 4, days: 8,
      effects: { growth: 0.18, regen: 0.12 },
      health: {},
      desc: 'Schmeckt nach Waldmeister-Chemie, hält den Muskel bei Laune.' },

    /* ---------- Grenzbereich: wirkt spürbar, kostet etwas ---------------- */
    { id: 'pump-booster', name: 'Pump-Booster "Vasodilator 9000"', icon: '💥', tier: 'grenz',
      price: 160, unlockLevel: 5, days: 6,
      effects: { growth: 0.30, focus: 0.22, energy: 18 },
      health: { herz: -1.5, schlaf: -2 },
      desc: 'Kribbeln im Gesicht, Adern wie Landstraßen. Das Herz merkt es sich.' },

    { id: 'shredder', name: 'Shredder-X Thermo', icon: '🌡️', tier: 'grenz',
      price: 210, unlockLevel: 6, days: 7,
      effects: { focus: 0.25, energy: 24 },
      health: { herz: -2, schlaf: -3, laune: -1.5 },
      desc: 'Du schwitzt im Stehen und bist ständig leicht gereizt.' },

    { id: 'peptid-kur', name: 'Peptid-Kur "Regenex"', icon: '🧬', tier: 'grenz',
      price: 340, unlockLevel: 7, days: 8,
      effects: { growth: 0.48, regen: 0.40 },
      health: { leber: -2, laune: -1 },
      desc: 'Erholung wie mit zwanzig. Der Preis steht auf dem Kontoauszug — und in der Leber.' },

    /* ---------- Anabol: massive Gains, echte Konsequenzen ---------------- */
    { id: 'testo-deluxe', name: 'Testo Deluxe', icon: '🧪', tier: 'anabol',
      price: 620, unlockLevel: 8, days: 10, crash: 4,
      effects: { growth: 1.35, regen: 0.55, energy: 20 },
      health: { herz: -3, leber: -3.5, laune: -1.5, schlaf: -1 },
      desc: 'Ab hier wachsen die Zahlen schneller als die Vernunft.' },

    { id: 'dbol', name: 'Massepaket "Bulk-51"', icon: '📦', tier: 'anabol',
      price: 880, unlockLevel: 9, days: 8, crash: 5,
      effects: { growth: 1.85, regen: 0.60 },
      health: { herz: -4, leber: -6, schlaf: -2, laune: -2 },
      desc: 'Vier Kilo in zwei Wochen. Drei davon bleiben nicht.' },

    { id: 'tren-x', name: 'Tren-X', icon: '☠️', tier: 'anabol',
      price: 1400, unlockLevel: 10, days: 8, crash: 7,
      effects: { growth: 2.60, regen: 0.95, focus: -0.10 },
      health: { herz: -5.5, leber: -4.5, schlaf: -7, laune: -6 },
      desc: 'Nachts wach, tagsüber wütend, im Spiegel unfassbar. Nichts davon ist gratis.' },

    { id: 'stack-alpha', name: 'Wettkampf-Stack "Alpha"', icon: '👹', tier: 'anabol',
      price: 2600, unlockLevel: 11, days: 6, crash: 9,
      effects: { growth: 3.50, regen: 1.20, energy: 30, focus: -0.15 },
      health: { herz: -8, leber: -8, schlaf: -8, laune: -8 },
      desc: 'Alles auf einmal, kurz vor der Bühne. Danach ist erstmal Pause.' },

    /* ---------- Reha: Gesundheit zurückkaufen ---------------------------- */
    { id: 'leberkur', name: 'Leberkur & Blutbild', icon: '🩺', tier: 'reha',
      price: 300, unlockLevel: 5, days: 6,
      effects: { growth: -0.10 },
      health: { leber: 9, herz: 3 },
      desc: 'Zwei Wochen vernünftig sein. Bringt keine Gains, rettet aber die Werte.' },

    { id: 'schlafklinik', name: 'Schlaflabor-Woche', icon: '🛌', tier: 'reha',
      price: 260, unlockLevel: 6, days: 5,
      effects: { regen: 0.25 },
      health: { schlaf: 12, laune: 5 },
      desc: 'Handy aus, Rollo runter. Erstaunlich, was Schlaf für den Muskel tut.' },

    { id: 'therapie', name: 'Sportpsychologie', icon: '🧠', tier: 'reha',
      price: 380, unlockLevel: 8, days: 7,
      effects: { focus: 0.20 },
      health: { laune: 11, schlaf: 3 },
      desc: 'Reden hilft. Auch beim Kreuzheben.' }
  ];

  var TIERS = {
    basis: { name: 'Basis', hint: 'Kleine Boni, keine Nebenwirkungen.', order: 1 },
    grenz: { name: 'Grenzbereich', hint: 'Spürbar stärker — kostet Gesundheit.', order: 2 },
    anabol: { name: 'Anabol', hint: 'Massive Gains, harte Konsequenzen, Einbruch danach.', order: 3 },
    reha: { name: 'Regeneration', hint: 'Kauft Gesundheit zurück.', order: 4 }
  };

  var BY_ID = {};
  LIST.forEach(function (s) { BY_ID[s.id] = s; });

  MF.data.supplements = {
    list: LIST,
    tiers: TIERS,
    get: function (id) { return BY_ID[id] || null; },
    byTier: function (tier) {
      return LIST.filter(function (s) { return s.tier === tier; });
    },
    unlockedAt: function (level) {
      return LIST.filter(function (s) { return s.unlockLevel === level; });
    }
  };
})(window.MacFit);
