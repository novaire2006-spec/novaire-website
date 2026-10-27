# Novaire Website – Update vom 27. Oktober 2026

Fertiger Website-Code für das bestehende Repository
`novaire2006-spec/novaire-website`. Vercel baut den Stand von `main` mit
`node tools/build.mjs`; ausgeliefert wird ausschließlich `public`.

## Neu: App-Einblicke, Live-Zähler und Englisch

- Vier echte Flutter-Ansichten mit Beispielinhalten: Nova Live, Karteikarten,
  Podcasts und Coding. Die Screenshots selbst zeigen die deutschsprachige App.
- Der öffentliche Zähler liest ausschließlich `{count, updatedAt}` über
  `GET https://naafzrrhjsfaqqrnhrcn.supabase.co/functions/v1/beta-application/count`.
  Höchstens ein Abruf pro Minute bei sichtbarer Seite, fünf Sekunden Timeout.
  Fehler zeigen keine erfundene Null; ein alter Wert wird als veraltet markiert.
- Der Supabase-Endpunkt nutzt einen serverseitigen HEAD-Abruf mit exakter
  Gesamtzahl, 60-Sekunden-Cache und drei Sekunden Timeout. Keine öffentlichen
  Tabellenrechte oder Bewerbungstexte. Backend im separaten App-Repository,
  Versionsheader `2026-10-27-beta-v3-public-count`.
- Alle sieben Seiten unterstützen `?lang=en`. Der DE/EN-Button übersetzt
  Texte, Metadaten, Formularhinweise und Fehler lokal mit kurzem Blur-Übergang.
  Keine Übersetzungs-API, kein Browser-Speicher. Formulareingaben bleiben erhalten.
  Bei reduzierten Bewegungen erfolgt der Wechsel ohne Animation.
- Rechtstexte werden aus `tools/legal-content.mjs` generiert. Neue öffentliche
  Texte auch in `public/translations-en.js` ergänzen; deutsche Seiten bleiben
  die kanonischen URLs. Bestehendes Halloween-Design und Bewerbungsfrist bleiben.

## Hochladen

1. ZIP entpacken.
2. Den Inhalt (`public`, `tools`, `package.json`, `vercel.json` und diese
   README) ins Hauptverzeichnis des bestehenden GitHub-Repositories hochladen.
   Vorhandene Dateien ersetzen. Nicht nur die ZIP selbst hochladen und keinen
   zusätzlichen Unterordner dazwischenschieben.
3. Die Änderungen auf `main` committen. Bei aktiver Vercel-Git-Verknüpfung
   startet dadurch ein neues Deployment. Anschließend den Status prüfen.
4. Vercel bleibt bei Framework „Other“, Build `node tools/build.mjs`,
   Output `public`. Bestehende Domains, DNS und Backend bleiben unverändert.
5. In Google Search Console die Live-URL erneut prüfen und danach
   „Indexierung beantragen“. Sitemap:
   `https://www.novaireai.de/sitemap.xml`.

Google entscheidet selbst über Aufnahme und Zeitpunkt; eine freigegebene Seite
ist nicht automatisch bereits indexiert.

## Änderungen

- Öffentliche Seiten: `index, follow` statt `noindex, nofollow`.
- Globaler blockierender `X-Robots-Tag` aus Vercel-Konfiguration entfernt.
- Canonical-URLs auf der bereits verwendeten Hauptdomain
  `https://www.novaireai.de`, passend zu Clean URLs.
- Build erzeugt offene robots.txt und Sitemap der sechs öffentlichen Seiten.
- 404 bleibt `noindex`; interne Dateien stehen nicht in der Sitemap.
- Nur „feiern“ ist Halloween-Grün, der übrige Halloween-Schriftzug orange.
  Wortlaut und Bewerbungsfrist bleiben unverändert.
- Der bestehende Bewerbungs-POST, Einwilligungsversion und Frist bleiben unverändert.
  Der zusätzliche Supabase-Abruf ist nur der öffentliche Gesamtzähler.

Vercels Standard-Preview-URLs behalten ihren plattformseitigen noindex-Schutz.
Bei eigenen Preview-Domains den Schutz gesondert prüfen. noindex ist keine
Zugriffskontrolle.

## Lokale Prüfung

```sh
npm run build
npm test
npm run preview
```

48 Website-Tests bestanden, darunter Indexierung, Canonicals, Sitemap, lokale Links,
Sicherheitsheader, Formularvalidierung, Frist, Halloween-Farben, Sprache und Counter.
Zusätzlich 33 Backend-Tests bestanden (Node-Kompatibilitätsrunner im App-Projekt).
Zusätzlich lokal per HTTP geprüft: sechs öffentliche Seiten 200 ohne
noindex-Header, robots.txt und Sitemap 200, unbekannte URL 404 mit noindex.
Keine echte Bewerbung wurde im Rahmen dieses Updates abgeschickt.

Quellen:
- https://developers.google.com/search/docs/crawling-indexing/block-indexing
- https://vercel.com/docs/headers/response-headers
