/* Screen-Verwaltung. Ein Screen ist sichtbar, der Rest liegt still. */
(function (MF) {
  'use strict';

  var screens = {};
  var currentName = null;

  /* def: { elementId, render(container, params), leave() } */
  function register(name, def) {
    screens[name] = def;
  }

  function go(name, params) {
    var def = screens[name];
    if (!def) {
      console.warn('[MacFit] Unbekannter Screen:', name);
      return;
    }

    if (currentName && currentName !== name && screens[currentName].leave) {
      screens[currentName].leave();
    }

    Object.keys(screens).forEach(function (key) {
      var node = MF.core.util.byId(screens[key].elementId);
      if (node) node.classList.toggle('is-active', key === name);
    });

    currentName = name;
    document.body.setAttribute('data-screen', name);

    var container = MF.core.util.byId(def.elementId);
    if (container) {
      container.scrollTop = 0;
      def.render(container, params || {});
    }

    updateTabs();
    MF.core.events.emit('screen:changed', name);
  }

  /* Nur neu zeichnen, wenn der Screen gerade sichtbar ist. */
  function refresh(name) {
    if (name && name !== currentName) return;
    if (!currentName) return;
    var def = screens[currentName];
    var container = MF.core.util.byId(def.elementId);
    var top = container ? container.scrollTop : 0;
    if (container) {
      def.render(container, {});
      container.scrollTop = top;
    }
  }

  function updateTabs() {
    var buttons = document.querySelectorAll('#tabbar button');
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-tab') === currentName);
    });
  }

  function initTabs() {
    var buttons = document.querySelectorAll('#tabbar button');
    Array.prototype.forEach.call(buttons, function (btn) {
      MF.core.util.onTap(btn, function () {
        go(btn.getAttribute('data-tab'));
      });
    });
  }

  MF.ui.router = {
    register: register,
    go: go,
    refresh: refresh,
    initTabs: initTabs,
    current: function () { return currentName; }
  };
})(window.MacFit);
