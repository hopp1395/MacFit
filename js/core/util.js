/* Kleine Helfer ohne Spiellogik. */
(function (MF) {
  'use strict';

  function clamp(v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function round(v, digits) {
    var f = Math.pow(10, digits || 0);
    return Math.round(v * f) / f;
  }

  /* Zahl mit deutschem Tausenderpunkt. */
  function formatNum(v, digits) {
    return round(v, digits || 0).toLocaleString('de-DE', {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits || 0
    });
  }

  function formatKg(v) {
    return formatNum(v, 1) + ' kg';
  }

  function formatMoney(v) {
    return formatNum(Math.floor(v)) + ' €';
  }

  function byId(id) {
    return document.getElementById(id);
  }

  /* el('div.card', { id:'x' }, [kind, 'text']) */
  function el(spec, attrs, children) {
    var parts = String(spec).split('.');
    var tag = parts.shift() || 'div';
    var node = document.createElement(tag);
    if (parts.length) node.className = parts.join(' ');

    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var val = attrs[key];
        if (val === null || val === undefined || val === false) return;
        if (key === 'text') node.textContent = val;
        else if (key === 'html') node.innerHTML = val;
        else if (key === 'style') node.setAttribute('style', val);
        else if (key.indexOf('data') === 0 || key.indexOf('aria') === 0) node.setAttribute(key, val);
        else node.setAttribute(key, val === true ? '' : val);
      });
    }

    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (child) {
        if (child === null || child === undefined || child === false) return;
        node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
      });
    }
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  /* Tippen: pointerdown statt click — spart die Klick-Verzoegerung am Handy. */
  /* Ab so vielen Pixeln Fingerweg ist die Geste kein Tipp mehr, sondern
     ein Wischen — dann darf nichts ausgeloest werden. */
  var MOVE_LIMIT = 10;

  function blocked(node) {
    return node.disabled || node.classList.contains('is-locked');
  }

  /* Der normale Tipp: er zaehlt erst beim Loslassen und faellt aus, sobald
     der Finger unterwegs ist.

     Frueher lief der Handler direkt auf pointerdown, samt preventDefault.
     Das kostete zwei Dinge auf einmal: preventDefault nimmt dem Browser
     die Wischgeste, und die Aktion lief schon beim Aufsetzen los. In einer
     scrollbaren Liste (Geraete bei Brust) landete man deshalb im Satz,
     statt zu scrollen. Wo es auf jede Millisekunde ankommt — die Tippflaeche
     im Satz — steht onPress. */
  function onTap(node, handler) {
    var start = null;

    node.addEventListener('pointerdown', function (ev) {
      start = blocked(node) ? null : { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
    });

    node.addEventListener('pointermove', function (ev) {
      if (!start || (ev.pointerId !== undefined && ev.pointerId !== start.id)) return;
      if (Math.abs(ev.clientX - start.x) > MOVE_LIMIT
          || Math.abs(ev.clientY - start.y) > MOVE_LIMIT) {
        start = null;
      }
    });

    /* Beim Scrollen bricht der Browser den Zeiger ab — genau richtig. */
    node.addEventListener('pointercancel', function () { start = null; });

    node.addEventListener('pointerup', function (ev) {
      var had = start;
      start = null;
      if (!had || (ev.pointerId !== undefined && ev.pointerId !== had.id)) return;
      if (blocked(node)) return;
      ev.preventDefault();
      handler(ev);
    });
  }

  /* Sofort beim Aufsetzen — nur fuer die Trefferleiste im Satz. */
  function onPress(node, handler) {
    node.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      if (blocked(node)) return;
      handler(ev);
    });
  }

  function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  MF.core.util = {
    clamp: clamp,
    lerp: lerp,
    round: round,
    formatNum: formatNum,
    formatKg: formatKg,
    formatMoney: formatMoney,
    byId: byId,
    el: el,
    clear: clear,
    onTap: onTap,
    onPress: onPress,
    deepCopy: deepCopy
  };
})(window.MacFit);
