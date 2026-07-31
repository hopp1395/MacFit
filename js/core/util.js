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
  function onTap(node, handler) {
    node.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      if (node.disabled || node.classList.contains('is-locked')) return;
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
    deepCopy: deepCopy
  };
})(window.MacFit);
