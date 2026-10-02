import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import { addMonths, monthRange, startOfMonth, endOfMonth, weekOfMonth } from '../utils/dates.js';
import { round2 } from '../utils/money.js';

// Shared aggregations. The reports page, the tips engine, the insight writer and
// the forecast all read their numbers from here so they can never disagree.

const oid = (id) => new mongoose.Types.ObjectId(String(id));

/** Income, expense and the balance between them for one month. */
export async function monthTotals(userId, month) {
  const rows = await Transaction.aggregate([
    { $match: { user: oid(userId), month: startOfMonth(month) } },
    { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const income = rows.find((r) => r._id === 'income')?.total || 0;
  const expense = rows.find((r) => r._id === 'expense')?.total || 0;
  return {
    income: round2(income),
    expense: round2(expense),
    balance: round2(income - expense),
    // Share of income the student did not spend. Null when nothing came in.
    savingsRate: income > 0 ? Math.round(((income - expense) / income) * 100) : null,
    transactionCount: rows.reduce((acc, r) => acc + r.count, 0),
  };
}

/** Spending (or income) split by category for one month, largest first. */
export async function byCategory(userId, month, type = 'expense') {
  const rows = await Transaction.aggregate([
    { $match: { user: oid(userId), month: startOfMonth(month), type } },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
    { $unwind: '$category' },
    {
      $project: {
        _id: 0,
        categoryId: '$_id',
        name: '$category.name',
        slot: '$category.slot',
        icon: '$category.icon',
        total: { $round: ['$total', 2] },
        count: 1,
      },
    },
    { $sort: { total: -1 } },
  ]);
  const grand = rows.reduce((acc, r) => acc + r.total, 0);
  return rows.map((row) => ({ ...row, share: grand ? Math.round((row.total / grand) * 100) : 0 }));
}

/**
 * Cash against accounts, per category, for one month - what budgetProgress
 * uses so a cap's bar can say how much of it was notes rather than only the
 * one combined total.
 */
async function byCategoryMethod(userId, month, type = 'expense') {
  const rows = await Transaction.aggregate([
    { $match: { user: oid(userId), month: startOfMonth(month), type } },
    {
      $group: {
        _id: { category: '$category', isCash: { $eq: [{ $ifNull: ['$method', 'cash'] }, 'cash'] } },
        total: { $sum: '$amount' },
      },
    },
  ]);
  const byCategory = new Map();
  for (const row of rows) {
    const key = String(row._id.category);
    const entry = byCategory.get(key) || { cash: 0, digital: 0 };
    entry[row._id.isCash ? 'cash' : 'digital'] += row.total;
    byCategory.set(key, entry);
  }
  return byCategory;
}

/**
 * Spending for one month split by where the money moved, largest first, with
 * the cash / digital totals alongside. Cash leaves no trace of its own, so
 * seeing it as its own figure is the point: it is the part that goes missing.
 */
export async function byMethod(userId, month, type = 'expense') {
  const rows = await Transaction.aggregate([
    { $match: { user: oid(userId), month: startOfMonth(month), type } },
    {
      $group: {
        _id: {
          method: { $ifNull: ['$method', 'cash'] },
          // Two different wallets both filed under "other" are two different
          // places, so the typed name is part of the grouping key.
          label: {
            $cond: [{ $eq: [{ $ifNull: ['$method', 'cash'] }, 'other'] }, { $ifNull: ['$methodLabel', ''] }, ''],
          },
        },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $project: { _id: 0, method: '$_id.method', label: '$_id.label', total: { $round: ['$total', 2] }, count: 1 } },
    { $sort: { total: -1 } },
  ]);

  const grand = rows.reduce((acc, r) => acc + r.total, 0);
  const cash = rows.find((r) => r.method === 'cash')?.total || 0;
  return {
    rows: rows.map((row) => ({ ...row, share: grand ? Math.round((row.total / grand) * 100) : 0 })),
    total: round2(grand),
    cash: round2(cash),
    digital: round2(grand - cash),
    cashShare: grand ? Math.round((cash / grand) * 100) : 0,
  };
}

/**
 * Money arriving against money leaving, each split between accounts and cash.
 *
 * Note what this deliberately is NOT: a balance. Campus Coin has no concept of
 * moving money between places, so it never sees a withdrawal - an allowance
 * that lands in a bank account and is then spent as notes looks like money
 * that entered the account and left as cash, and a running per-place total
 * would drive cash steadily negative. Reporting the two flows is the honest
 * version of the same question, and it is the more interesting one anyway:
 * for most students money arrives digitally and leaves as notes.
 */
export async function moneyFlow(userId, month) {
  const rows = await Transaction.aggregate([
    { $match: { user: oid(userId), month: startOfMonth(month) } },
    {
      $group: {
        _id: { method: { $ifNull: ['$method', 'cash'] }, type: '$type' },
        total: { $sum: '$amount' },
      },
    },
  ]);

  const side = (type) => {
    let cash = 0;
    let account = 0;
    for (const row of rows) {
      if (row._id.type !== type) continue;
      if (row._id.method === 'cash') cash += row.total;
      else account += row.total;
    }
    const total = cash + account;
    return {
      cash: round2(cash),
      account: round2(account),
      total: round2(total),
      cashShare: total > 0 ? Math.round((cash / total) * 100) : null,
    };
  };

  return { in: side('income'), out: side('expense') };
}

/** Income vs expense for the last `count` months, oldest first. */
export async function trend(userId, endMonthDate, count = 6) {
  const months = monthRange(endMonthDate, count);
  const rows = await Transaction.aggregate([
    {
      $match: {
        user: oid(userId),
        month: { $gte: months[0], $lte: months[months.length - 1] },
      },
    },
    { $group: { _id: { month: '$month', type: '$type' }, total: { $sum: '$amount' } } },
  ]);

  return months.map((month) => {
    const stamp = month.getTime();
    const pick = (type) =>
      round2(rows.find((r) => r._id.month.getTime() === stamp && r._id.type === type)?.total || 0);
    const income = pick('income');
    const expense = pick('expense');
    return {
      month: `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`,
      label: month.toLocaleString('en', { month: 'short', timeZone: 'UTC' }),
      income,
      expense,
      balance: round2(income - expense),
    };
  });
}

/** Day-by-day spending across one month, including the days with nothing on them. */
export async function dailySeries(userId, month) {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const rows = await Transaction.aggregate([
    { $match: { user: oid(userId), type: 'expense', date: { $gte: start, $lte: end } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'UTC' } }, total: { $sum: '$amount' } } },
  ]);
  const totals = new Map(rows.map((r) => [r._id, round2(r.total)]));
  const days = end.getUTCDate();

  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), i + 1));
    const key = date.toISOString().slice(0, 10);
    return { date: key, day: i + 1, total: totals.get(key) || 0 };
  });
}

