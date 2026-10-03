import Budget from '../models/Budget.js';
import Notification from '../models/Notification.js';
import { byCategory } from './analytics.js';
import { sendToUser } from './push.js';
import { startOfMonth } from '../utils/dates.js';
import { formatMoney, round2 } from '../utils/money.js';

// ---------------------------------------------------------------------------
// Budget alerts
//
// Runs after a transaction is written. A student is told once when a category
// crosses 80% of its cap and once when it goes over - the crossing is what is
// worth an alert, not every purchase after it.
// ---------------------------------------------------------------------------

const WARN_AT = 80;

export async function checkBudgets(user, month) {
  if (!user.preferences?.alertsEnabled) return [];

  const start = startOfMonth(month);
  const [budgets, spending] = await Promise.all([
    Budget.find({ user: user._id, month: start }).populate('category', 'name'),
    byCategory(user._id, start, 'expense'),
  ]);
  const spent = new Map(spending.map((row) => [String(row.categoryId), row.total]));
  const raised = [];

  for (const budget of budgets) {
    if (!budget.category || budget.limitAmount <= 0) continue;
    const used = spent.get(String(budget.category._id)) || 0;
    const pct = Math.round((used / budget.limitAmount) * 100);

    // alertedAt remembers the highest threshold already announced.
    const level = pct >= 100 ? 100 : pct >= WARN_AT ? WARN_AT : 0;
    if (level === 0 || level <= budget.alertedAt) {
      // Spending came back down (an edit or a delete) - allow the alert again.
      if (level < budget.alertedAt) {
        budget.alertedAt = level;
        await budget.save();
      }
      continue;
    }

    const fmt = (n) => formatMoney(round2(n), user.currency || 'PKR');
    const notification = await Notification.create({
      user: user._id,
      kind: level === 100 ? 'budget-exceeded' : 'budget-warning',
      title:
        level === 100
          ? `${budget.category.name} is over budget`
          : `${budget.category.name} is at ${pct}% of its budget`,
      body:
        level === 100
          ? `You have spent ${fmt(used)} against a ${fmt(budget.limitAmount)} cap - ${fmt(used - budget.limitAmount)} over.`
          : `${fmt(budget.limitAmount - used)} of your ${fmt(budget.limitAmount)} cap is left for the rest of the month.`,
      link: '/budgets',
    });

    budget.alertedAt = level;
    await budget.save();
    raised.push(notification);

    // Mirror the in-app alert to a system push, so the student sees it even with
    // the app closed. Fire-and-forget: a push failure never blocks the save.
    sendToUser(user._id, {
      title: notification.title,
      body: notification.body,
      link: notification.link || '/budgets',
      tag: `budget-${budget.category._id}`,
    }).catch(() => {});
  }

  return raised;
}

export async function notifyAnomaly(user, transaction, flags, describeFlag) {
  if (!flags.length || !user.preferences?.alertsEnabled) return null;

  const title = flags.includes('duplicate')
    ? 'Possible duplicate transaction'
    : flags.includes('large')
      ? 'Unusually large transaction'
      : 'Cash spent with nothing logged behind it';

  return Notification.create({
    user: user._id,
    kind: 'anomaly',
    title,
    body: flags.map((flag) => describeFlag(flag, transaction)).filter(Boolean).join(' '),
    link: '/transactions',
  });
}
