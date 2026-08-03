/* Zugangsdaten zum Supabase-Projekt (MacFit Online).

   Beide Werte sind bewusst oeffentlich: die URL benennt das Projekt, der
   Publishable Key weist den Client nur aus. Was ein Konto sehen und
   schreiben darf, entscheidet allein die Datenbank per Row Level Security —
   hier steht kein Geheimnis. Sind die Werte leer, meldet cloud.isSupported()
   false und das Spiel zeigt einen Hinweis statt zu starten. */
window.MacFit.cloudConfig = {
  url: 'https://cwthjenqgpdrgplxfhkl.supabase.co',
  anonKey: 'sb_publishable_0wT3nHFz3Nru48-UlvXAhA_s26Gneez'
};
