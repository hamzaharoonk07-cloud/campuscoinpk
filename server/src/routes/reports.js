import express from 'express';
import Budget from '../models/Budget.js';
import Transaction from '../models/Transaction.js';
import Announcement from '../models/Announcement.js';
import Insight from '../models/Insight.js';
import { protect, wrap } from '../middleware/auth.js';
import {
  byCategory,
  byMethod,
  moneyFlow,
  budgetProgress,
  dailySeries,
  monthTotals,
  noSpendStreak,
  trend,
  weeklySeries,
} from '../services/analytics.js';
import { forecastNextMonth } from '../services/forecast.js';
import { listTips, refreshTips } from '../services/tips.js';
import { runRecurring } from '../services/recurring.js';
import { parseMonth, monthKey } from '../utils/dates.js';
import { round2 } from '../utils/money.js';

const router = express.Router();
router.use(protect);

/**
 * Everything the dashboard needs, in one request. Fetching it as a single call
 * keeps the first paint fast and means the numbers on the page are all from the
 * same instant.
 */
router.get(
  '/dashboard',
  wrap(async (req, res) => {
    const month = parseMonth(req.query.month);

    // Due recurring entries are written before the totals are read, so the
    // dashboard never shows a month that is missing this month's allowance.
    await runRecurring(req.user._id);

    const [totals, spending, incomeSources, budgets, sixMonths, tips, announcements, insight, recent, methods, flow, methodsIn, streak] = await Promise.all([
      monthTotals(req.user._id, month),
      byCategory(req.user._id, month, 'expense'),
      // Where the money came from, for the dashboard's monthly rhythm card.
      byCategory(req.user._id, month, 'income'),
      budgetProgress(Budget, req.user._id, month),
      trend(req.user._id, month, 6),
      listTips(req.user._id),
      Announcement.find({ kind: 'announcement', active: true }).sort({ createdAt: -1 }).limit(3),
      Insight.findOne({ user: req.user._id, month: parseMonth(req.query.month) }),
      // Sorted by when the money moved, not when the row was written - with
      // imported or seeded data those two orders are completely different.
      Transaction.find({ user: req.user._id })
        .populate('category', 'name slot icon')
        .sort({ date: -1, createdAt: -1 })
        .limit(6),
      // Cash against the wallets, for the dashboard's "money and cash" card.
      byMethod(req.user._id, month, 'expense'),
      moneyFlow(req.user._id, month),
      // Where money came in, by account, so the card can open into it when the
      // student has been paid into more than one.
      byMethod(req.user._id, month, 'income'),
      // No-spend streak: deliberately not scoped to the selected month - a
      // streak spanning a month boundary should not reset just because the
      // student is looking at last month's report.
      noSpendStreak(req.user._id),
    ]);

    res.json({
      month: monthKey(month),
      totals,
      topCategory: spending[0] || null,
      spending: spending.slice(0, 6),
      income: incomeSources.slice(0, 6),
      budgets: budgets.slice(0, 4),
      trend: sixMonths,
      tips: tips.slice(0, 3),
      announcements,
      insight,
      recent,
      methods,
      flow,
      methodsIn,
      streak,
      goal: {
        target: req.user.savingsGoal || 0,
        kept: totals.balance,
        pct: req.user.savingsGoal ? Math.min(100, Math.round((totals.balance / req.user.savingsGoal) * 100)) : null,
      },
    });
  })
);

/**
 * The calendar: every day of the month with what came in, what went out and
 * the transactions themselves, so a day can be opened without another request.
 * Recurring entries still to come this month are included as "upcoming".
 */
