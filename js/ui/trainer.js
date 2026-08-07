/* Der Personal Trainer als Person: er begrüßt am Eingang und fasst zusammen,
   worauf es heute ankommt. Dieselben Hinweise stehen im Körper-Bildschirm —
   gerechnet wird beides in game/coach.js (briefing()), hier wird nur gezeigt.

   Ohne Trainer-Abo passiert nichts: für die Ansprache zahlt man den
   Tagessatz. Am Eingang spricht er höchstens einmal pro Spieltag. */
(function (MF) {
  'use strict';

  var util = MF.core.util;
  var el = util.el;

  var TONE_ICON = { bad: '⛔', warn: '⚠', good: '➡', flat: '•' };

  /* Die Hinweisliste — als Block wiederverwendbar. */
  function notesList(brief) {
    var list = el('div.brief');
    brief.notes.forEach(function (n) {
      list.appendChild(el('div.brief__row.is-' + (n.tone || 'flat'), null, [
        el('span.brief__icon', { text: TONE_ICON[n.tone] || TONE_ICON.flat }),
        el('span.brief__text', { text: n.text })
      ]));
    });
    return list;
  }

  /* Die Einkaufsliste des Trainers: mehrere Vorschläge mit Begründung,
     jeder mit dem Weg in die passende Shop-Kategorie. */
  function shopList(tips, max, onGo) {
    var box = el('div.grid.shoptips');
    tips.slice(0, max || tips.length).forEach(function (tip) {
      var def = tip.def;
      var row = el('div.savebox');
      row.appendChild(el('div.savebox__head', null, [
        el('span.savebox__dot' + (tip.afford ? '.is-ok' : '.is-warn')),
        el('strong', { text: def.icon + ' ' + def.name }),
        el('span.savebox__price' + (tip.afford ? '' : '.is-bad'), {
          text: util.formatMoney(def.price)
        })
      ]));
      row.appendChild(el('span.savebox__text', {
        text: tip.reason + ' Läuft ' + def.days + ' Tage'
            + (tip.afford ? '.' : ' — dafür fehlt dir noch Geld.')
      }));
      var go = el('button.btn.btn--ghost.btn--slim', { type: 'button', text: 'Im Shop ansehen' });
      util.onTap(go, function () {
        MF.game.state.get().settings.shopTab = def.tier;
        MF.game.state.saveSoon();
        /* Aus dem Fenster heraus: erst zumachen, sonst liegt das Modal
           ueber dem Shop, in den es gerade geschickt hat. */
        if (onGo) onGo();
        MF.ui.router.go('shop');
      });
      row.appendChild(go);
      box.appendChild(row);
    });
    return box;
  }

  /* Für den Körper-Bildschirm: Überschrift plus Hinweise, oder null. */
  function panel() {
    var brief = MF.game.coach.briefing();
    if (!brief) return null;

    var box = el('section', { id: 'trainer-brief' });
    box.appendChild(el('div.section-title', null, [
      el('span', { text: '🎯 Ansage des Trainers' }),
      el('span.section-title__note', { text: 'Tag ' + MF.game.state.get().day })
    ]));
    box.appendChild(el('p.hint', { text: brief.hello }));
    box.appendChild(notesList(brief));
    return box;
  }

  /* Die Begrüßung am Eingang. onDone läuft in jedem Fall — auch wenn nichts
     gezeigt wird, denn danach hängt die nächste Einblendung dran.
     Gibt zurück, ob wirklich etwas zu sehen war. */
  function greet(onDone) {
    var go = onDone || function () {};
    var brief = MF.game.coach.briefing();
    var s = MF.game.state.get();
    if (!brief || !s || s.coach.greetedDay === s.day) { go(); return false; }

    s.coach.greetedDay = s.day;
    MF.game.state.saveSoon();

    var body = el('div');
    body.appendChild(notesList(brief));

    /* Die Einkaufsliste steht am Ende — sie kostet Geld, also nicht oben.
       Im Fenster zwei Vorschläge, der Rest steht im Körper-Bildschirm. */
    var closeWindow = null;
    var tips = brief.analysis.shopTips || [];
    if (tips.length) {
      body.appendChild(el('div.section-title', { text: 'Der Trainer würde kaufen' }));
      body.appendChild(shopList(tips, 2, function () {
        if (closeWindow) closeWindow();
        go();
      }));
    }

    closeWindow = MF.ui.modal.open({
      title: '🎯 Dein Trainer wartet schon',
      subtitle: brief.hello,
      body: body,
      actions: [
        { label: 'Alles klar', tone: 'primary', onTap: go },
        { label: 'Ganze Analyse', onTap: function () { MF.ui.stats.go('trainer'); go(); } }
      ]
    });
    return true;
  }

  MF.ui.trainer = { greet: greet, panel: panel, notesList: notesList, shopList: shopList };
})(window.MacFit);
