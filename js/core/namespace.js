/* MacFit — globaler Namespace.
   Muss als allererstes eigenes Skript geladen werden (nur die Fremdbibliothek
   in js/vendor/ kommt davor). Alle weiteren Dateien haengen sich an dieses
   Objekt, damit das Spiel ohne ES-Module laeuft. Seit MacFit Online braucht
   der Start eine Verbindung zu Supabase — der alte file://-Betrieb ist damit
   Geschichte; lokal testet man ueber einen kleinen HTTP-Server. */
window.MacFit = {
  /* Von Hand gepflegt — es gibt keinen Build-Schritt, der sie setzen koennte.
     Sichtbar im Vorspann. Die dritte Stelle wird VOR JEDEM Push erhoeht, auch
     bei kleinen Aenderungen: nur daran ist auf dem Geraet zu erkennen, ob
     GitHub Pages schon den neuen Stand ausliefert. Die ersten beiden Stellen
     bleiben spuerbaren Aenderungen vorbehalten. */
  version: '1.9.3',
  core: {},
  data: {},
  game: {},
  ui: {}
};
