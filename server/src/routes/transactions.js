import express from 'express';
import Category from '../models/Category.js';
import Transaction, { PAYMENT_METHODS } from '../models/Transaction.js';
import { protect, wrap } from '../middleware/auth.js';
import { learn, suggestBatch } from '../services/categorizer.js';
import { parsePhrase } from '../services/phraseParser.js';
import { detectFlags, describeFlag } from '../services/anomaly.js';
import { checkBudgets, notifyAnomaly } from '../services/alerts.js';
import { parseTransactionCsv, toCsv } from '../services/csv.js';
import { nextOccurrence, parseMonth, startOfMonth, endOfMonth } from '../utils/dates.js';

import { cleanImage } from '../utils/images.js';

const router = express.Router();
router.use(protect);

const article = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

/** Confirms a category belongs to this student (or is a shared default). */
async function resolveCategory(user, categoryId) {
  return Category.findOne({ _id: categoryId, $or: [{ owner: user._id }, { owner: null }] });
}

/**
 * Filtered, paginated transaction list. Every filter the reports page offers -
 * month, date range, category, type, text - is handled here so the UI never has
 * to fetch a whole history and filter it in the browser.
 */
router.get(
  '/',
  wrap(async (req, res) => {
    const { month, from, to, category, type, q, flagged, recurring, method } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 25);

    const filter = { user: req.user._id };
    if (type) filter.type = type;
    if (category) filter.category = category;
    // How the money moved. Rows written before the field existed have no method and
    // count as cash everywhere else in the app, so "cash" has to include them or
    // they would drop out of it. "digital" is anything that is not cash.
    if (method === 'cash') filter.$or = [{ method: 'cash' }, { method: { $exists: false } }];
    else if (method === 'digital') filter.method = { $exists: true, $nin: ['cash'] };
    else if (PAYMENT_METHODS.includes(method)) filter.method = method;
    if (flagged === '1') filter.flags = { $ne: [] };
    // The rules behind repeating entries, for the dashboard's "coming up" list.
    if (recurring === '1') filter['recurring.enabled'] = true;
    if (q) filter.description = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    if (month) {
      const start = parseMonth(month);
      filter.date = { $gte: start, $lte: endOfMonth(start) };
    } else if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(`${String(to).slice(0, 10)}T23:59:59.999Z`);
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate('category', 'name slot icon type')
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Transaction.countDocuments(filter),
    ]);

    res.json({ transactions, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  })
);

/** The "recently viewed and recently edited" strip on the dashboard. */
router.get(
  '/recent',
  wrap(async (req, res) => {
    const [added, edited] = await Promise.all([
      Transaction.find({ user: req.user._id }).populate('category', 'name slot icon').sort({ createdAt: -1 }).limit(5),
      Transaction.find({ user: req.user._id, $expr: { $gt: ['$updatedAt', '$createdAt'] } })
        .populate('category', 'name slot icon')
        .sort({ updatedAt: -1 })
        .limit(5),
    ]);
    res.json({ added, edited });
  })
);

