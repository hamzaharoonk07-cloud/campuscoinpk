import express from 'express';
import Budget from '../models/Budget.js';
import OverallBudget from '../models/OverallBudget.js';
import Category from '../models/Category.js';
import { protect, wrap } from '../middleware/auth.js';
import { budgetProgress, monthTotals, categoryBaseline } from '../services/analytics.js';
import { parseMonth, addMonths } from '../utils/dates.js';
import { round2 } from '../utils/money.js';

const router = express.Router();
router.use(protect);

/** Every budget for a month with live progress against it. */
router.get(
  '/',
  wrap(async (req, res) => {
    const month = parseMonth(req.query.month);
    const [budgets, totals, overallDoc] = await Promise.all([
      budgetProgress(Budget, req.user._id, month),
      monthTotals(req.user._id, month),
      OverallBudget.findOne({ user: req.user._id, month }),
    ]);

    const totalLimit = round2(budgets.reduce((acc, b) => acc + b.limitAmount, 0));
    const totalSpent = round2(budgets.reduce((acc, b) => acc + b.spent, 0));
    // Across every capped category, how much of it was cash - so the summary
    // row can say the same thing the dashboard and reports already do.
    const totalCash = round2(budgets.reduce((acc, b) => acc + b.cash, 0));
    const totalDigital = round2(budgets.reduce((acc, b) => acc + b.digital, 0));

    // The overall cap is measured against ALL expense this month, not just
    // what fell inside a capped category - that is the point of having it.
    const overallLimit = overallDoc ? round2(overallDoc.limitAmount) : null;
    const overall = overallLimit
      ? {
          limitAmount: overallLimit,
          spent: totals.expense,
          remaining: round2(overallLimit - totals.expense),
          pct: overallLimit > 0 ? Math.round((totals.expense / overallLimit) * 100) : 0,
          state: totals.expense >= overallLimit ? 'exceeded' : totals.expense >= overallLimit * 0.8 ? 'warning' : 'ok',
        }
      : null;

    res.json({
      budgets,
      overall,
      summary: {
        totalLimit,
        totalSpent,
        totalCash,
        totalDigital,
        totalRemaining: round2(totalLimit - totalSpent),
        pct: totalLimit ? Math.round((totalSpent / totalLimit) * 100) : 0,
        overCount: budgets.filter((b) => b.state === 'exceeded').length,
      },
    });
  })
);

/**
 * Suggested cap for each expense category that does not have one yet this
 * month, from what the student actually spent on it over recent months - so
 * "set a budget" starts from a real number, not a blank field, and the
 * "set several at once" form can pre-fill every row.
 */
router.get(
  '/suggestions',
  wrap(async (req, res) => {
    const month = parseMonth(req.query.month);
    const [existing, baseline, categories] = await Promise.all([
      Budget.find({ user: req.user._id, month }).distinct('category'),
      // Map keyed by categoryId -> { average, name, monthsSeen }.
      categoryBaseline(req.user._id, month, 3),
      // The student's own + default expense categories, for slot/icon.
      Category.find({ type: 'expense', $or: [{ owner: req.user._id }, { owner: null }] }, 'name slot icon'),
    ]);
    const have = new Set(existing.map(String));

    // Suggest a cap a little above the usual monthly spend (rounded up to a
    // tidy Rs 50) so it is a target to stay under, not the exact average they
    // will blow past on day one. Only categories with real history and no cap
    // yet this month.
    const suggestions = categories
      .filter((cat) => !have.has(String(cat._id)))
      .map((cat) => {
        const row = baseline.get(String(cat._id));
        const usual = row?.average || 0;
        return {
          categoryId: cat._id,
          name: cat.name,
          slot: cat.slot,
          icon: cat.icon,
          usual: round2(usual),
          suggested: usual > 0 ? Math.ceil((usual * 1.1) / 50) * 50 : 0,
        };
      })
      .filter((row) => row.suggested > 0)
      .sort((a, b) => b.suggested - a.suggested);

    res.json({ suggestions });
  })
);

