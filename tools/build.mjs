import { writeFile, mkdir } from 'node:fs/promises';
import { pages } from './legal-content.mjs';
const root = new URL('../public/', import.meta.url);
// Match the existing production redirect to www and Vercel's clean URLs.
const siteOrigin = 'https://www.novaireai.de';
await mkdir(root, { recursive: true });
const links = '<a href="beta.html">Beta testen</a><a href="support.html">Support</a><a href="datenschutz.html">Datenschutz</a><a href="impressum.html">Impressum</a><a href="agb.html">Nutzungsbedingungen</a>';
for (const [slug, page] of Object.entries(pages)) {
  const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#050507"><meta name="robots" content="index, follow"><link rel="canonical" href="${siteOrigin}/${slug}"><title>${page.title} — Novaire</title><link rel="icon" href="assets/novaire-logo.png" type="image/png"><link rel="stylesheet" href="styles.css"><script src="app.js" defer></script></head>
<body><a class="skip-link" href="#inhalt">Zum Inhalt</a><header class="site-header legal-header"><a class="text-link" href="index.html">← Zur Startseite</a><a class="header-wordmark" href="index.html">NOVAIRE</a></header><main id="inhalt" class="legal-main"><h1>${page.title}</h1><p class="updated">Novaire · Stand 10. Oktober 2026</p>${page.body}</main><footer class="site-footer"><a class="footer-wordmark" href="index.html">NOVAIRE</a><nav aria-label="Rechtliches und Kontakt">${links}</nav><div class="footer-bottom"><span>© 2026 Novaire · Armin Brnicanin</span><span>Dein Universum mit Wissen.</span></div></footer></body></html>\n`;
  await writeFile(new URL(`${slug}.html`, root), html);
}
await writeFile(new URL('404.html', root), '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Seite nicht gefunden — Novaire</title><link rel="stylesheet" href="/styles.css"></head><body><main class="legal-main"><p class="eyebrow">NOVAIRE</p><h1>Hier geht es nicht weiter.</h1><p>Die gesuchte Seite wurde nicht gefunden.</p><a href="/">Zur Startseite</a></main></body></html>');
const publicPaths = ['/', '/beta', ...Object.keys(pages).map((slug) => `/${slug}`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicPaths.map((pathname) => `  <url><loc>${siteOrigin}${pathname}</loc></url>`).join('\n')}
</urlset>
`;
await writeFile(new URL('sitemap.xml', root), sitemap);
await writeFile(new URL('robots.txt', root),
  `User-agent: *\nAllow: /\n\nSitemap: ${siteOrigin}/sitemap.xml\n`);
console.log('Generated public information pages, robots.txt and sitemap.xml. Internal files are not shipped.');
