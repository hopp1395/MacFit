/* MacFit — globaler Namespace.
   Muss als allererstes Skript geladen werden. Alle weiteren Dateien haengen
   sich an dieses Objekt, damit das Spiel ohne ES-Module ueber file:// laeuft. */
window.MacFit = {
  core: {},
  data: {},
  game: {},
  ui: {}
};
