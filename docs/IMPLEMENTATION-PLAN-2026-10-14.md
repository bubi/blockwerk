# Umsetzung der freigegebenen Reviews

Der Auftrag vom 14.10.2026 gibt die schrittweise Umsetzung aller konkreten
Audit-, PO- und UX-Empfehlungen frei. Bestehende Notizen, IDs und Besitzbeziehungen
bleiben erhalten. Die ruhige grüne Identität wird verfeinert.

## Arbeitspakete und Commits

1. Prüfberichte und reproduzierbare Release-Prüfung dokumentieren.
2. Client-Schreibreihenfolge, Rückrollen, Reload-Abgleich, Konfliktschutz und
   serverseitige atomare Zusammenführung absichern.
3. Editor: leere Zeilen, Fokus, Eingabe/Entwurfschutz, Speicherrückmeldung,
   gezieltes Rückgängig und Dialog-/Tastaturbedienung vervollständigen.
4. JFX vollständig laden, direkt erfassen/bearbeiten und nachvollziehbar
   übernehmen; abhängige Neuanlagen ordnen. Schnelle Erfassung und vollständige
   Aufgaben-/Terminpflege mit Erhalt derselben Item-ID ergänzen.
5. Wiederfinden: genaue Treffer, Direktlinks, Suchfilter, erledigte Aufgaben
   und Rückverweise zugänglich machen.
6. Heute/Mobile, Layout, echte Tokenquelle, Kontraste, Touchziele, Begriffe und
   kontextuelle Bedienhilfe überarbeiten.
7. Browserwege, Produktionsbuild und Deployment-Dry-Run prüfen; Betrieb und
   tatsächlich erledigte Punkte dokumentieren.

Die Empfehlungen zu Kanban, Gantt, Anhängen, Terminserien, Kalender-Sync und
komplexer Kapazitätsplanung waren ausdrücklich zurückgestellt und sind keine
Aufträge. Keine Remote-Migrationen, kein Seed gegen Produktion und kein Push
oder Deployment allein aufgrund des Commit-Auftrags.

## Validierung und Datensicherheit

Vor jedem Commit laufen TypeScript, ESLint, Domain-/Clienttests und Worker-/D1-
Tests in einer isolierten Quellkopie. Die finale E2E-Prüfung nutzt ausschließlich
Beispieldaten. Produktionsdaten werden nur für eine neue Sicherung gelesen.
Bestehende, nicht zu diesem Auftrag gehörende Änderungen werden nicht committed.
