export function invitationToken(url) {
  try {
    const uri = new URL(url);
    const params = [...uri.searchParams];
    if (!['/freunde', '/freunde/'].includes(uri.pathname) || uri.hash ||
        params.length !== 1 || params[0][0] !== 'einladung' ||
        !/^[a-f0-9]{64}$/.test(params[0][1])) return null;
    return params[0][1];
  } catch { return null; }
}

export function invitationLinks(token) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return {
    app: `mylenova://friend-invite?token=${token}`,
    web: `https://novaireai.de/freunde?einladung=${token}`,
  };
}

if (typeof document !== 'undefined') {
  const token = invitationToken(window.location.href);
  const links = token && invitationLinks(token);
  const status = document.getElementById('status');
  if (!links) {
    document.getElementById('title').textContent = 'Einladung unvollständig.';
    document.getElementById('description').textContent = 'Bitte öffne den vollständigen Link aus deiner Nachricht oder bitte um eine neue Einladung.';
  } else {
    const open = document.getElementById('open-app');
    open.href = links.app;
    open.hidden = false;
    open.addEventListener('click', () => {
      status.textContent = 'Falls Novaire nicht startet: Installiere die Beta über deine persönliche TestFlight-Einladung und öffne diesen Link danach erneut.';
    });
    const copy = document.getElementById('copy-link');
    copy.hidden = false;
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(links.web);
        status.textContent = 'Kopiert. Du kannst den Link auch in Novaire unter „Freunde“ einfügen.';
      } catch {
        status.textContent = 'Kopieren gerade nicht möglich. Kopiere bitte den vollständigen Link aus deiner ursprünglichen Nachricht.';
      }
    });
  }
}
