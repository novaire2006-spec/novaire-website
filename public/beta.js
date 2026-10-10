import { BETA_ENDPOINT, countdownParts, validateApplication } from './beta-core.js';

const form = document.querySelector('#beta-form');
const fields = document.querySelector('#beta-form-fields');
const submit = document.querySelector('#beta-submit');
const status = document.querySelector('#form-status');
const success = document.querySelector('#beta-success');
let sending = false;
let accepted = false;
let closedByServer = false;
let request = null;
let pendingRequestId;
let pendingSignature;

function showStatus(message, kind = 'error') {
  status.textContent = message;
  status.dataset.kind = kind;
  status.hidden = false;
}

function isClosed() {
  return closedByServer || countdownParts().closed;
}

function renderCountdown() {
  const parts = countdownParts();
  const closed = parts.closed || closedByServer;
  for (const [unit, value] of Object.entries(parts)) {
    const label = document.querySelector(`[data-countdown="${unit}"]`);
    if (label) label.textContent = String(closed ? 0 : value).padStart(2, '0');
  }
  document.querySelector('#deadline-status').hidden = !closed;
  document.querySelector('#countdown-label').textContent = closed ? 'Danke für dein Interesse.' : 'Zeit für deine Bewerbung';
  document.querySelector('#hero-apply-link').hidden = closed;
  fields.disabled = sending || accepted || closed;
  if (closed && !accepted && !sending) showStatus('Die Bewerbungsphase ist beendet. Neue Bewerbungen sind nicht mehr möglich.', 'closed');
}

function updateApplicant() {
  const age = Number(form.elements.age.value);
  const under16 = form.elements.age.value !== '' && Number.isInteger(age) && age < 16;
  const self = form.querySelector('[name="applicantKind"][value="self"]');
  self.disabled = under16;
  if (under16 && self.checked) self.checked = false;
  const guardian = form.elements.applicantKind.value === 'guardian' || under16;
  document.querySelector('#name-label').textContent = guardian ? 'Vorname des Kindes, das testen möchte *' : 'Dein Vorname *';
  document.querySelector('#email-label').textContent = guardian ? 'E-Mail-Adresse des Elternteils *' : 'Deine E-Mail-Adresse *';
  document.querySelector('#email-hint').textContent = guardian
    ? 'Bitte die eigene Adresse des Elternteils verwenden, nicht die des Kindes. Vor einer Einladung prüfen wir die Zustimmung.'
    : 'Dorthin schicken wir Rückfragen und eine mögliche Einladung.';
  document.querySelector('#consent-label').textContent = guardian
    ? 'Als Elternteil stimme ich zu, dass Novaire diese Angaben zur Bearbeitung der Beta-Bewerbung meines Kindes und zur Kontaktaufnahme mit mir verwendet. *'
    : 'Ich stimme zu, dass Novaire meine Angaben zur Bearbeitung dieser Beta-Bewerbung und zur Kontaktaufnahme für die Beta verwendet. *';
}

function renderErrors(errors) {
  for (const element of form.querySelectorAll('[aria-invalid="true"]')) element.removeAttribute('aria-invalid');
  for (const element of form.querySelectorAll('.field-error')) {
    element.hidden = true;
    element.textContent = '';
  }
  for (const [key, message] of Object.entries(errors)) {
    const error = document.getElementById(`${key}-error`);
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
    const controls = form.querySelectorAll(`[name="${key}"]`);
    for (const control of controls) control.setAttribute('aria-invalid', 'true');
  }
}

function createRequestId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const responseMessages = {
  400: 'Die Bewerbung konnte nicht verarbeitet werden. Bitte prüfe deine Angaben.',
  403: 'Die Bewerbung konnte nicht gesendet werden. Bitte lade die Seite neu und versuche es noch einmal.',
  413: 'Die Bewerbung ist zu lang. Bitte kürze deine Angaben und versuche es noch einmal.',
  429: 'Gerade werden zu viele Bewerbungen gesendet. Bitte warte einen Moment und versuche es erneut. Deine Angaben bleiben hier erhalten.',
  503: 'Das Formular ist gerade nicht erreichbar. Bitte versuche es später erneut. Deine Angaben bleiben hier erhalten.',
};

form.elements.age.addEventListener('input', updateApplicant);
for (const input of form.querySelectorAll('[name="applicantKind"]')) input.addEventListener('change', updateApplicant);
form.elements.source.addEventListener('change', () => {
  const other = form.elements.source.value === 'other';
  document.querySelector('#source-detail-field').hidden = !other;
  form.elements.sourceDetail.disabled = !other;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (sending || accepted) return;
  if (isClosed()) {
    renderCountdown();
    status.focus();
    return;
  }
  const values = Object.fromEntries(new FormData(form));
  values.consent = form.elements.consent.checked;
  const { errors, payload } = validateApplication(values);
  renderErrors(errors);
  if (Object.keys(errors).length) {
    showStatus('Bitte prüfe die markierten Angaben. Deine Bewerbung wurde noch nicht gesendet.');
    form.querySelector('[aria-invalid="true"]:not(:disabled)')?.focus();
    return;
  }

  // A retry after a lost response retains its id, but an edited application is new.
  const signature = JSON.stringify(payload);
  if (!pendingRequestId || signature !== pendingSignature) {
    pendingRequestId = createRequestId();
    pendingSignature = signature;
  }
  sending = true;
  fields.disabled = true;
  submit.textContent = 'Wird gesendet …';
  form.setAttribute('aria-busy', 'true');
  showStatus('Deine Bewerbung wird sicher übermittelt.', 'pending');
  const controller = new AbortController();
  request = controller;
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(BETA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: pendingRequestId, ...payload }),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    if (response.status === 410) {
      closedByServer = true;
      showStatus('Die Bewerbungsphase ist beendet. Danke für dein Interesse.', 'closed');
      status.focus();
      return;
    }
    let result;
    try { result = await response.json(); } catch { result = null; }
    if (response.status !== 202 || result?.accepted !== true) {
      showStatus(responseMessages[response.status] || 'Deine Bewerbung konnte gerade nicht bestätigt werden. Bitte versuche es erneut. Deine Angaben bleiben hier erhalten.');
      status.focus();
      return;
    }
    accepted = true;
    form.hidden = true;
    success.hidden = false;
    success.focus({ preventScroll: true });
    success.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  } catch (error) {
    showStatus(error?.name === 'AbortError'
      ? 'Die Verbindung hat zu lange gedauert. Bitte versuche es erneut. Deine Angaben bleiben hier erhalten.'
      : 'Es gab ein Verbindungsproblem. Bitte prüfe deine Internetverbindung und versuche es erneut. Deine Angaben bleiben hier erhalten.');
    status.focus();
  } finally {
    clearTimeout(timeout);
    request = null;
    sending = false;
    form.removeAttribute('aria-busy');
    submit.textContent = 'Bewerbung senden ↗';
    renderCountdown();
    updateApplicant();
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderCountdown();
});
window.addEventListener('pagehide', () => request?.abort());
form.elements.sourceDetail.disabled = true;
updateApplicant();
renderCountdown();
setInterval(renderCountdown, 1000);
