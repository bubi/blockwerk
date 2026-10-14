# 0019: Entwürfe, gezieltes Undo und kontextgebundene Erfassung

## Entscheidung

Text-PATCHes werden kurz zusammengefasst; vor abhängigen Änderungen werden sie
geflusht. Fehlgeschlagener Text bleibt als sichtbarer Entwurf erhalten. Composer-
und Zeilenentwürfe liegen lokal pro Kontext; Wiederherstellung vorhandener Zeilen
ist eine ausdrückliche Benutzeraktion, kein stilles Überschreiben nach einem Reload.

Die letzten zehn bestätigten Zeilen-Löschungen, Zusammenführungen und Umwandlungen
haben gezielte Gegenoperationen. `POST /api/items/restore` stellt nur betroffene
Items unter derselben ID und mit originalem `created_at` wieder her. Existierende
IDs bzw. neuere Revisionen werden niemals still überschrieben. D1-Batches brechen
bei einer fehlgeschlagenen Compare-and-swap-Prüfung vollständig ab.

Eine Umwandlung verändert dieselbe Item-ID. Aufgaben mit Kindnotizen können nicht
zu Nicht-Aufgaben werden, bevor ihre Kindnotizen ausdrücklich behandelt sind.
Die Gegenoperation ist an die Revision des Ergebnisses gebunden.

Heute und Mobil erhalten einen Erfassungseinstieg mit sichtbarem Zielbereich.
Erfassung bleibt im bestehenden Bereich/Seite/Block/Item-Modell. JFX und „Ohne
Kontext“ werden erst beim Speichern angelegt; neue Kontextblöcke besitzen stabile
IDs, bestehende werden weiterverwendet. Die JFX-Zuordnung bleibt kompatibel zu
alten Blöcken mit Titel „Jour Fix“; deren Umbenennung wird verhindert.

## Grenzen

Undo lebt in der aktuellen Sitzung und ersetzt keinen Papierkorb oder Backup.
Es wird kein Gesamtzustand zurückgesetzt. Remote-Migrationen sind nicht nötig.
Das lokale Entwurfsarchiv ist keine Offline-Synchronisierung.
