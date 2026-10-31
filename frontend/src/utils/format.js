// Display formatting used across the app. One place, so every page shows
// money and dates the same way.

const LOCALE = 'en-US';
const CURRENCY = 'USD';

const money = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY });
const moneyShort = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatMoney(value) {
  return money.format(Number(value) || 0);
}

/** Compact money for chart axes: $1.2K */
export function formatMoneyShort(value) {
  return moneyShort.format(Number(value) || 0);
}

/**
 * The API sends calendar dates (DateOnly) as "2026-09-01". Parsing that with
 * new Date() treats it as UTC midnight, which shows the previous day west of
 * Greenwich — so build a local date from the parts instead.
 */
export function parseDateOnly(value) {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(value) {
  const date = parseDateOnly(value);
  return date ? date.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

/** Billing month "2026-09-01" → "Sep 2026" */
export function formatMonth(value, style = 'short') {
  const date = parseDateOnly(value);
  return date ? date.toLocaleDateString(LOCALE, { month: style, year: 'numeric' }) : '—';
}

/** Timestamps (UTC, ending in Z) → local date and time */
export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(LOCALE, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** "3 hours ago", "2 days ago", falling back to a date after a week */
export function formatRelative(value) {
  if (!value) return '';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDateTime(value);
}

/** Today as yyyy-MM-dd in local time (for <input type="date">) */
export function todayIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Current month as yyyy-MM (for <input type="month">) */
export function currentMonthIso() {
  return todayIso().slice(0, 7);
}

export function fullName(person) {
  return person ? `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() : '';
}

export function initials(person) {
  return `${person?.firstName?.[0] ?? ''}${person?.lastName?.[0] ?? ''}`.toUpperCase();
}
