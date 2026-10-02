import { suggestCategory } from './categorizer.js';

// ---------------------------------------------------------------------------
// Bank / wallet SMS parser
//
// Pakistani banks and wallets text an alert on every card swipe, transfer and
// deposit. A student pastes that SMS (or shares it to Campus Coin) and this
// reads out the amount, whether money went out or came in, the merchant or
// person, and which wallet it moved through - then asks the categoriser for a
// category from the merchant name.
//
// It is pattern-matching on the wording these messages actually use, not a
// bank integration: nothing connects to an account, and the student still
// confirms before anything is saved. New wording simply falls through to a
// sensible default (expense, no merchant) rather than failing.
// ---------------------------------------------------------------------------

// Words that place a transaction as money OUT or money IN. Checked in order,
// out before in, because "paid" and "sent" are the common student cases.
const DEBIT_CUES = ['debited', 'debit', 'spent', 'withdrawn', 'withdrawal', 'paid', 'payment of', 'sent', 'purchase', 'transferred', 'deducted', 'charged'];
const CREDIT_CUES = ['credited', 'credit', 'received', 'deposited', 'deposit', 'added', 'refund', 'refunded', 'cashback', 'salary'];

// The wallet / bank an SMS came from, mapped to the payment methods the app
// already knows (models/Transaction.js). Order matters: the first name found
// in the message wins, so specific wallets are listed before plain "bank".
const METHOD_HINTS = [
  [/jazz\s?cash|jazzcash/i, 'jazzcash'],
  [/easy\s?paisa|easypaisa/i, 'easypaisa'],
  [/sada\s?pay|sadapay/i, 'sadapay'],
  [/naya\s?pay|nayapay/i, 'nayapay'],
  [/\bhbl\b|habib bank/i, 'bank'],
  [/\bubl\b|united bank/i, 'bank'],
  [/\bmcb\b/i, 'bank'],
  [/meezan/i, 'bank'],
  [/allied|\babl\b/i, 'bank'],
  [/bank\s?alfalah|alfalah/i, 'bank'],
  [/standard chartered|\bscb\b/i, 'bank'],
  [/faysal/i, 'bank'],
  [/\bnbp\b|national bank/i, 'bank'],
  [/\bbank\b|\ba\/c\b|account|debit card|credit card|atm/i, 'bank'],
];

/** The amount in an SMS: "Rs 1,500.00", "PKR 850", "Rs.1200", "1,200/-". */
export function extractSmsAmount(text) {
  const money = String(text || '')
    // Prefer a figure that sits next to a currency marker, so a date or a
    // reference number never gets read as the amount.
    .match(/(?:rs\.?|pkr|₨|inr)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:\/-|rupees|rs\b)/i);
  if (!money) return null;
  const digits = (money[1] || money[2] || '').replace(/,/g, '');
  const value = parseFloat(digits);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

/** Money out unless a credit word appears without a debit word. Expense by default. */
export function detectSmsType(text) {
  const lower = String(text || '').toLowerCase();
  const isDebit = DEBIT_CUES.some((cue) => lower.includes(cue));
  const isCredit = CREDIT_CUES.some((cue) => lower.includes(cue));
  if (isCredit && !isDebit) return 'income';
  return 'expense';
}

/** The wallet the SMS came through, or cash as a last resort. */
export function detectMethod(text) {
  for (const [pattern, method] of METHOD_HINTS) {
    if (pattern.test(text)) return method;
  }
  return 'cash';
}

// Words that end the merchant name: the clause that follows it in an alert
// (a date, a reference, a balance, "was successful", "via JazzCash"...).
const MERCHANT_STOP = new Set([
  'on', 'dated', 'ref', 'reference', 'trx', 'txn', 'via', 'through', 'your', 'was',
  'is', 'successful', 'available', 'avbl', 'bal', 'balance', 'account', 'a/c',
  'new', 'card', 'and', 'with', 'of', 'to', 'at', 'from', 'do', 'not', 'share',
]);

/**
 * Pulls the merchant or person out of the message: the run of name words after
 * "at"/"to" (a card swipe or transfer out) or "from"/"by" (money in). Stops at
 * the clause that follows - a date, a reference, "via ...", "was successful" -
 * so a trailing balance or timestamp is never read as part of the name.
 */
export function extractMerchant(text, type) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  const preps = type === 'income' ? ['from', 'by'] : ['at', 'to'];
  for (const prep of preps) {
    const match = clean.match(new RegExp(`\\b${prep}\\s+(.+)`, 'i'));
    if (!match) continue;
    const name = [];
    for (const word of match[1].split(' ')) {
      const bare = word.replace(/[^A-Za-z0-9&'.-]/g, '');
      if (!bare) break;
      if (MERCHANT_STOP.has(bare.toLowerCase())) break;
      // A number that starts a new word (a date or amount) ends the name, but a
      // digit inside a name already begun (e.g. "7-Eleven") is kept.
      if (/^\d/.test(bare) && name.length) break;
      name.push(bare);
      if (name.length >= 4) break;
    }
    const result = name.join(' ').replace(/[.,]+$/, '').trim();
    if (result && !/^\d+$/.test(result)) return result;
  }
  return '';
}

/**
 * Parses a pasted SMS into a draft transaction and asks the categoriser for a
 * category from the merchant. Returns { amount: null } when no amount is found,
 * so the caller can tell the student the paste was not a usable alert.
 */
export async function parseSms({ userId, text }) {
  const raw = String(text || '').trim();
  const amount = extractSmsAmount(raw);
  const type = detectSmsType(raw);
  const method = detectMethod(raw);
  const merchant = extractMerchant(raw, type);

  if (amount === null) {
    return { amount: null, type, method, description: merchant };
  }

  const suggestion = merchant ? await suggestCategory({ userId, description: merchant, type }) : null;

  return {
    amount,
    type,
    method,
    description: merchant,
    category: suggestion?.category
      ? { _id: suggestion.category._id, name: suggestion.category.name, slot: suggestion.category.slot, icon: suggestion.category.icon }
      : null,
    confidence: suggestion?.confidence ?? 0,
    alternatives: suggestion?.alternatives || [],
  };
}
