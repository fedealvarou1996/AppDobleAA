export const PLAYER_CATEGORIES = [
  'Primera',
  'Sub 23',
  'Sub 20',
  'Sub 18',
  'Sub 16',
  'Sub 14',
  'Master',
];

export function normalizeText(value) {
  return (value || '').trim();
}

export function isValidEmail(email) {
  const normalizedEmail = normalizeText(email);

  if (!normalizedEmail) return true;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
}

export function isFutureDate(dateValue) {
  if (!dateValue) return false;

  const inputDate = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(inputDate.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return inputDate > today;
}

export function isValidUuid(value) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) return true;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    normalizedValue
  );
}