/** The same month rolled up into weeks, for the weekly summary card. */
export async function weeklySeries(userId, month) {
  const days = await dailySeries(userId, month);
  const weeks = new Map();

  for (const day of days) {
    const date = new Date(`${day.date}T00:00:00Z`);
    const week = weekOfMonth(date);
    const entry = weeks.get(week) || { week, total: 0, from: day.date, to: day.date };
    entry.total = round2(entry.total + day.total);
    entry.to = day.date;
    weeks.set(week, entry);
  }
  return [...weeks.values()].sort((a, b) => a.week - b.week);
}

/**
 * Average monthly spend per category over the `months` months *before* the given
 * month. This is the baseline everything else compares against - it is what makes
 * the advice personal rather than generic.
 */
export async function categoryBaseline(userId, month, months = 3) {
  const current = startOfMonth(month);
  const from = addMonths(current, -months);
  const to = addMonths(current, -1);

  const rows = await Transaction.aggregate([
    { $match: { user: oid(userId), type: 'expense', month: { $gte: from, $lte: to } } },
    { $group: { _id: { category: '$category', month: '$month' }, total: { $sum: '$amount' } } },
    { $group: { _id: '$_id.category', average: { $avg: '$total' }, monthsSeen: { $sum: 1 } } },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
    { $unwind: '$category' },
    {
      $project: {
        _id: 0,
        categoryId: '$_id',
        name: '$category.name',
        average: { $round: ['$average', 2] },
        monthsSeen: 1,
      },
    },
  ]);

  return new Map(rows.map((row) => [String(row.categoryId), row]));
}

