/* MacFit — globaler Namespace.
   Muss als allererstes Skript geladen werden. Alle weiteren Dateien haengen
   sich an dieses Objekt, damit das Spiel ohne ES-Module ueber file:// laeuft. */
window.MacFit = {
  /* Von Hand gepflegt — es gibt keinen Build-Schritt, der sie setzen koennte.
     Sichtbar im Vorspann; bei spuerbaren Aenderungen hochzaehlen. */
  version: '1.1',
  core: {},
  data: {},
  game: {},
  ui: {}
};
