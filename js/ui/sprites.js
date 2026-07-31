/* Handgezeichnete Raster für die Teile, die nicht mitwachsen.

   Kopf, Faust und Fuß haben eine feste Größe — anders als Arme, Rumpf und
   Beine hängen sie nicht an den Muskelwerten. Als Grundformen gezeichnet sahen
   sie entsprechend aus: zwei 2 x 2 große Klötzchen als Augen, eine Scheibe als
   Hand, ein Rechteck als Schuh. Bei dieser Größe lohnt es sich, jeden Pixel
   selbst zu setzen.

   Ein Zeichen je Pixel. Die Werte in key sind entweder ein Palettenname oder
   ein Rampenversatz — Zahlen gehen dadurch den Hautton mit, auch den fahlen
   bei schlechter Gesundheit:

     .  nichts   k  Kontur (ink)   K  Haar   H  Haarglanz   s  Sohle
     a -3   b -2   c -1   d  Grundton   e +1   f +2

   Die Köpfe sind 19 x 19 und liegen genau auf der Hautscheibe mit Radius 9,5;
   gezeichnet wird an [Kopfmitte - 9, Kopfmitte - 9]. */
(function (MF) {
  'use strict';

  var KEY = {
    '.': null, 'k': 'ink', 'K': 'shadow', 'H': 'steelDark', 's': 'steelDark',
    'a': -3, 'b': -2, 'c': -1, 'd': 0, 'e': 1, 'f': 2
  };

  function sprite(rows) {
    return { w: rows[0].length, h: rows.length, key: KEY, rows: rows };
  }

  /* Von vorn: flacher Haarschnitt, Brauen, Augen, Nasenrücken, Kinnschatten. */
  var HEAD_FRONT = sprite([
    '......KKKKKKK......',
    '....KKKKKKKKKKK....',
    '...KKKKKKKKKKKKK...',
    '..KKKKKKKKKKKKKKK..',
    '.KKKKKKKKKKKKKKKKK.',
    '.KKKKKKKKKKKKKKKKK.',
    'KKKKKKKKKKKKKKKKKKK',
    'KKKeddddddddddddeKK',
    'KKcbbbdddddddbbbcKK',
    'KcddkkddeeeddkkddcK',
    'KcddccddeeeddccddcK',
    'KcdddddddedddddddcK',
    'KcddddddcbcddddddcK',
    '.cddddddcccddddddc.',
    '.cddddddbbbddddddc.',
    '..cdddddddddddddc..',
    '...cbdddddddddbc...',
    '....cbbdddddbbc....',
    '......cbbbbbc......'
  ]);

  /* Von hinten: nur Haar, seitlich ein Streifen Ohr, unten der Nacken. Ein
     Gesicht hier würde die Figur im Kopf des Betrachters zurückdrehen. */
  var HEAD_BACK = sprite([
    '......KKKKKKK......',
    '....KKKKKKKKKKK....',
    '...KKKKHHKKKKKKK...',
    '..KKKHHHKKKKKKKKK..',
    '.KKKKHHKKKKKKKKKKK.',
    '.KKKKHKKKKKKKKKKKK.',
    'KKKKHKKKKKKKKKKKKKK',
    'KKKKKKKKKKKKKKKKKKK',
    'KKKKKKKKKKKKKKKKKKK',
    'KdKKKKKKKKKKKKKKKdK',
    'KdKKKKKKKKKKKKKKKdK',
    'KcKKKKKKKKKKKKKKKcK',
    'KKKKKKKKKKKKKKKKKKK',
    '.KKKKKKKKKKKKKKKKK.',
    '.KKKKKKKKKKKKKKKKK.',
    '..cKKKKKKKKKKKKKc..',
    '...cbdddddddddbc...',
    '....cbdddddddbc....',
    '......cbbbbbc......'
  ]);

  /* Im Profil, Blick nach rechts: Haar über Hinterkopf und Scheitel, vorn
     Stirn, Auge, Nasenrücken und Kinn. */
  var HEAD_SIDE = sprite([
    '......KKKKKKK......',
    '....KKKKKKKKKKK....',
    '...KKKKKKKKKKKKK...',
    '..KKKKKKKKKKKKKKK..',
    '.KKKKKKKKKKKKKKKKK.',
    '.KKKKKKKKKKKKKKKKK.',
    'KKKKKKKKKKKKKKKKKKK',
    'KKKKKKKKKKKKKddddKK',
    'KKKKKKKKKKKddddddKK',
    'KKKKKKKKKKdddddddeK',
    'KKKKKKKKKddkkddddde',
    'KKKKKKKKKdddddddddf',
    'KKKKKKKKcdddddddddd',
    '.KKKKKKcdddddddddd.',
    '.KKKKKcddddddbbddd.',
    '..KKKcddddddddddc..',
    '...cbdddddddddbc...',
    '....cbdddddddbc....',
    '......cbbbbbc......'
  ]);

  /* Derselbe Kopf für den Avatar im Körper-Bildschirm. Der ist mit 99,5 Punkten
     kleiner als die posierende Figur, sein Kopf hat Radius 7,5 statt 9,5 — das
     19er Raster säße dort wie ein Helm. */
  var HEAD_SMALL = sprite([
    '....KKKKKKK....',
    '...KKKKKKKKK...',
    '..KKKKKKKKKKK..',
    '.KKKKKKKKKKKKK.',
    '.KKKKHKKKKKKKK.',
    'KKKKKKKKKKKKKKK',
    'KKdddddddddddKK',
    'KcdkkdddddkkdcK',
    'KcddddddeddddcK',
    'KcdddddcbcdddcK',
    '.cddddbbbddddc.',
    '.cdddddddddddc.',
    '..cbdddddddbc..',
    '...cbbdddbbc...',
    '....cbbbbbc....'
  ]);

  /* Faust: Knöchelreihe oben, Fingerkerben in der Mitte. Feste Größe — eine
     Hand wächst nicht mit dem Bizeps. */
  var FIST = sprite([
    '..kkkkk..',
    '.kdddddk.',
    'kdedededk',
    'kdddddddk',
    'kdcdcdcdk',
    'kdddddddk',
    'kbdddddbk',
    '.kbdddbk.',
    '..kkkkk..'
  ]);

  /* Von vorn sieht man Spann und Sohle. Ohne die beiden Zeilen Spann sass der
     Schuh als flache Platte unter dem Bein statt am Knoechel. */
  var SHOE_FRONT = sprite([
    '.....kkkkkkk.....',
    '...kkKKKKKKKkk...',
    '.kkKKKKKKKKKKKkk.',
    'kKKKKKKKKKKKKKKKk',
    'kKKKKKKKKKKKKKKKk',
    'kKKKKKKKKKKKKKKKk',
    'ksssssssssssssssk',
    '.kkkkkkkkkkkkkkk.'
  ]);

  /* Im Profil zeigt der Fuß nach rechts; für die andere Richtung wird beim
     Zeichnen gespiegelt. */
  var SHOE_SIDE = sprite([
    '.kkkkkkkk......',
    'kKKKKKKKKkk....',
    'kKKKKKKKKKKKkk.',
    'kKKKKKKKKKKKKKk',
    'ksssssssssssssk',
    '.kkkkkkkkkkkkk.'
  ]);

  /* Nur der Ballen steht auf: die vordere Hälfte des Profilschuhs. */
  var SHOE_BALL = sprite([
    '..kkkkkk.',
    '.kKKKKKKk',
    'kKKKKKKKk',
    'ksssssssk',
    '.kkkkkkk.'
  ]);

  MF.ui.sprites = {
    headFront: HEAD_FRONT,
    headBack: HEAD_BACK,
    headSide: HEAD_SIDE,
    headSmall: HEAD_SMALL,
    fist: FIST,
    shoeFront: SHOE_FRONT,
    shoeSide: SHOE_SIDE,
    shoeBall: SHOE_BALL
  };
})(window.MacFit);
