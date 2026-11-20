const bundle = 'com.armindaniel.premiumapp';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const result = await fetch('https://itunes.apple.com/lookup?country=de&bundleId=' + bundle, {signal:AbortSignal.timeout(5000)});
    if (!result.ok) throw Error();
    const {results} = await result.json();
    if (!Array.isArray(results)) throw Error();
    const app = results.find(row => row.bundleId === bundle && Number.isSafeInteger(row.trackId) && row.trackId > 0);
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    return res.status(200).json({url:app ? 'https://apps.apple.com/de/app/id' + app.trackId : null});
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({});
  }
}
