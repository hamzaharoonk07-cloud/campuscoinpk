import { suggestCategory } from './categorizer.js';

// ---------------------------------------------------------------------------
// One-phrase entry parser  ("Say it. Saved. Done.")
//
// Turns a single line a student types or speaks - "chai with friends 150",
// "rickshaw do sau", "ammi ne 2 hazaar diye" - into a draft transaction:
// an amount, whether it is money in or out, a clean description, and (through
// the existing categoriser) a suggested category.
//
// It is written to be explainable rather than clever: every number form and
// income cue below is one a Pakistani student actually uses, and the parser
// never calls out to an API. Nothing is saved here - the draft goes back to
// the student to confirm, and the normal save path does the writing.
// ---------------------------------------------------------------------------

// Roman Urdu / English words that mean money came IN. Everything else is an
// expense, because that is what students log ninety-nine times in a hundred.
const INCOME_CUES = [
  'allowance', 'salary', 'stipend', 'scholarship', 'wazifa', 'wazeefa',
  'refund', 'cashback', 'bonus', 'received', 'recieved', 'earned',
  'mila', 'mili', 'milay', 'mili', 'milgaye', 'gaye', // "mil gaye / paise mile"
  'aya', 'aaya', 'ayi', 'aayi', 'aye', 'bheja', 'bheje', 'diye', 'diya', 'di',
  'kamaya', 'kamaye', 'kamai', 'wapas', 'wapis', 'jeeb', 'kharcha', 'pocket',
  'tuition', 'freelance', 'fiverr', 'upwork',
];

// Roman Urdu number words, used only when the phrase has no digits at all.
// Small whole numbers plus the two multipliers students say out loud.
const URDU_UNITS = {
  ek: 1, aik: 1, do: 2, teen: 3, tin: 3, char: 4, chaar: 4, panch: 5, paanch: 5,
  che: 6, chay: 6, cheh: 6, saat: 7, sat: 7, aath: 8, ath: 8, nau: 9, no: 9,
  das: 10, dus: 10, bees: 20, pachas: 50, pachaas: 50,
};
const URDU_SCALES = { sau: 100, so: 100, sao: 100, hazaar: 1000, hazar: 1000, hzr: 1000, lakh: 100000, lac: 100000, lakhs: 100000 };

// Currency words to drop from the description once the amount is read.
const CURRENCY_WORDS = new Set(['rs', 'rs.', 'rps', 'pkr', 'rupees', 'rupee', 'rupay', 'rupaye', 'rupaya', '₨']);

/**
 * Finds the amount in a phrase and returns the text with it removed.
 * Handles: "150", "150.50", "2k", "1.5k", "2 hazaar", "3 lakh", "rs 150",
 * "₨1200", and - when no digits appear - "do sau", "paanch hazaar".
 * Returns { amount, rest } where amount is null if nothing numeric was found.
 */
export function extractAmount(input) {
  let text = ` ${String(input || '').toLowerCase()} `;

  // 1. A number written in digits, optionally with a k / hazaar / lakh scale.
  //    The scale word (if any) is consumed with the number so it never leaks
  //    into the description.
  const digit = text.match(/(\d+(?:[.,]\d+)?)\s*(k|hazaar|hazar|lakh|lac|crore)?\b/);
  if (digit) {
    let value = parseFloat(digit[1].replace(',', '.'));
    const scale = digit[2];
    if (scale === 'k') value *= 1000;
    else if (scale === 'hazaar' || scale === 'hazar') value *= 1000;
    else if (scale === 'lakh' || scale === 'lac') value *= 100000;
    else if (scale === 'crore') value *= 10000000;
    const rest = text.replace(digit[0], ' ');
    return { amount: Math.round(value * 100) / 100, rest: cleanWords(rest) };
  }

  // 2. No digits: try spelled-out Roman Urdu numbers like "do sau" (200) or
  //    "paanch hazaar" (5000). Only a unit optionally followed by a scale -
  //    enough for the amounts said aloud, without pretending to parse prose.
  const words = text.trim().split(/\s+/);
  for (let i = 0; i < words.length; i += 1) {
    const unit = URDU_UNITS[words[i]];
    if (unit === undefined) continue;
    const scaleWord = words[i + 1];
    const scale = URDU_SCALES[scaleWord];
    if (scale) {
      const consumed = new Set([i, i + 1]);
      return { amount: unit * scale, rest: cleanWords(words.filter((_, idx) => !consumed.has(idx)).join(' ')) };
    }
    // A bare "sau"/"hazaar" on its own means one of them ("sau rupay").
  }
  for (let i = 0; i < words.length; i += 1) {
    const scale = URDU_SCALES[words[i]];
    if (scale) {
      return { amount: scale, rest: cleanWords(words.filter((_, idx) => idx !== i).join(' ')) };
    }
  }

  return { amount: null, rest: cleanWords(text) };
}

/** Drops currency words and tidies whitespace left behind by the amount. */
function cleanWords(text) {
  return String(text)
    .split(/\s+/)
    .filter((word) => word && !CURRENCY_WORDS.has(word))
    .join(' ')
    .trim();
}

/** Decides money in vs out from the words used. Expense unless a cue says otherwise. */
export function detectType(phrase) {
  const words = new Set(String(phrase || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/));
  return INCOME_CUES.some((cue) => words.has(cue)) ? 'income' : 'expense';
}

/**
 * Parses a phrase into a draft transaction and asks the categoriser for a
 * category. Returns { amount, type, description, category, confidence,
 * alternatives } - or { amount: null } when no amount could be found, so the
 * caller can ask the student to include one.
 */
export async function parsePhrase({ userId, phrase }) {
  const raw = String(phrase || '').trim();
  const type = detectType(raw);
  const { amount, rest } = extractAmount(raw);

  // The description is what is left once the amount and currency are removed;
  // if that leaves nothing (the student typed only a number) fall back to the
  // whole phrase so the row still reads sensibly.
  const description = rest || raw.replace(/[\d.,]/g, '').trim();

  if (amount === null || !(amount > 0)) {
    return { amount: null, type, description };
  }

  const suggestion = description
    ? await suggestCategory({ userId, description, type })
    : null;

  return {
    amount,
    type,
    description,
    category: suggestion?.category
      ? { _id: suggestion.category._id, name: suggestion.category.name, slot: suggestion.category.slot, icon: suggestion.category.icon }
      : null,
    confidence: suggestion?.confidence ?? 0,
    reason: suggestion?.reason || '',
    alternatives: suggestion?.alternatives || [],
  };
}