router.get(
  '/calendar',
  wrap(async (req, res) => {
    const month = parseMonth(req.query.month);
    const next = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
    const [rows, repeating] = await Promise.all([
      Transaction.find({ user: req.user._id, date: { $gte: month, $lt: next } })
        .populate('category', 'name icon slot')
        .sort({ date: 1, createdAt: 1 })
        .lean(),
      Transaction.find({ user: req.user._id, 'recurring.nextRun': { $gte: new Date(), $lt: next } })
        .populate('category', 'name icon slot')
        .lean(),
    ]);

    const days = {};
    const dayOf = (d) => new Date(d).toISOString().slice(0, 10);
    // cash / digital is carried per day as well as per transaction, so the grid
    // can show the split without walking each day's rows.
    // cash/digital are the spending split; inCash/inDigital are the same split for
    // money coming in, so the calendar can say how an allowance arrived as well as
    // how the money left.
    const bucket = (key) => (days[key] ||= { date: key, income: 0, expense: 0, cash: 0, digital: 0, inCash: 0, inDigital: 0, transactions: [], upcoming: [] });
    for (const t of rows) {
      const day = bucket(dayOf(t.date));
      day[t.type === 'income' ? 'income' : 'expense'] += t.amount;
      const isCash = (t.method || 'cash') === 'cash';
      if (t.type === 'expense') day[isCash ? 'cash' : 'digital'] += t.amount;
      else day[isCash ? 'inCash' : 'inDigital'] += t.amount;
      day.transactions.push({
        _id: t._id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        category: t.category,
        method: t.method || 'cash',
        methodLabel: t.methodLabel || '',
        flags: t.flags,
      });
    }
    for (const t of repeating) {
      bucket(dayOf(t.recurring.nextRun)).upcoming.push({
        _id: t._id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        category: t.category,
        frequency: t.recurring.frequency,
      });
    }
    for (const day of Object.values(days)) {
      day.income = round2(day.income);
      day.expense = round2(day.expense);
      day.cash = round2(day.cash);
      day.digital = round2(day.digital);
      day.inCash = round2(day.inCash);
      day.inDigital = round2(day.inDigital);
    }

    const totals = Object.values(days).reduce(
      (acc, d) => ({
        income: acc.income + d.income,
        expense: acc.expense + d.expense,
        cash: acc.cash + d.cash,
        digital: acc.digital + d.digital,
        inCash: acc.inCash + d.inCash,
        inDigital: acc.inDigital + d.inDigital,
      }),
      { income: 0, expense: 0, cash: 0, digital: 0, inCash: 0, inDigital: 0 }
    );
    res.json({
      month: monthKey(month),
      days,
      totals: {
        income: round2(totals.income),
        expense: round2(totals.expense),
        cash: round2(totals.cash),
        digital: round2(totals.digital),
        inCash: round2(totals.inCash),
        inDigital: round2(totals.inDigital),
      },
    });
  })
);

/** The full monthly report: category split, daily and weekly views, trend. */
router.get(
  '/monthly',
  wrap(async (req, res) => {
    const month = parseMonth(req.query.month);

    const [totals, expenses, income, daily, weekly, sixMonths, budgets, flow] = await Promise.all([
      monthTotals(req.user._id, month),
      byCategory(req.user._id, month, 'expense'),
      byCategory(req.user._id, month, 'income'),
      dailySeries(req.user._id, month),
      weeklySeries(req.user._id, month),
      trend(req.user._id, month, 6),
      budgetProgress(Budget, req.user._id, month),
      // Cash against accounts, both ways - so "money in" and "money out" on
      // this report are never a single number pretending cash and card are
      // the same thing.
      moneyFlow(req.user._id, month),
    ]);

    const spendingDays = daily.filter((d) => d.total > 0);

    res.json({
      month: monthKey(month),
      label: month.toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      totals,
      expenses,
      income,
      daily,
      weekly,
      trend: sixMonths,
      budgets,
      flow,
      pace: {
        // Average across the days money actually moved, which is more useful to
        // a student than an average that counts every quiet day as a zero.
        perActiveDay: spendingDays.length ? round2(totals.expense / spendingDays.length) : 0,
        activeDays: spendingDays.length,
        busiestDay: spendingDays.sort((a, b) => b.total - a.total)[0] || null,
      },
    });
  })
);

/** Income vs expense over the last six months (SRS 1.6, Monthly Reports). */
router.get(
  '/trend',
  wrap(async (req, res) => {
    const month = parseMonth(req.query.month);
    const months = Math.min(24, Math.max(3, Number(req.query.months) || 6));
    res.json({ trend: await trend(req.user._id, month, months) });
  })
);

/** Next month projected from the student's own history. */
router.get(
  '/forecast',
  wrap(async (req, res) => {
    res.json({ forecast: await forecastNextMonth(req.user._id, parseMonth(req.query.month)) });
  })
);

/**
 * A filtered report for the date-range / category / source filters. Returns the
 * matching rows plus their totals, which is what the export uses.
 */
router.get(
  '/filtered',
  wrap(async (req, res) => {
    const { from, to, category, type } = req.query;
    const filter = { user: req.user._id };
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(`${String(to).slice(0, 10)}T23:59:59.999Z`);
    }

    const transactions = await Transaction.find(filter).populate('category', 'name slot icon').sort({ date: -1 }).limit(500);
    const income = round2(transactions.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0));
    const expense = round2(transactions.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0));

    res.json({ transactions, totals: { income, expense, balance: round2(income - expense), count: transactions.length } });
  })
);

/** Flagged transactions - unusually large amounts and likely duplicates. */
router.get(
  '/flagged',
  wrap(async (req, res) => {
    const transactions = await Transaction.find({ user: req.user._id, flags: { $ne: [] } })
      .populate('category', 'name slot icon')
      .sort({ date: -1 })
      .limit(20);
    res.json({ transactions });
  })
);

/** Rebuilds the tips feed on demand (the dashboard refresh button). */
router.post(
  '/refresh-tips',
  wrap(async (req, res) => {
    const tips = await refreshTips(req.user, parseMonth(req.body.month));
    res.json({ tips });
  })
);

export default router;