/** Budget caps for a month next to what was actually spent against each. */
export async function budgetProgress(Budget, userId, month) {
  const start = startOfMonth(month);
  const [budgets, spending, methodSplit] = await Promise.all([
    Budget.find({ user: userId, month: start }).populate('category', 'name slot icon type'),
    byCategory(userId, start, 'expense'),
    byCategoryMethod(userId, start, 'expense'),
  ]);
  const spent = new Map(spending.map((row) => [String(row.categoryId), row.total]));

  return budgets
    .filter((budget) => budget.category)
    .map((budget) => {
      const used = spent.get(String(budget.category._id)) || 0;
      const pct = budget.limitAmount > 0 ? Math.round((used / budget.limitAmount) * 100) : 0;
      // How much of this cap was eaten by cash versus a card or account - a
      // budget bar that is 80% cash is a different problem to fix than one
      // that is 80% subscriptions on a card.
      const split = methodSplit.get(String(budget.category._id)) || { cash: 0, digital: 0 };
      return {
        _id: budget._id,
        category: budget.category,
        limitAmount: round2(budget.limitAmount),
        spent: used,
        cash: round2(split.cash),
        digital: round2(split.digital),
        remaining: round2(budget.limitAmount - used),
        pct,
        state: pct >= 100 ? 'exceeded' : pct >= 80 ? 'warning' : 'ok',
      };
    })
    .sort((a, b) => b.pct - a.pct);
}

/**
 * No-spend streaks (brief: "Sticky and viral"). The current streak counts
 * consecutive full days with zero expense, working backward from
 * *yesterday* rather than today - today is not over yet, so counting it
 * would credit a streak for a day that could still break it an hour later.
 * The longest streak looks at the same lookback window so a student who
 * broke a long streak last week still sees what they are chasing back to.
 */
export async function noSpendStreak(userId, { lookbackDays = 90 } = {}) {
  const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const since = new Date(today);
  since.setUTCDate(since.getUTCDate() - lookbackDays);

  const [rows, first] = await Promise.all([
    Transaction.aggregate([
      { $match: { user: oid(userId), type: 'expense', date: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'UTC' } } } },
    ]),
    Transaction.findOne({ user: oid(userId) }).sort({ date: 1 }).select('date'),
  ]);

  if (!first) return { current: 0, longest: 0, hasHistory: false };

  const spentDays = new Set(rows.map((r) => r._id));
  const dayKey = (d) => d.toISOString().slice(0, 10);
  const firstDay = new Date(Date.UTC(first.date.getUTCFullYear(), first.date.getUTCMonth(), first.date.getUTCDate()));

  let current = 0;
  const cursor = new Date(today);
  cursor.setUTCDate(cursor.getUTCDate() - 1); // start from yesterday
  while (cursor >= since && cursor >= firstDay) {
    if (spentDays.has(dayKey(cursor))) break;
    current += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let longest = 0;
  let run = 0;
  const walk = new Date(since > firstDay ? since : firstDay);
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() - 1);
  while (walk <= end) {
    if (spentDays.has(dayKey(walk))) {
      longest = Math.max(longest, run);
      run = 0;
    } else {
      run += 1;
    }
    walk.setUTCDate(walk.getUTCDate() + 1);
  }
  longest = Math.max(longest, run, current);

  return { current, longest, hasHistory: true };
}
