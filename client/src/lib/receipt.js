// Reading a receipt photo.
//
// Two steps, kept apart so each can be explained and tested on its own:
//   1. readText  - optical character recognition (OCR) with Tesseract, which
//      runs entirely in the browser. No API key and nothing leaves the device.
//   2. parseReceipt - plain rules that find the total, the shop and the date in
//      the text. They are deliberately cautious: anything they are unsure of is
//      left blank for the student to fill in, never guessed.

/** Runs OCR on an image. onProgress receives 0..1 while it works. */
export async function readText(image, onProgress = () => {}) {
  // Loaded only when a receipt is actually scanned, so the rest of the app
  // does not pay for it.
  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress(m.progress);
    },
  });
  try {
    // A receipt is one uniform block of lines, so SINGLE_BLOCK segments it far
    // better than the default auto mode (which hunts for columns and tables
    // that are not there), and keeping interword spaces preserves the gap
    // between a label and its amount on the same line.
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1',
    });
    const { data } = await worker.recognize(image);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

// A money amount as printed on a receipt: 1,250 / 1250.00 / 650 / Rs.650.
const AMOUNT = /(?:rs\.?|pkr|\$|£|€|₹)?\s*(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi;
// Lines that name the amount actually paid, strongest first.
const TOTAL_WORDS = [/grand\s*total/i, /net\s*(total|amount|payable)/i, /amount\s*(due|payable|paid)/i, /\btotal\b/i, /\bpayable\b/i, /\bbalance\b/i];
// Lines that mention money but are not the total.
const NOT_TOTAL = /sub\s*-?\s*total|tax|gst|vat|discount|change|cash\s*tendered|tendered|service\s*charge|tip/i;

const numbersIn = (line) =>
  [...line.matchAll(AMOUNT)]
    .map((m) => Number(m[1].replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 10000000);

/** Finds the amount paid. Returns null when nothing is convincing. */
function findTotal(lines) {
  for (const word of TOTAL_WORDS) {
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i];
      if (!word.test(line) || NOT_TOTAL.test(line)) continue;
      // The figure is usually on the same line, sometimes on one of the next
      // couple (OCR often breaks "TOTAL" and its amount onto separate lines).
      const here = numbersIn(line.replace(word, ''));
      if (here.length) return Math.max(...here);
      for (let j = i + 1; j <= i + 2 && j < lines.length; j += 1) {
        if (NOT_TOTAL.test(lines[j])) continue;
        const near = numbersIn(lines[j]);
        if (near.length) return Math.max(...near);
      }
    }
  }
  // No labelled total: the largest amount with a decimal point or a currency
  // sign is the best remaining guess - item prices are smaller than the total.
  const priced = lines
    .filter((line) => !NOT_TOTAL.test(line))
    .flatMap((line) => [...line.matchAll(AMOUNT)].filter((m) => /[.,]\d{2}\b|rs|pkr/i.test(m[0])))
    .map((m) => Number(m[1].replace(/,/g, '')));
  return priced.length ? Math.max(...priced) : null;
}

/** The shop is normally the first line made mostly of letters. */
function findMerchant(lines) {
  const candidate = lines.slice(0, 6).find((line) => {
    const letters = (line.match(/[a-z]/gi) || []).length;
    return letters >= 3 && letters / line.replace(/\s/g, '').length > 0.6 && !/receipt|invoice|tax|welcome|thank/i.test(line);
  });
  if (!candidate) return '';
  const clean = candidate.replace(/[^a-z0-9&'.\- ]/gi, ' ').replace(/\s+/g, ' ').trim();
  // Title case, because OCR of shop signage is often all capitals.
  return clean.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).slice(0, 60);
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Finds a date, returned as YYYY-MM-DD, or '' when there is none. */
function findDate(text) {
  const iso = (y, m, d) => {
    const year = y < 100 ? 2000 + y : y;
    const date = new Date(Date.UTC(year, m - 1, d));
    if (date.getUTCMonth() !== m - 1 || date > new Date() || year < 2000) return '';
    return date.toISOString().slice(0, 10);
  };
  let m = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(text);
  if (m) return iso(+m[1], +m[2], +m[3]);
  // Day first, as receipts in Pakistan and the UK print it.
  m = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/.exec(text);
  if (m) return iso(+m[3], +m[2], +m[1]);
  m = /\b(\d{1,2})[\s-]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,-]*(\d{2,4})\b/i.exec(text);
  if (m) return iso(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
  return '';
}

/** Turns OCR text into { amount, merchant, date }; any of them may be empty. */
export function parseReceipt(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const amount = findTotal(lines);
  return {
    amount: amount ? Math.round(amount * 100) / 100 : null,
    merchant: findMerchant(lines),
    date: findDate(text),
  };
}
