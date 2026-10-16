# Novaire Website – Update vom 16. Oktober 2026

Fertiger Website-Code für das bestehende Repository
`novaire2006-spec/novaire-website`. Dieses Paket wurde lokal getestet,
nicht zu GitHub gepusht und nicht auf Vercel veröffentlicht.

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
- Keine Änderungen an Formular-Versand, Supabase, Designstruktur oder App.

Vercels Standard-Preview-URLs behalten ihren plattformseitigen noindex-Schutz.
Bei eigenen Preview-Domains den Schutz gesondert prüfen. noindex ist keine
Zugriffskontrolle.

## Lokale Prüfung

```sh
npm run build
npm test
npm run preview
```

24 Tests bestanden, darunter Indexierung, Canonicals, Sitemap, lokale Links,
Sicherheitsheader, Formularvalidierung, Frist und Halloween-Farben.
Zusätzlich lokal per HTTP geprüft: sechs öffentliche Seiten 200 ohne
noindex-Header, robots.txt und Sitemap 200, unbekannte URL 404 mit noindex.
Keine echte Bewerbung wurde im Rahmen dieses Updates abgeschickt.

Quellen:
- https://developers.google.com/search/docs/crawling-indexing/block-indexing
- https://vercel.com/docs/headers/response-headers
