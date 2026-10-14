# Befehle direkt an bestehenden Zeilen

Eine Zeile oder ihre Mehrfachauswahl muss nicht mehr zum Composer am Blockende
verlassen werden. `/` im Zeilenmodus öffnet das Befehlsmenü direkt an der Zeile.
Im Textfeld funktioniert das unabhängig von der Cursorposition; Cmd/Ctrl+/
öffnet es unabhängig von der Cursorposition. Ein dauerhafter `/`-Knopf entfällt. Auf Touchgeräten öffnet die Slash-Eingabe
im Textfeld das Menü; Texte und Aktionen teilen sich dadurch weniger Platz. URL-Trennzeichen und bereits begonnene Pfade bleiben normale Texteingaben.
Eingefügte Pfade werden nicht als Befehl behandelt; einen neuen Schrägstrich
kannst du im Menü mit „Als Text einfügen“ übernehmen.

`/merge` verwendet eine vorhandene Mehrfachauswahl. Ohne Auswahl wird ein klar
angezeigtes Paar angeboten: aktuelle und nächste normale Notiz, am Ende aktuelle
und vorherige. Überschriften, Aufgaben, Termine, Verweise und Kindnotizen bilden
Grenzen. Vorschau und Anzahl stehen vor der Ausführung im Menü. Die Zusammenführung
nutzt auch für große Auswahlen eine feste Zahl von SQL-Parametern (höchstens
1.000 Zeilen, weiterhin höchstens 10.000 Zeichen Ergebnistext) und bleibt atomar und erhält die erste ID. Der bisherige Composer unterstützt weiterhin
Auswahl oder die zuletzt fokussierte benachbarte Paarung.

`/task`, `/event`, `/heading` und `/note` wandeln die aktuelle Zeile um. Text und ID
bleiben erhalten; die passende Metadatenänderung erfolgt in derselben geschützten
Datenbankoperation. `/ref` fragt einen Zielblock ab. `/jfx` verschiebt eine normale
Notiz mit gleicher ID in den Jour-Fix-Block des gewählten oder aktuellen Bereichs.
Kindnotizen und Aufgaben mit eigenen Notizen werden vor unpassender Umwandlung
bewahrt. Umwandlung und Merge bleiben über das vorhandene Rückgängig erreichbar.

Befehlsfilter sind vorübergehende UI-Eingaben und werden nicht als Notiz gespeichert.
Escape schließt das Menü und stellt Fokus/Cursor wieder her. „Als Text einfügen“
oder Shift+Enter fügt den getippten Befehl als normalen Text ein. Ein fehlgeschlagener
Befehl hält Auswahl und Originale fest. Der Server prüft zusätzlich den Quelltext,
damit ein noch ungespeicherter Entwurf nicht durch Merge, Umwandeln oder Verschieben
verworfen wird. Neue optionale Felder bleiben mit alten API-Clients kompatibel.

Gezielte Tests prüfen Tastatur-Merge ohne Composer-Wechsel, benachbarte Paarung,
Abbruch und literalen Text, gleichbleibende IDs, fehlgeschlagenen Merge, mobile
Verweise sowie Server-Konflikte bei ungespeicherten Entwürfen. Bestehende Notizen
werden weder migriert noch umgeschrieben.
