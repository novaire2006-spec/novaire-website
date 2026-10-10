export const BETA_DEADLINE = Date.parse('2026-10-30T23:00:00Z');
export const BETA_PRIVACY_VERSION = '2026-10-beta-v1';
export const BETA_ENDPOINT = 'https://naafzrrhjsfaqqrnhrcn.supabase.co/functions/v1/beta-application';

/** The cutoff is midnight in Berlin: applications include all of 30 October. */
export function countdownParts(now = Date.now()) {
  const remaining = Math.max(0, BETA_DEADLINE - now);
  const seconds = Math.ceil(remaining / 1000);
  return {
    closed: now >= BETA_DEADLINE,
    days: Math.floor(seconds / 86400),
    hours: Math.floor(seconds / 3600) % 24,
    minutes: Math.floor(seconds / 60) % 60,
    seconds: seconds % 60,
  };
}

const sources = new Set(['tiktok', 'instagram', 'friends', 'search', 'other']);
const availabilityOptions = new Set(['weekly', 'several_weekly', 'daily']);
const text = (value) => typeof value === 'string' ? value.trim() : '';

/** Client checks aid input; authorization, limits and cutoff are server-side. */
export function validateApplication(values) {
  const errors = {};
  const name = text(values.name);
  const ageText = typeof values.age === 'number' ? String(values.age) : text(values.age);
  const age = /^\d{1,2}$/.test(ageText) ? Number(ageText) : NaN;
  const email = text(values.email);
  const source = text(values.source);
  const sourceDetail = source === 'other' ? text(values.sourceDetail) : '';
  const motivation = text(values.motivation);
  const device = text(values.device);
  const gradeText = typeof values.grade === 'number' ? String(values.grade) : text(values.grade);
  const grade = gradeText === '' ? null : /^\d{1,2}$/.test(gradeText) ? Number(gradeText) : NaN;
  const availability = text(values.availability) || null;
  const applicantKind = text(values.applicantKind);
  const website = text(values.website);

  if (name.length < 2 || name.length > 80) errors.name = 'Bitte gib einen Vornamen oder Rufnamen mit 2 bis 80 Zeichen ein.';
  if (!Number.isInteger(age) || age < 10 || age > 99) errors.age = 'Bitte gib ein ganzzahliges Alter zwischen 10 und 99 Jahren ein.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = 'Bitte gib eine gültige E-Mail-Adresse ein.';
  if (!sources.has(source)) errors.source = 'Bitte wähle aus, woher du Novaire kennst.';
  if (sourceDetail.length > 150) errors.sourceDetail = 'Bitte beschränke diese Angabe auf 150 Zeichen.';
  if (motivation.length < 20 || motivation.length > 2000) errors.motivation = 'Ein bis zwei Sätze reichen. Bitte schreibe mindestens 20 und höchstens 2.000 Zeichen.';
  if (device.length > 80) errors.device = 'Bitte beschränke das iPhone-Modell auf 80 Zeichen.';
  if (grade !== null && (!Number.isInteger(grade) || grade < 5 || grade > 13)) errors.grade = 'Bitte wähle eine Klasse zwischen 5 und 13 oder „Nicht angeben“.';
  if (availability !== null && !availabilityOptions.has(availability)) errors.availability = 'Bitte wähle eine der verfügbaren Optionen.';
  if (applicantKind !== 'self' && applicantKind !== 'guardian') errors.applicantKind = 'Bitte wähle, ob du selbst oder als Elternteil die Bewerbung schickst.';
  else if (age < 16 && applicantKind !== 'guardian') errors.applicantKind = 'Unter 16 muss ein Elternteil die Bewerbung mit seiner eigenen E-Mail-Adresse schicken.';
  if (values.consent !== true) errors.consent = 'Bitte bestätige die Verwendung deiner Angaben für diese Beta-Bewerbung.';

  return {
    errors,
    payload: {
      name, age, email, source, sourceDetail, motivation, device, grade,
      availability, applicantKind, consent: values.consent === true,
      privacyVersion: BETA_PRIVACY_VERSION, website,
    },
  };
}