/** Creates or updates the cap for one category in one month. */
router.put(
  '/',
  wrap(async (req, res) => {
    const { categoryId, month, limitAmount } = req.body;
    const when = parseMonth(month);
    const amount = Number(limitAmount);

    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ message: 'Enter a budget of zero or more' });
    }

    const category = await Category.findOne({
      _id: categoryId,
      type: 'expense',
      $or: [{ owner: req.user._id }, { owner: null }],
    });
    if (!category) return res.status(400).json({ message: 'Budgets can only be set on your expense categories' });

    const budget = await Budget.findOneAndUpdate(
      { user: req.user._id, category: category._id, month: when },
      // alertedAt resets so a raised budget can warn again at its new level.
      { $set: { limitAmount: amount, alertedAt: 0 }, $setOnInsert: { user: req.user._id, category: category._id, month: when } },
      { new: true, upsert: true }
    ).populate('category', 'name slot icon');

    res.json({ budget });
  })
);

/**
 * Sets several category caps in one request - the "set them all at once"
 * form. Each item is { categoryId, limitAmount }; a zero or blank amount
 * means "skip this one" rather than a zero cap, so a half-filled form only
 * saves the rows the student actually typed.
 */
router.put(
  '/bulk',
  wrap(async (req, res) => {
    const when = parseMonth(req.body.month);
    const items = Array.isArray(req.body.budgets) ? req.body.budgets : [];

    const valid = items
      .map((it) => ({ categoryId: String(it.categoryId || ''), amount: Number(it.limitAmount) }))
      .filter((it) => it.categoryId && Number.isFinite(it.amount) && it.amount > 0);

    if (!valid.length) return res.status(400).json({ message: 'Enter an amount for at least one category' });

    // Only the student's own or default expense categories may be capped.
    const allowed = await Category.find(
      { _id: { $in: valid.map((v) => v.categoryId) }, type: 'expense', $or: [{ owner: req.user._id }, { owner: null }] },
      '_id'
    );
    const allowedIds = new Set(allowed.map((c) => String(c._id)));
    const toWrite = valid.filter((v) => allowedIds.has(v.categoryId));
    if (!toWrite.length) return res.status(400).json({ message: 'Budgets can only be set on your expense categories' });

    await Budget.bulkWrite(
      toWrite.map((v) => ({
        updateOne: {
          filter: { user: req.user._id, category: v.categoryId, month: when },
          update: {
            $set: { limitAmount: v.amount, alertedAt: 0 },
            $setOnInsert: { user: req.user._id, category: v.categoryId, month: when },
          },
          upsert: true,
        },
      }))
    );

    res.json({ saved: toWrite.length });
  })
);

/** Sets (or clears, with a zero/blank amount) the one overall cap for the month. */
router.put(
  '/overall',
  wrap(async (req, res) => {
    const when = parseMonth(req.body.month);
    const amount = Number(req.body.limitAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      await OverallBudget.findOneAndDelete({ user: req.user._id, month: when });
      return res.json({ overall: null });
    }

    const doc = await OverallBudget.findOneAndUpdate(
      { user: req.user._id, month: when },
      { $set: { limitAmount: amount }, $setOnInsert: { user: req.user._id, month: when } },
      { new: true, upsert: true }
    );
    res.json({ overall: { limitAmount: round2(doc.limitAmount) } });
  })
);

router.delete(
  '/:id',
  wrap(async (req, res) => {
    const budget = await Budget.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!budget) return res.status(404).json({ message: 'That budget was not found' });
    res.json({ message: 'Budget removed' });
  })
);

/** Copies a month's caps forward, so a student sets them properly once. */
router.post(
  '/copy-forward',
  wrap(async (req, res) => {
    const from = parseMonth(req.body.from);
    const to = req.body.to ? parseMonth(req.body.to) : addMonths(from, 1);

    const source = await Budget.find({ user: req.user._id, month: from });
    if (!source.length) return res.status(400).json({ message: 'That month has no budgets to copy' });

    await Budget.bulkWrite(
      source.map((budget) => ({
        updateOne: {
          filter: { user: req.user._id, category: budget.category, month: to },
          update: {
            $set: { limitAmount: budget.limitAmount, alertedAt: 0 },
            $setOnInsert: { user: req.user._id, category: budget.category, month: to },
          },
          upsert: true,
        },
      }))
    );

    res.json({ copied: source.length });
  })
);

export default router;
