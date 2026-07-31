/* Die Figur. Jede Muskelpartie ist ein eigenes SVG-Element, das anhand seiner
   Groesse skaliert wird — kein Bildmaterial, skaliert auf jedem Display scharf. */
(function (MF) {
  'use strict';

  var util = MF.core.util;

  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* Wie stark eine Partie zwischen "untrainiert" und "maximal" waechst. */
  var SCALE = {
    schultern: { x: [0.84, 1.42], y: [0.88, 1.28] },
    brust:     { x: [0.84, 1.38], y: [0.88, 1.34] },
    ruecken:   { x: [0.88, 1.34], y: [1.00, 1.00] },
    bauch:     { x: [0.90, 1.20], y: [0.96, 1.06] },
    bizeps:    { x: [0.78, 1.55], y: [0.88, 1.30] },
    trizeps:   { x: [0.80, 1.50], y: [0.88, 1.26] },
    beine:     { x: [0.84, 1.40], y: [0.94, 1.10] },
    waden:     { x: [0.84, 1.45], y: [0.90, 1.20] }
  };

  var MARKUP = [
    '<svg viewBox="0 0 100 190" class="avatar__svg" aria-hidden="true">',
    '  <g class="avatar__body">',
    /* Ruecken/Torso liegt hinten und bestimmt die V-Form */
    '    <path class="avatar__part avatar__part--torso" data-muscle="ruecken"',
    '          d="M30 43 L70 43 L61 97 L39 97 Z" />',
    '    <rect class="avatar__skin" x="45" y="26" width="10" height="10" rx="4" />',
    '    <circle class="avatar__skin avatar__head" cx="50" cy="19" r="10" />',
    /* Beine */
    '    <rect class="avatar__skin" x="37" y="93" width="26" height="13" rx="6" />',
    '    <ellipse class="avatar__part" data-muscle="beine" cx="42" cy="126" rx="9.5" ry="22" />',
    '    <ellipse class="avatar__part" data-muscle="beine" cx="58" cy="126" rx="9.5" ry="22" />',
    '    <circle class="avatar__skin" cx="42" cy="148" r="5.5" />',
    '    <circle class="avatar__skin" cx="58" cy="148" r="5.5" />',
    '    <ellipse class="avatar__part" data-muscle="waden" cx="42" cy="161" rx="7" ry="13" />',
    '    <ellipse class="avatar__part" data-muscle="waden" cx="58" cy="161" rx="7" ry="13" />',
    '    <ellipse class="avatar__skin" cx="41" cy="180" rx="6.5" ry="4" />',
    '    <ellipse class="avatar__skin" cx="59" cy="180" rx="6.5" ry="4" />',
    /* Arme */
    '    <ellipse class="avatar__part" data-muscle="trizeps" cx="27" cy="75" rx="5.5" ry="10" />',
    '    <ellipse class="avatar__part" data-muscle="trizeps" cx="73" cy="75" rx="5.5" ry="10" />',
    '    <ellipse class="avatar__part" data-muscle="bizeps" cx="23" cy="63" rx="6.5" ry="11" />',
    '    <ellipse class="avatar__part" data-muscle="bizeps" cx="77" cy="63" rx="6.5" ry="11" />',
    '    <ellipse class="avatar__skin" cx="21" cy="88" rx="5" ry="12" />',
    '    <ellipse class="avatar__skin" cx="79" cy="88" rx="5" ry="12" />',
    '    <circle class="avatar__skin" cx="20" cy="102" r="4.5" />',
    '    <circle class="avatar__skin" cx="80" cy="102" r="4.5" />',
    /* Rumpf vorne */
    '    <ellipse class="avatar__part" data-muscle="bauch" cx="50" cy="83" rx="11" ry="13" />',
    '    <g class="avatar__abs">',
    '      <line x1="50" y1="74" x2="50" y2="92" />',
    '      <line x1="43" y1="80" x2="57" y2="80" />',
    '      <line x1="43" y1="87" x2="57" y2="87" />',
    '    </g>',
    '    <ellipse class="avatar__part" data-muscle="brust" cx="41" cy="58" rx="10.5" ry="8" />',
    '    <ellipse class="avatar__part" data-muscle="brust" cx="59" cy="58" rx="10.5" ry="8" />',
    '    <ellipse class="avatar__part" data-muscle="schultern" cx="28" cy="47" rx="10" ry="9" />',
    '    <ellipse class="avatar__part" data-muscle="schultern" cx="72" cy="47" rx="10" ry="9" />',
    '  </g>',
    '</svg>'
  ].join('\n');

  /* Farbe zwischen frisch und ausgepowert mischen. */
  function mix(a, b, t) {
    var out = '#';
    for (var i = 0; i < 3; i++) {
      var av = parseInt(a.substr(1 + i * 2, 2), 16);
      var bv = parseInt(b.substr(1 + i * 2, 2), 16);
      var v = Math.round(av + (bv - av) * t);
      out += ('0' + v.toString(16)).slice(-2);
    }
    return out;
  }

  function create(container) {
    container.innerHTML = MARKUP;
    return container.querySelector('.avatar__svg');
  }

  function update(svg) {
    if (!svg) return;
    var s = MF.game.state.get();
    var health = MF.game.stats.healthAvg();

    var parts = svg.querySelectorAll('.avatar__part');
    Array.prototype.forEach.call(parts, function (node) {
      var id = node.getAttribute('data-muscle');
      var m = s.muscles[id];
      var spec = SCALE[id];
      if (!m || !spec) return;

      var f = util.clamp(m.size / 100, 0, 1);
      var sx = util.lerp(spec.x[0], spec.x[1], f);
      var sy = util.lerp(spec.y[0], spec.y[1], f);
      node.style.transform = 'scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
      node.style.fill = mix('#e0a273', '#b4705a', util.clamp(m.fatigue, 0, 1));
    });

    /* Bauchmuskeln werden erst mit der Groesse sichtbar. */
    var abs = svg.querySelector('.avatar__abs');
    if (abs) {
      abs.style.opacity = util.clamp((s.muscles.bauch.size - 22) / 55, 0, 0.75).toFixed(2);
    }

    svg.classList.toggle('is-unhealthy', health < 55);
    svg.classList.toggle('is-critical', health < 30);
  }

  MF.ui.avatar = {
    create: create,
    update: update
  };
})(window.MacFit);
