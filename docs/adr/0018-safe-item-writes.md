# 0018: Geordnete Writes und atomare Notiz-Zusammenführung

## Entscheidung

Der Client ordnet Schreibvorgänge. Der vorhandene `updated_at`-Zeitstempel wird
für Item-PATCH als optimistische Revision über `If-Match` verwendet. Der Worker
prüft sie im UPDATE selbst und erhöht den Wert monoton; Konflikte liefern 409.
Es werden keine bestehenden Daten neu nummeriert und keine Migration benötigt.

`POST /api/items/merge` empfängt ausgewählte IDs und Revisionen. Der Server prüft
Notizart, gemeinsamen Block und Textlänge und führt die Änderung der ersten Zeile
und das Löschen der übrigen Zeilen in einem guarded D1-Batch aus. `changes()` bindet
Deletes an die erfolgreiche Änderung desselben Batches. Bei veralteter Auswahl
bleiben sämtliche Originale erhalten. Automatische Wiederholung dieser Operation
ist deaktiviert; ein unklarer Netzwerkabschluss verlangt einen Reload.

Ein Reload ersetzt den Inhalt seiner Blöcke, legt aber ausstehende lokale Writes
wieder darüber. Fehlgeschlagene Writes dürfen neuere Änderungen nicht zurückrollen.

## Grenzen

Alte Clients ohne `If-Match` bleiben kompatibel. Der Schutz betrifft aktuell
Item-PATCH; ein universelles Revisionierungsmodell aller Tabellen wäre eine
separate Architekturentscheidung. Echtzeit-Kollaboration wird nicht eingeführt.
