export const CURRENCY_SYMBOLS = {
  PKR: 'Rs', USD: '$', EUR: '€', GBP: '£', INR: '₹', AED: 'AED',
  SAR: 'SAR', QAR: 'QAR', KWD: 'KD', BHD: 'BD', OMR: 'OMR', JOD: 'JD',
  JPY: '¥', CNY: '¥', HKD: 'HK$', SGD: 'S$', KRW: '₩', MYR: 'RM', THB: '฿',
  IDR: 'Rp', PHP: '₱', VND: '₫', BDT: '৳', LKR: 'Rs', NPR: 'Rs', AFN: '؋',
  AUD: 'A$', CAD: 'C$', NZD: 'NZ$', CHF: 'CHF', SEK: 'kr', NOK: 'kr', DKK: 'kr',
  PLN: 'zł', CZK: 'Kč', HUF: 'Ft', RON: 'lei', TRY: '₺', RUB: '₽', UAH: '₴',
  ZAR: 'R', NGN: '₦', KES: 'KSh', GHS: '₵', EGP: 'E£', MAD: 'MAD', TZS: 'TSh',
  UGX: 'USh', BRL: 'R$', MXN: 'MX$', ARS: 'AR$', CLP: 'CLP', COP: 'COP',
};

/**
 * Money, the way it is read rather than stored. Whole units by default - a
 * student thinks in rupees, not paisa - with the decimals available where the
 * exact figure matters.
 */
export function money(amount, currency = 'PKR', { decimals = false, sign = false } = {}) {
  const value = Number(amount) || 0;
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const body = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });
  const prefix = value < 0 ? '−' : sign && value > 0 ? '+' : '';
  return `${prefix}${symbol}${symbol.length > 1 ? ' ' : ''}${body}`;
}

/** Compact form for chart axes, where space is short: 12.4k rather than 12,400. */
export function compactMoney(amount, currency = 'PKR') {
  const value = Math.abs(Number(amount) || 0);
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  if (value >= 1000000) return `${symbol}${(value / 1000000).toFixed(1)}m`;
  if (value >= 1000) return `${symbol}${Math.round(value / 1000)}k`;
  return `${symbol}${Math.round(value)}`;
}

/** Category colour comes from a palette slot, so it is correct in both themes. */
export const slotColor = (slot) => `var(--cat-${Math.min(7, Math.max(1, Number(slot) || 7))})`;

export const monthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export function monthLabel(key) {
  const [year, month] = String(key).split('-').map(Number);
  if (!year || !month) return key;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function shiftMonth(key, by) {
  const [year, month] = String(key).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + by, 1));
  return monthKey(new Date(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export const formatDate = (value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(value).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });

/** "Today", "Yesterday", then the date - how people actually refer to recent days. */
export function dayHeading(value) {
  const date = new Date(value);
  const today = new Date();
  const diff = Math.round((today.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return formatDate(value, { weekday: 'short', day: 'numeric', month: 'short' });
}

export const todayInput = () => new Date().toISOString().slice(0, 10);