router.get(
  '/export',
  wrap(async (req, res) => {
    const filter = { user: req.user._id };
    if (req.query.month) {
      const start = parseMonth(req.query.month);
      filter.date = { $gte: start, $lte: endOfMonth(start) };
    }
    const transactions = await Transaction.find(filter).populate('category', 'name').sort({ date: 1 });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="campus-coin-${req.query.month || 'all'}.csv"`);
    res.send(toCsv(transactions));
  })
);

/**
 * Reads a single typed or spoken phrase - "chai with friends 150" - into a
 * draft transaction (amount, money in/out, description, suggested category)
 * without saving anything. The student confirms, then the normal POST writes it.
 */
router.post(
  '/parse',
  wrap(async (req, res) => {
    const phrase = String(req.body.phrase || '').trim();
    if (!phrase) return res.status(400).json({ message: 'Type or say what you spent on' });
    const draft = await parsePhrase({ userId: req.user._id, phrase });
    if (draft.amount === null) {
      return res.status(422).json({ message: "I couldn't find an amount - try \"chai 150\"", draft });
    }
    res.json({ draft });
  })
);

const ALLOWED_SOURCES = new Set(['manual', 'phrase', 'sms']);

router.post(
  '/',
  wrap(async (req, res) => {
    const { categoryId, type, amount, description, note, date, recurring, aiSuggestedCategory, receipt, method, methodLabel, source } = req.body;

    const category = await resolveCategory(req.user, categoryId);
    if (!category) return res.status(400).json({ message: 'Choose a category from your list' });
    if (category.type !== type) {
      return res.status(400).json({ message: `${category.name} is ${article(category.type)} ${category.type} category, not ${type}` });
    }

    const when = date ? new Date(date) : new Date();
    if (Number.isNaN(when.getTime())) return res.status(400).json({ message: 'That date is not valid' });

    const transaction = new Transaction({
      user: req.user._id,
      category: category._id,
      type,
      amount: Number(amount),
      description: description || '',
      note: note || '',
      date: when,
      // An unknown value would fail schema validation with a raw Mongoose
      // message, so it falls back to cash rather than rejecting the save.
      method: PAYMENT_METHODS.includes(method) ? method : 'cash',
      // Kept only for 'other'; a name on a known method would never be shown.
      methodLabel: method === 'other' ? String(methodLabel || '').slice(0, 40) : '',
      aiSuggestedCategory: aiSuggestedCategory || null,
      // Recorded so the AI page can report how often its guesses were kept.
      aiAccepted: aiSuggestedCategory ? String(aiSuggestedCategory) === String(category._id) : null,
      source: ALLOWED_SOURCES.has(source) ? source : 'manual',
    });

    if (receipt) {
      transaction.receipt = cleanImage(receipt, { maxKb: 450, label: 'Receipt photo' });
      transaction.hasReceipt = true;
    }

    if (recurring?.enabled) {
      transaction.recurring = {
        enabled: true,
        frequency: recurring.frequency || 'monthly',
        nextRun: nextOccurrence(when, recurring.frequency || 'monthly'),
        endsOn: recurring.endsOn ? new Date(recurring.endsOn) : undefined,
      };
    }

    // Unusual-amount and duplicate checks run before the row is saved so the
    // student gets the warning in the same response that confirms the save.
    transaction.flags = await detectFlags(transaction);
    await transaction.save();

    // Teach the assistant what this description means to this student.
    await learn({ userId: req.user._id, description, categoryId: category._id });

    const [alerts] = await Promise.all([
      checkBudgets(req.user, when),
      notifyAnomaly(req.user, transaction, transaction.flags, describeFlag),
    ]);

    await transaction.populate('category', 'name slot icon type');
    // The image was just sent by the client; there is no need to send it back.
    const saved = transaction.toObject();
    delete saved.receipt;
    res.status(201).json({
      transaction: saved,
      alerts,
      warnings: transaction.flags.map((flag) => describeFlag(flag, transaction)).filter(Boolean),
    });
  })
);

router.patch(
  '/:id',
  wrap(async (req, res) => {
    const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
    if (!transaction) return res.status(404).json({ message: 'That transaction was not found' });

    if (req.body.categoryId) {
      const category = await resolveCategory(req.user, req.body.categoryId);
      if (!category) return res.status(400).json({ message: 'Choose a category from your list' });
      // Re-filing a transaction is a correction - it teaches the assistant too.
      await learn({
        userId: req.user._id,
        description: req.body.description ?? transaction.description,
        categoryId: category._id,
      });
      transaction.category = category._id;
      transaction.type = category.type;
    }

    for (const field of ['amount', 'description', 'note']) {
      if (req.body[field] !== undefined) transaction[field] = req.body[field];
    }
    if (PAYMENT_METHODS.includes(req.body.method)) transaction.method = req.body.method;
    if (req.body.methodLabel !== undefined || req.body.method) {
      transaction.methodLabel =
        transaction.method === 'other' ? String(req.body.methodLabel || transaction.methodLabel || '').slice(0, 40) : '';
    }
    if (req.body.date) transaction.date = new Date(req.body.date);
    if (req.body.receipt !== undefined) {
      transaction.receipt = cleanImage(req.body.receipt, { maxKb: 450, label: 'Receipt photo' });
      transaction.hasReceipt = Boolean(transaction.receipt);
    }

    if (req.body.recurring) {
      transaction.recurring = {
        enabled: Boolean(req.body.recurring.enabled),
        frequency: req.body.recurring.frequency || transaction.recurring.frequency || 'monthly',
        nextRun: req.body.recurring.enabled
          ? transaction.recurring.nextRun || nextOccurrence(transaction.date, req.body.recurring.frequency || 'monthly')
          : undefined,
        endsOn: req.body.recurring.endsOn ? new Date(req.body.recurring.endsOn) : undefined,
      };
    }

    transaction.flags = await detectFlags(transaction);
    await transaction.save();
    await checkBudgets(req.user, transaction.date);

    await transaction.populate('category', 'name slot icon type');
    res.json({ transaction });
  })
);

/** The receipt photo for one transaction, fetched only when it is opened. */
router.get(
  '/:id/receipt',
  wrap(async (req, res) => {
    const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user._id }).select('+receipt hasReceipt');
    if (!transaction) return res.status(404).json({ message: 'That transaction was not found' });
    if (!transaction.hasReceipt) return res.status(404).json({ message: 'No receipt is attached to this transaction' });
    res.json({ receipt: transaction.receipt });
  })
);

router.delete(
  '/:id',
  wrap(async (req, res) => {
    const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
    if (!transaction) return res.status(404).json({ message: 'That transaction was not found' });

    // Deleting the rule also removes the copies it generated, so a cancelled
    // subscription does not leave phantom charges in next month's report.
    const removedChildren = transaction.recurring?.enabled
      ? (await Transaction.deleteMany({ recurringParent: transaction._id, user: req.user._id })).deletedCount
      : 0;

    await transaction.deleteOne();
    await checkBudgets(req.user, transaction.date);

    res.json({
      message: removedChildren
        ? `Deleted, along with ${removedChildren} entr${removedChildren === 1 ? 'y' : 'ies'} it had generated`
        : 'Transaction deleted',
    });
  })
);

/**
 * Step one of a CSV import: parse the file, propose a category for every row and
 * hand it all back for review. Nothing is written until the student confirms.
 */
router.post(
  '/import/preview',
  wrap(async (req, res) => {
    const { rows, errors } = parseTransactionCsv(req.body.csv);
    if (!rows.length) return res.json({ rows: [], errors, matched: 0 });

    // Match the CSV's own category column to a real category first.
    const categories = await Category.find({ archived: false, $or: [{ owner: req.user._id }, { owner: null }] });
    const byName = new Map(categories.map((c) => [`${c.type}:${c.name.toLowerCase()}`, c]));

    const withNames = rows.map((row) => {
      const exact = byName.get(`${row.type}:${String(row.categoryName || '').toLowerCase()}`);
      return { ...row, matchedCategory: exact?._id || null, matchedCategoryName: exact?.name || null };
    });

    // Rows the file did not name a known category for fall to the assistant.
    const needsHelp = withNames.filter((row) => !row.matchedCategory);
    const suggested = await suggestBatch({ userId: req.user._id, rows: needsHelp });
    const suggestions = new Map(suggested.map((row) => [row.row, row]));

    const merged = withNames.map((row) => {
      if (row.matchedCategory) return { ...row, categoryId: row.matchedCategory, confidence: 1, via: 'file' };
      const hint = suggestions.get(row.row);
      return {
        ...row,
        categoryId: hint?.suggestedCategory || null,
        matchedCategoryName: hint?.suggestedCategoryName || null,
        confidence: hint?.confidence || 0,
        via: hint?.suggestedCategory ? 'assistant' : 'none',
      };
    });

    res.json({ rows: merged, errors, matched: merged.filter((r) => r.categoryId).length });
  })
);

/** Step two: write the rows the student approved. */
router.post(
  '/import/commit',
  wrap(async (req, res) => {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ message: 'There is nothing to import' });

    const categories = await Category.find({ archived: false, $or: [{ owner: req.user._id }, { owner: null }] });
    const allowed = new Set(categories.map((c) => String(c._id)));

    const docs = [];
    const skipped = [];

    for (const row of rows) {
      if (!row.categoryId || !allowed.has(String(row.categoryId))) {
        skipped.push({ row: row.row, reason: 'no category was chosen' });
        continue;
      }
      const when = new Date(row.date);
      if (Number.isNaN(when.getTime()) || !(Number(row.amount) > 0)) {
        skipped.push({ row: row.row, reason: 'the date or amount was not usable' });
        continue;
      }
      docs.push({
        user: req.user._id,
        category: row.categoryId,
        type: row.type,
        amount: Number(row.amount),
        description: row.description || '',
        date: when,
        month: startOfMonth(when),
        method: PAYMENT_METHODS.includes(row.method) ? row.method : 'cash',
        source: 'csv',
      });
    }

    const created = docs.length ? await Transaction.insertMany(docs) : [];

    // An import is a large batch of real decisions - the assistant learns from it.
    for (const doc of docs) {
      await learn({ userId: req.user._id, description: doc.description, categoryId: doc.category });
    }
    await checkBudgets(req.user, new Date());

    res.status(201).json({ imported: created.length, skipped });
  })
);

export default router;
