/* Die Stammgäste, von denen einer zum Rivalen wird. Ausgesucht wird nicht
   frei: die Mitgliedsnummer bestimmt, wer neben dir trainiert — so gehört
   der Rivale zum Spielstand wie die Kartennummer selbst.

   pace     Grundtempo seines Muskelaufbaus (1.0 = Normalmass)
   catchUp  wie stark er reagiert, wenn er zurueckfaellt oder davonzieht
   quality  sein Qualitaetsfaktor im Fitness-Index (Technik, Symmetrie, Werte)
   restDay  an diesem Wochentag seines Zyklus laesst er es aus
   lines    was er am Eingang sagt, nach Lage sortiert */
(function (MF) {
  'use strict';

  var LIST = [
    {
      id: 'kevin', name: 'Kevin Brandt', icon: '💪', short: 'Kevin',
      trait: 'Redet laut, trainiert Brust und Bizeps und sonst wenig.',
      pace: 1.00, catchUp: 1.00, quality: 0.86, restDay: 6,
      lines: {
        first: ['Ah, neu hier? Ich bin Kevin. Die Bank da vorne ist übrigens meine.',
                'Kevin. Trainier hier seit Jahren. Ruf einfach, wenn du abdrücken musst.'],
        ahead: ['Weiß nicht, was du machst, aber ich mach es offensichtlich besser.',
                'Guck ruhig. Das kommt nicht über Nacht — bei dir schon gar nicht.'],
        close: ['Wir sind gleichauf. Das ist statistisch gesehen ein Ausrutscher.',
                'Ganz knapp, ja. Morgen sieht das wieder anders aus.'],
        behind: ['Du hast gerade eine gute Phase. Genieß sie.',
                 'Mein Trainingsplan ist gerade in der Umstellung. Deswegen.'],
        overtook: ['Und vorbei. War ein netter Ausflug an die Spitze, oder?',
                   'Guten Morgen. Ich bin übrigens wieder vor dir.'],
        passed: ['Okay. Okay! Das war Glück. Das war einfach Glück.',
                 'Du hast mich. Sag das bloß niemandem.'],
        lazy: ['Gestern nichts gemacht, was? Sieht man.',
               'Ruhetag ist auch eine Entscheidung. Eine schlechte.']
      }
    },
    {
      id: 'sonja', name: 'Sonja Reuter', icon: '🎽', short: 'Sonja',
      trait: 'Kommt jeden Tag, sagt wenig, macht jede Wiederholung sauber.',
      pace: 0.92, catchUp: 1.15, quality: 0.95, restDay: 0,
      lines: {
        first: ['Morgen. Sonja. Wenn du Hilfe beim Einstellen brauchst, sag Bescheid.',
                'Neu? Dann merk dir: langsam runter ist wichtiger als schwer.'],
        ahead: ['Ich bin nicht schneller. Ich bin nur jeden Tag da.',
                'Der Unterschied zwischen uns sind ungefähr vier Trainingstage.'],
        close: ['Wir liegen gleichauf. Gut. Dann bleibt es spannend.',
                'Fast identisch. Heute entscheidet die Ausführung.'],
        behind: ['Du ziehst an. Sauber gemacht, ehrlich.',
                 'Respekt. Ich häng gerade ein bisschen durch.'],
        overtook: ['Ich bin vorbeigezogen. Nichts Persönliches — nur Regelmäßigkeit.',
                   'Heute steh ich vorne. Hol es dir zurück.'],
        passed: ['Du bist vorbei. Verdient. Ich zieh nach.',
                 'Gut gemacht. Ich nehm das jetzt persönlich.'],
        lazy: ['Gestern gefehlt. Passiert — aber zweimal nicht.',
               'Ein Tag ist kein Drama. Drei sind es.']
      }
    },
    {
      id: 'torsten', name: 'Torsten Klee', icon: '🧢', short: 'Torsten',
      trait: 'Kennt jede Studie, nimmt jedes Pulver und schläft zu wenig.',
      pace: 1.06, catchUp: 0.90, quality: 0.80, restDay: 3,
      lines: {
        first: ['Torsten. Falls du Fragen zu Supplementierung hast — ich hab da was gelesen.',
                'Neu hier? Ich optimier gerade mein Fenster nach dem Training. Spannend.'],
        ahead: ['Das liegt an meinem Timing. Und am Creatin. Vor allem am Timing.',
                'Der Unterschied ist Wissenschaft, nicht Talent.'],
        close: ['Wir sind statistisch nicht unterscheidbar. Noch.',
                'Gleichstand. Ich lese heute Abend nochmal nach.'],
        behind: ['Du bist vorne, aber ich hab die bessere Datenlage.',
                 'Kurzfristig sagt das nichts aus. Langfristig auch nicht.'],
        overtook: ['Überholt. Ich hab die Dosierung angepasst.',
                   'Sagte ich doch. Steht so in der Studie.'],
        passed: ['Interessant. Das muss ich nachrechnen.',
                 'Du liegst vorne. Ich verändere eine Variable.'],
        lazy: ['Kein Reiz gestern, kein Wachstum. Steht in jedem Lehrbuch.',
               'Regeneration ist wichtig. So viel Regeneration aber nicht.']
      }
    },
    {
      id: 'mehmet', name: 'Mehmet Aydın', icon: '🥇', short: 'Mehmet',
      trait: 'Trainiert ruhig, schwer und ohne ein Wort zu viel.',
      pace: 0.96, catchUp: 1.05, quality: 0.91, restDay: 4,
      lines: {
        first: ['Mehmet. Wenn du sicherst, sicher ich auch. So läuft das hier.',
                'Willkommen. Nimm dir Zeit für die Grundübungen, der Rest kommt.'],
        ahead: ['Ich bin vorne. Das heißt nur, dass ich länger dabei bin.',
                'Es ist kein Wettrennen. Aber ja, ich führe.'],
        close: ['Kopf an Kopf. So macht es Spaß.',
                'Gleichstand. Heute zählt jeder Satz.'],
        behind: ['Du bist vorne. Gut. Dann streng ich mich wieder an.',
                 'Ich seh, was du machst. Weiter so.'],
        overtook: ['Heute bin ich vorbeigezogen. Morgen bist du dran.',
                   'Ich führe wieder. Ganz ruhig, ganz langsam.'],
        passed: ['Du hast mich überholt. Ehrlich verdient.',
                 'Sauber. Jetzt lass es nicht wieder los.'],
        lazy: ['Gestern warst du nicht da. Der Körper merkt sich das.',
               'Ein freier Tag ist gut. Zwei sind ein Muster.']
      }
    }
  ];

  var BY_ID = {};
  LIST.forEach(function (r) { BY_ID[r.id] = r; });

  MF.data.rivals = {
    list: LIST,
    get: function (id) { return BY_ID[id] || null; },
    /* Immer derselbe Rivale zu derselben Karte — die Quersumme der
       Mitgliedsnummer entscheidet. Ohne Nummer faellt es auf den ersten. */
    forNumber: function (number) {
      var digits = String(number || '').replace(/[^0-9]/g, '');
      if (!digits) return LIST[0];
      var sum = 0;
      for (var i = 0; i < digits.length; i++) sum += Number(digits.charAt(i));
      return LIST[sum % LIST.length];
    }
  };
})(window.MacFit);
