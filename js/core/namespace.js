/* MacFit — globaler Namespace.
   Muss als allererstes Skript geladen werden. Alle weiteren Dateien haengen
   sich an dieses Objekt, damit das Spiel ohne ES-Module ueber file:// laeuft. */
window.MacFit = {
  /* Von Hand gepflegt — es gibt keinen Build-Schritt, der sie setzen koennte.
     Sichtbar im Vorspann. Die dritte Stelle wird VOR JEDEM Push erhoeht, auch
     bei kleinen Aenderungen: nur daran ist auf dem Geraet zu erkennen, ob
     GitHub Pages schon den neuen Stand ausliefert. Die ersten beiden Stellen
     bleiben spuerbaren Aenderungen vorbehalten. */
  version: '1.1.16',
  core: {},
  data: {},
  game: {},
  ui: {}
};
