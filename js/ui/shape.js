/* Koerperbau — die eine Stelle, an der aus Muskelwerten und Fettstand
   Rumpfmasse werden.

   Drei Renderer zeichnen dieselbe Figur in drei Groessen: poses.js (129,5
   Punkte hoch), avatar.js (99,5) und figure.js (91). Jeder hat seine Breiten
   bisher selbst gerechnet, mit leicht anderen Zahlen — jede Aenderung musste
   an drei Stellen nachgezogen werden, und figure.js kannte das Koerperfett
   ueberhaupt nicht.

   Hier stehen die Rohmasse in POSEN-EINHEITEN, also VOR dem Groessenfaktor
   des Renderers:
     poses.js   k = 1,35
     avatar.js  k = 1,04   (= 1,35 x 0,77)
     figure.js  k = 0,945  (= 1,35 x 0,70) — im Seitenriss sind die Rumpfmasse
                unsichtbar, die Gliedmassen aber dieselben.

   Die Namen sagen, welches Mass gemeint ist:
     *Half   halbe Breite ab der Mittelachse (Rumpf)
     *W      volle Strichstaerke (Gliedmassen) */
(function (MF) {
  'use strict';

  var util = MF.core.util;

  var K = { poses: 1.35, avatar: 1.04, figure: 0.945 };

  /* lean und soft kommen von aussen herein statt aus game/fat.js: beim
     Rivalen posiert ein fremder Koerper, dessen Fettstand nicht der eigene
     ist. Ohne muscles ist der eigene Koerper gemeint. */
  function of(muscles, lean, soft) {
    var m = muscles || MF.game.state.get().muscles;
    function f(id) { return util.clamp(m[id].size / 100, 0, 1); }

    /* Wie weit der Oberkoerper entwickelt ist. Training zieht den Keil
       zusaetzlich auf: der Latissimus faechert breiter aus, als seine reine
       Masse hergibt. */
    var top = f('ruecken') * 0.62 + f('schultern') * 0.38;
    var latHalf = (5.75 + f('ruecken') * 6.5) * (1 + top * 0.10);
    var shoulderHalf = 8.7 + f('schultern') * 4.2;
    /* Aussenkante des Deltamuskels — die aeussere Silhouette der Schulter. */
    var shoulderOuter = shoulderHalf * 1.44;

    /* Die Taille aus drei Anteilen:
         Grundmass    was jeder Rumpf hat
         Bauchmuskel  schwach gewichtet. Ein trainierter Bauch ist hart, nicht
                      breit — mit dem alten Anteil (4,7 auf die volle Breite)
                      bekam ein austrainierter Spieler eine BREITERE Taille,
                      und das arbeitete direkt gegen die V-Form
         Fett         definiert zieht zusammen, weich baucht aus. Vorher
                      wirkte Fett nur nach unten und ueber 26 Prozent gar
                      nicht mehr. */
    var waistHalf = (5.8 + f('bauch') * 1.1)
      * (1 - lean * 0.22) * (1 + soft * 0.30);

    /* Die breiteste Stelle des Rumpfes, knapp ueber dem Hosenbund. Ohne Fett
       ist das die uebliche Kerbe ueber dem Hueftknochen, und die Silhouette
       bleibt exakt die alte.

       Die Taille DARF dabei breiter werden als der Latissimus — genau so
       sieht ein unfoermiger Koerper aus. Sie darf nur nicht die Schulterlinie
       ueberholen, sonst steht die Figur als auf dem Kopf stehender Keil da.
       Diese Deckelung steht hier und nur hier; mit den heutigen Zahlen greift
       sie nie, sie ist das Gelaender fuers Nachjustieren. */
    var bulgeHalf = Math.min(waistHalf * (1.06 + soft * 0.30),
      shoulderOuter * 0.86);

    /* Beine und Huefte. Sie standen frueher in jedem Renderer einzeln und
       waren rund ein Sechstel staerker: der Schenkel allein war so breit wie
       die halbe Taille, und weil beide Schenkel unter einem Rumpf stehen,
       verschmolzen sie zu einem Block, der breiter war als die Schultern.
       Seit sich die Taille verjuengt, fiel das erst richtig auf. */
    var thighW = 7.3 + f('beine') * 3.2;

    return {
      latHalf: latHalf,
      shoulderHalf: shoulderHalf,
      waistHalf: waistHalf,
      bulgeHalf: bulgeHalf,
      thighW: thighW,
      calfW: 5.2 + f('waden') * 2.6,             /* 0,72 x thighW */
      /* Die Schenkel sitzen unter dem Rumpf, nicht daneben. */
      hipHalf: thighW * 0.33,
      belly: soft,
      lean: lean,
      top: top
    };
  }

  /* Der eigene Koerper — der Normalfall. */
  function own() {
    return of(null, MF.game.fat.definition(), MF.game.fat.softness());
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  /* Halbe Rumpfbreite auf Hoehe u (0 = Achselhoehe, 1 = Taille).

     w braucht latHalf, waistHalf, bulgeHalf und belly — in welcher Einheit,
     entscheidet der Aufrufer: das Posenbild gibt seine bereits mit k=1,35
     skalierten Masse herein, der Avatar seine mit k=1,04. Herauskommt dieselbe
     Kurve in derselben Einheit.

     Der Latissimus setzt direkt unter der Achsel an, ist dort am breitesten
     und laeuft keilfoermig zur Taille aus. Mit Fett wandert die engste Stelle
     nach OBEN: unter den Rippen zieht der Rumpf noch ein, darunter geht es
     wieder heraus — das ist der Bauch ueber dem Hosenbund. Ohne Fett faellt uW
     auf 0,86 zurueck, der vierte Abschnitt laeuft leer, und die Kurve ist
     Punkt fuer Punkt die alte.

     Bewusst als Verschiebung der Stuetzstellen und nicht als aufaddierte
     Woelbung: addiert man eine Beule auf die abfallende Keilkurve, entsteht
     beim breiten Ruecken davor eine Delle — der Umriss faellt, steigt und
     faellt wieder, und ein Polygonzug zeigt das als Welle. */
  function torsoW(w, u) {
    var uW = 0.86 - (w.belly || 0) * 0.24;
    var mid = w.waistHalf * 1.06;
    /* Die Achselhoehle: direkt unter dem Deltamuskel zieht sich der Rumpf kurz
       ein, bevor der Latissimus ausfaechert. Diese Einbuchtung ist der Grund
       fuer den Polygonzug — ein Stapel Kapseln kann sie nicht abbilden, weil
       die Vereinigung konvexer Formen immer konvex bleibt. */
    if (u < 0.08) return lerp(w.latHalf * 0.92, w.latHalf * 0.78, u / 0.08);
    if (u < 0.30) return lerp(w.latHalf * 0.78, w.latHalf, (u - 0.08) / 0.22);
    /* Von der breitesten Stelle keilfoermig zur Taille, zum Schluss etwas
       schneller — das gibt die Kerbe ueber dem Hueftknochen. */
    if (u < uW) return lerp(w.latHalf, mid, (u - 0.30) / (uW - 0.30));
    if (u < 0.86) return lerp(mid, w.bulgeHalf, (u - uW) / (0.86 - uW));
    /* Zum Schluss wieder herein: der Umriss muss unter dem Hosenbund
       schliessen, sonst steht der Rumpf als dunkles Ohr neben der Hose. */
    return lerp(w.bulgeHalf, w.waistHalf, (u - 0.86) / 0.14);
  }

  MF.ui.shape = { of: of, own: own, torsoW: torsoW, K: K };
})(window.MacFit);
