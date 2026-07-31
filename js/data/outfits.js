/* Trainingsklamotten zur Auswahl bei der Spieleranlage.

   Die Farben stammen aus der Pixel-Palette (ui/pixel.js) — andere Werte würde
   die Quantisierung ohnehin auf den nächsten Palettenton ziehen. Hier stehen
   sie als Hex, weil data/ nichts aus ui/ kennen darf. */
(function (MF) {
  'use strict';

  var LIST = [
    { id: 'blau', name: 'Blau', shirt: '#33507c', shirtLit: '#4a6ba0', shorts: '#241f2e' },
    { id: 'rot', name: 'Rot', shirt: '#b83a33', shirtLit: '#dd5f55', shorts: '#241f2e' },
    { id: 'gruen', name: 'Grün', shirt: '#4d8a44', shirtLit: '#c9d3de', shorts: '#241f2e' },
    { id: 'schwarz', name: 'Schwarz', shirt: '#241f2e', shirtLit: '#434b5c', shorts: '#33507c' }
  ];

  function get(id) {
    for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i];
    return LIST[0];
  }

  /* Die Kleiderfarben so, wie ui/figure.js sie erwartet. */
  function look(id) {
    var o = get(id);
    return { shirt: o.shirt, shirtLit: o.shirtLit, shorts: o.shorts };
  }

  MF.data.outfits = { list: LIST, get: get, look: look };
})(window.MacFit);
