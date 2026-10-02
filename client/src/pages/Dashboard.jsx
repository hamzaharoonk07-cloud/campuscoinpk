import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout, { MonthPicker, openChat } from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import TransactionForm, { Modal } from '../components/TransactionForm.jsx';
import { api } from '../lib/api.js';
import { formatDate, money, monthKey, slotColor } from '../lib/format.js';
import { markFor } from '../lib/methods.js';
import CountUp from '../components/CountUp.jsx';
import QuickPhrase from '../components/QuickPhrase.jsx';
import SeasonBanner from '../components/SeasonBanner.jsx';
import { DonutChart, MonthBars } from '../components/DashCharts.jsx';
import { artUrl, categoryArt, CategoryIcon, WalletArt } from '../components/Illustrations.jsx';
import Avatar from '../components/Avatar.jsx';

import { useAuth, useToast } from '../context/AppContext.jsx';

/* ---------------------------------------------------------------------------
   The dashboard.

   Laid out like design 9 (a fintech dashboard on Dribbble): three figures
   across the top beside a tall "my month" card, the cash flow on a black
   card, then the month's spending as a grid of days, quick add and the
   latest transactions. Coming up, Coin's insight and the best tips close it.
--------------------------------------------------------------------------- */

// The things students log most often, one tap away. The description is what
// the categoriser reads, so each lands in the right category by itself.
const QUICK = [
  { label: 'Chai', art: 'hot-beverage', type: 'expense', description: 'Chai at the canteen' },
  { label: 'Rickshaw', art: 'bus', type: 'expense', description: 'Rickshaw to campus' },
  { label: 'Printing', art: 'page-facing-up', type: 'expense', description: 'Printing notes' },
  { label: 'Allowance', art: 'dollar-banknote', type: 'income', description: 'Monthly allowance' },
];

/**
 * The greeting, by the time of day on the student's own device: "Good
 * morning" before noon, "Good afternoon" until five, "Good evening" until
 * nine, and something gentler for the small hours.
 */
function greetingFor(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return { words: 'Still up', part: 'night' };
  if (hour < 12) return { words: 'Good morning', part: 'morning' };
  if (hour < 17) return { words: 'Good afternoon', part: 'afternoon' };
  if (hour < 21) return { words: 'Good evening', part: 'evening' };
  return { words: 'Good night', part: 'night' };
}

/**
 * The greeting at the top of the dashboard: the student's photo, a greeting
 * for the time of day, today's date and one line from their own numbers, on
 * a card whose colour and picture follow the day - a pale sky in the
 * morning, bright blue in the afternoon, deep navy in the evening and black
 * at night.
 */
function GreetingCard({ user, line, balance, currency, onAdd }) {
  const { words, part } = greetingFor();
  const first = user?.name?.split(' ')[0] || 'there';
  return (
    <section className={`d9-greet is-${part}`} aria-label="Greeting">
      <div className="d9-greet-copy">
        <h2>
          <Avatar user={user} size={44} />
          <span className="d9-greet-name">
            {words}, {first}
          </span>
        </h2>
        <p>{line}</p>
        <div className="d9-greet-actions">
          <span className={`d9-greet-chip${balance < 0 ? ' is-over' : ''}`}>
            {balance < 0 ? `${money(-balance, currency)} over this month` : `${money(balance, currency)} kept this month`}
          </span>
          <button type="button" className="d9-greet-add" onClick={onAdd}>
            <Icon name="plus" size={15} />
            Add a transaction
          </button>
        </div>
      </div>
      <div className="d9-greet-art" aria-hidden="true">
        <span className="d9-greet-glow" />
        <img src={artUrl('money-bag')} alt="" />
      </div>
    </section>
  );
}

/**
 * One line about where the student stands, from their own numbers. For the
 * current month it turns what is left into a daily figure, which is easier to
 * act on than a total; for past months it just says how the month ended.
 */
function personalLine({ totals, goal, month, currency }) {
  const now = new Date();
  const current = month === monthKey(now);
  if (!current) {
    return totals.balance >= 0
      ? `You kept ${money(totals.balance, currency)} that month.`
      : `That month ended ${money(-totals.balance, currency)} over.`;
  }
  if (totals.income === 0 && totals.expense === 0) return 'A fresh month - log your allowance to get started.';
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
  const days = `${daysLeft} day${daysLeft === 1 ? '' : 's'} left this month`;
  if (totals.balance < 0) return `${days}, and ${money(-totals.balance, currency)} over so far - a quiet week would close it.`;
  // What can go out each day and still leave the savings goal intact.
  const spare = totals.balance - Math.max(0, goal.target || 0);
  if (goal.target > 0 && spare <= 0) {
    return `${days}. You are ${money(-spare, currency)} short of your ${money(goal.target, currency)} goal, so hold spending where it is.`;
  }
  return `${days} - about ${money(Math.floor((goal.target > 0 ? spare : totals.balance) / daysLeft), currency)} a day to spend${goal.target > 0 ? ' and still hit your goal' : ''}.`;
}


/** Percentage change from last month, or null when there is nothing to compare. */
const change = (now, before) => (before ? Math.round(((now - before) / Math.abs(before)) * 100) : null);

/** The line under each Budget vs. actual bar - encouraging, not just a figure. */
function bvaNote(b, currency) {
  if (b.spent > b.limitAmount) {
    return `${money(b.spent - b.limitAmount, currency)} over - trim this one for the rest of the month`;
  }
  const share = b.limitAmount > 0 ? (b.limitAmount - b.spent) / b.limitAmount : 1;
  const left = money(b.limitAmount - b.spent, currency);
  if (share >= 0.5) return `${left} left - well in hand`;
  if (share > 0.15) return `${left} left - on track`;
  return `${left} left - almost there, nice control`;
}

/** A black pill with the change in it: "+22%". */
function Chip({ pct }) {
  if (pct === null) return <span className="d9-chip">new</span>;
  return (
    <span className="d9-chip">
      {pct >= 0 ? '+' : '−'}
      {Math.abs(pct)}%
    </span>
  );
}

/* --- The month as a grid of days ------------------------------------------ */

function DayGrid({ daily, currency }) {
  const peak = Math.max(...daily.map((d) => d.total), 1);
  // Four shades: nothing spent, a little, a fair amount, a heavy day.
  const shade = (t) => (t === 0 ? 'is-0' : t < peak * 0.25 ? 'is-1' : t < peak * 0.6 ? 'is-2' : 'is-3');
  // Seven columns, Monday first, one row per week, like a calendar.
  const first = daily.length ? (new Date(daily[0].date).getUTCDay() + 6) % 7 : 0;
  const cells = [...Array(first).fill(null), ...daily];
  return (
    <div className="d9-days">
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => (
        <span key={`w${i}`} className="d9-weekday" aria-hidden="true">
          {w}
        </span>
      ))}
      {cells.map((d, i) =>
        d ? (
          <Link
            key={d.date}
            to={`/calendar?day=${d.date}`}
            className={`d9-day ${shade(d.total)}`}
            title={`${formatDate(d.date, { day: 'numeric', month: 'short' })}: ${d.total ? money(d.total, currency) : 'nothing spent'} - open in the calendar`}
          >
            {d.day}
          </Link>
        ) : (
          <span key={`pad${i}`} className="d9-day is-pad" />
        )
      )}
    </div>
  );
}

/**
 * First steps for a new account. Each step ticks itself off from the
 * student's own data, so the card is a checklist rather than a tour, and it
 * disappears once they have a few transactions and every step is done.
 */
function GettingStarted({ totals, budgets, goal, onAllowance, onExpense }) {
  const steps = [
    {
      art: 'dollar-banknote',
      title: "Log this month's allowance",
      body: 'So Campus Coin knows what came in. One tap - just type the amount.',
      done: totals.income > 0,
      action: <button type="button" className="d9-pill is-dark" onClick={onAllowance}>Add allowance</button>,
    },
    {
      art: 'shopping-bags',
      title: 'Add something you bought',
      body: 'Chai, a rickshaw, printing - type it the way you would say it and the category fills itself in.',
      done: totals.expense > 0,
      action: (
        <span className="d9-steps-actions">
          <button type="button" className="d9-pill is-dark" onClick={onExpense}>Add spending</button>
          <Link to="/transactions" className="d9-link">or import a CSV</Link>
        </span>
      ),
    },
    {
      art: 'bullseye',
      title: 'Set one budget',
      body: 'A cap on the category you spend most on. You hear once at 80% and once if you go over.',
      done: budgets.length > 0,
      action: <Link to="/budgets" className="d9-pill is-dark">Set a budget</Link>,
    },
    {
      art: 'money-bag',
      title: 'Choose a savings goal',
      body: 'What you would like to keep each month. The tips and the greeting measure against it.',
      done: goal.target > 0,
      action: <Link to="/settings" className="d9-pill is-dark">Set a goal</Link>,
    },
  ];
  const done = steps.filter((st) => st.done).length;

  return (
    <section className="d9-card d9-steps">
      <div className="d9-head">
        <h2>Let's set up your month</h2>
        <span className="d9-steps-count">
          {done} of {steps.length} done
        </span>
      </div>
      <div className="d9-steps-bar" aria-hidden="true">
        <i style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="d9-steps-list">
        {steps.map((st, i) => (
          <li key={st.title} className={st.done ? 'is-done' : ''}>
            <span className="d9-steps-art">
              <img src={artUrl(st.art)} alt="" width="34" height="34" />
              {st.done ? (
                <span className="d9-steps-tick">
                  <Icon name="check" size={12} strokeWidth={3} />
                </span>
              ) : null}
            </span>
            <span className="d9-steps-copy">
              <small>Step {i + 1}</small>
              <strong>{st.title}</strong>
              <span>{st.body}</span>
            </span>
            <span className="d9-steps-do">{st.done ? <span className="d9-steps-donelabel">Done</span> : st.action}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Dashboard() {
  const { user, currency } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useState(monthKey());
  const [data, setData] = useState(null);
  const [daily, setDaily] = useState([]);
  const [categories, setCategories] = useState([]);
  const [adding, setAdding] = useState(false);
  // Which side of the accounts card is open into its per-account list: money in,
  // money out, or neither.
  const [openAccounts, setOpenAccounts] = useState(null);
  // A quick-add button opens the form already filled in.
  const [preset, setPreset] = useState(null);
  const [upcoming, setUpcoming] = useState([]);

  const load = useCallback(() => {
    api
      .get(`/reports/dashboard?month=${month}`)
      .then(setData)
      .catch((err) => toast.error('Could not load your dashboard', err.message));
    // The day-by-day spending, for the activity grid.
    api
      .get(`/reports/monthly?month=${month}`)
      .then(({ daily: days }) => setDaily(days || []))
      .catch(() => setDaily([]));
  }, [month, toast]);

  useEffect(load, [load]);

  useEffect(() => {
    api.get('/categories').then(({ categories: list }) => setCategories(list)).catch(() => {});
    // The repeating entries, soonest first, for "Coming up".
    api
      .get('/transactions?recurring=1&limit=20')
      .then(({ transactions }) =>
        setUpcoming(
          transactions
            .filter((t) => t.recurring?.nextRun)
            .sort((a, b) => new Date(a.recurring.nextRun) - new Date(b.recurring.nextRun))
            .slice(0, 3)
        )
      )
      .catch(() => {});
  }, []);

  const quickAdd = (item) => {
    setPreset(item);
    setAdding(true);
  };

  const activeDays = useMemo(() => daily.filter((d) => d.total > 0), [daily]);
  const busiest = useMemo(() => [...activeDays].sort((a, b) => b.total - a.total)[0], [activeDays]);

  const actions = <MonthPicker value={month} onChange={setMonth} />;
  const title = 'Dashboard';

  if (!data) {
    return (
      <Layout title={title} actions={actions}>
        <div className="d9-top">
          <div className="skeleton" style={{ height: 160 }} />
          <div className="skeleton" style={{ height: 160 }} />
          <div className="skeleton" style={{ height: 160 }} />
          <div className="skeleton" style={{ height: 160 }} />
        </div>
      </Layout>
    );
  }

  const { totals, spending, trend, tips, recent, insight, budgets, goal, announcements, methods, flow, methodsIn } = data;
  // Last month, for the change chips: the trend ends with the month shown.
  const before = trend.length > 1 ? trend[trend.length - 2] : null;
  const [year, monthIndex] = month.split('-').map(Number);
  const monthName = new Date(Date.UTC(year, monthIndex - 1, 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' });
  const over = budgets.filter((b) => b.state === 'exceeded').length;
  // The getting-started card stays until every step is done or the student
  // has settled in (a handful of transactions).
  const setupDone = totals.income > 0 && totals.expense > 0 && budgets.length > 0 && goal.target > 0;
  const setupLeft = !setupDone && recent.length < 6;

  return (
    <Layout title={title} actions={actions}>
      <GreetingCard
        user={user}
        line={personalLine({ totals, goal, month, currency })}
        balance={totals.balance}
        currency={currency}
        onAdd={() => setAdding(true)}
      />

      <QuickPhrase categories={categories} onSaved={load} />

      <SeasonBanner />

      {announcements?.length ? (
        <div className="d9-notice">
          <Icon name="bell" size={16} />
          <strong>{announcements[0].title}</strong>
          <span>{announcements[0].body}</span>
        </div>
      ) : null}

      {setupLeft ? (
        <GettingStarted
          totals={totals}
          budgets={budgets}
          goal={goal}
          onAllowance={() => quickAdd(QUICK.find((q) => q.type === 'income'))}
          onExpense={() => setAdding(true)}
        />
      ) : null}

      {/* The figures and charts, once there is something to draw. */}
      {recent.length ? (
        <>
        <div className="d9-top">
          {/* --- Three figures ------------------------------------------- */}
          <Link to="/reports" className="d9-card d9-stat">
            <span className="d9-stat-head">
              <Icon name="download" size={18} />
              Money in
            </span>
            <span className="d9-stat-row">
              <strong className="num">
                <CountUp value={totals.income} currency={currency} />
              </strong>
              <Chip pct={change(totals.income, before?.income)} />
            </span>
            {/* Where it landed. Money mostly arrives digitally, so accounts lead. */}
            {flow?.in?.total ? (
              <span className="d9-stat-split">
                <em>{money(flow.in.account, currency)} accounts</em>
                <em>{money(flow.in.cash, currency)} cash</em>
              </span>
            ) : null}
          </Link>
          <Link to="/transactions" className="d9-card d9-stat">
            <span className="d9-stat-head">
              <Icon name="upload" size={18} />
              Money out
            </span>
            <span className="d9-stat-row">
              <strong className="num">
                <CountUp value={totals.expense} currency={currency} />
              </strong>
              <Chip pct={change(totals.expense, before?.expense)} />
            </span>
            {/* And where it left from. Cash leads here, which is the whole point. */}
            {flow?.out?.total ? (
              <span className="d9-stat-split">
                <em>{money(flow.out.cash, currency)} cash</em>
                <em>{money(flow.out.account, currency)} accounts</em>
              </span>
            ) : null}
          </Link>
          <Link to="/insights" className="d9-card d9-stat">
            <span className="d9-stat-head">
              <Icon name="calendar" size={18} />
              {totals.balance < 0 ? 'Spent beyond income' : 'Kept'}
            </span>
            <span className="d9-stat-row">
              <strong className="num">{money(totals.balance, currency)}</strong>
              <small>in {monthName}</small>
            </span>
          </Link>
  
          {/* --- My month: the tall card on the right --------------------- */}
          <section className="d9-card d9-month">
            <div className="d9-head">
              <h2>My month</h2>
              <button type="button" className="d9-pill is-dark" onClick={() => setAdding(true)}>
                <Icon name="plus" size={15} />
                Add
              </button>
            </div>
            <div className="d9-month-figure">
              <strong className="num">{money(totals.expense, currency)}</strong>
              <span>
                spent
                {totals.savingsRate !== null ? `, ${totals.savingsRate >= 0 ? totals.savingsRate + '% of income kept' : Math.abs(totals.savingsRate) + '% over income'}` : ''}
              </span>
            </div>
            <span className="d9-sub">Where it went · tap a category</span>
            {spending.length ? (
              <DonutChart rows={spending} currency={currency} total={totals.expense} caption="Spent" />
            ) : (
              <p className="d9-muted">Nothing spent yet this month.</p>
            )}
            <p className="d9-muted d9-budget-line">
              {budgets.length ? `${budgets.length} budgets set · ${over ? `${over} over the cap` : 'all within their cap'}` : 'No budgets set this month.'}
            </p>
            <Link to="/budgets" className="d9-pill is-dark is-wide">
              Manage budgets
            </Link>
          </section>
  
          {/* --- Cash flow on black ---------------------------------------- */}
          <section className="d9-card d9-dark d9-flow-card">
            <div className="d9-head">
              <h2>Cash flow</h2>
              <span className="d9-flow-note">Last 6 months · tap a month</span>
            </div>
            <MonthBars data={trend} currency={currency} dark />
          </section>
        </div>
  
        {/* --- The SRS's two named widgets --------------------------------- */}
        <div className="d9-row d9-row-srs">
          <section className="d9-card d9-topcat">
            <div className="d9-head">
              <h2>This month's top category</h2>
              <Link to="/reports" className="d9-link">
                Report
              </Link>
            </div>
            {spending.length ? (
              <>
                <div className="d9-topcat-hero">
                  <span className="d9-topcat-art" style={{ background: `color-mix(in srgb, ${slotColor(spending[0].slot)} 18%, var(--surface))` }}>
                    <img src={categoryArt(spending[0].icon)} alt="" width="46" height="46" />
                  </span>
                  <span>
                    <strong>{spending[0].name}</strong>
                    <span className="num">{money(spending[0].total, currency)}</span>
                  </span>
                </div>
                <div className="d9-topcat-bar" aria-label={`${spending[0].share}% of spending`}>
                  <i style={{ width: `${spending[0].share}%`, background: slotColor(spending[0].slot) }} />
                </div>
                <p className="d9-muted">
                  {spending[0].share}% of everything you spent
                  {spending[1] ? `, ahead of ${spending[1].name} at ${spending[1].share}%` : ''}.
                </p>
                {/* The next three, so the card has something under the winner and the
                    top category is read against what it beat. */}
                {spending.length > 1 ? (
                  <ul className="d9-topcat-next">
                    {spending.slice(1, 4).map((c) => (
                      <li key={c.categoryId || c.name}>
                        <CategoryIcon icon={c.icon} slot={c.slot} size={28} />
                        <span className="d9-topcat-next-name">
                          {c.name}
                          <span className="d9-topcat-next-bar">
                            <i style={{ width: `${c.share}%`, background: slotColor(c.slot) }} />
                          </span>
                        </span>
                        <span className="num">{money(c.total, currency)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <p className="d9-muted">Nothing spent yet this month.</p>
            )}
          </section>
  
          <section className="d9-card d9-bva">
            <div className="d9-head">
              <h2>Budget vs. actual</h2>
              <Link to="/budgets" className="d9-link">
                Manage
              </Link>
            </div>
            {budgets.length ? (
              <ul className="d9-bva-list">
                {budgets.map((b) => {
                  const tone = b.state === 'exceeded' ? 'is-over' : b.state === 'warning' ? 'is-close' : 'is-ok';
                  return (
                    <li key={b._id}>
                      <CategoryIcon icon={b.category.icon} slot={b.category.slot} size={36} />
                      <span className="d9-bva-main">
                        <span className="d9-bva-top">
                          <strong>{b.category.name}</strong>
                          <span className={`d9-bva-chip ${tone}`}>
                            {b.state === 'exceeded' ? 'Over' : b.state === 'warning' ? 'Close' : 'On track'}
                          </span>
                          <span className="d9-bva-figures num">
                            {money(b.spent, currency)} <small>of {money(b.limitAmount, currency)}</small>
                          </span>
                        </span>
                        <span className={`d9-bva-track ${tone}`} aria-label={`${b.pct}% of the budget used`}>
                          <i style={{ width: `${Math.min(100, b.pct)}%` }} />
                        </span>
                        <small className="d9-bva-note">{bvaNote(b, currency)}</small>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="d9-bva-empty">
                <p className="d9-muted">No budgets this month. One budget on your biggest category is the change most students actually keep to.</p>
                <Link to="/budgets" className="d9-pill is-dark">
                  Set a budget
                </Link>
              </div>
            )}
          </section>
        </div>
  
        {/* Where the money moved. It has its own row: it is far wider than the two
            cards above it, and sitting beside them it left a hole under Top category
            and pushed Budget vs. actual onto a row of its own. */}
        <div className="d9-row d9-row-methods">
          <section className="d9-card d9-methods">
            <div className="d9-head">
              <h2>In account and in cash</h2>
              <Link to="/transactions" className="d9-link">
                All
              </Link>
            </div>
            {methods?.total ? (
              <div className="d9-methods-body">
                <div className="d9-methods-side">
                  <div className="d9-methods-split">
                    <button
                      type="button"
                      className={`is-digital d9-acc-toggle${openAccounts === 'in' ? ' is-open' : ''}`}
                      aria-expanded={openAccounts === 'in'}
                      onClick={() => setOpenAccounts((v) => (v === 'in' ? null : 'in'))}
                    >
                      <em>Came in to accounts</em>
                      <strong className="num">{money(flow?.in?.account ?? 0, currency)}</strong>
                      <small>
                        {flow?.in?.cash ? `and ${money(flow.in.cash, currency)} as cash` : 'nothing arrived as cash'}
                      </small>
                      <span className="d9-acc-hint">{openAccounts === 'in' ? 'Hide accounts' : 'Show accounts'}</span>
                    </button>
                    <button
                      type="button"
                      className={`d9-acc-toggle${openAccounts === 'out' ? ' is-open' : ''}`}
                      aria-expanded={openAccounts === 'out'}
                      onClick={() => setOpenAccounts((v) => (v === 'out' ? null : 'out'))}
                    >
                      <em>Went out as cash</em>
                      <strong className="num">{money(flow?.out?.cash ?? 0, currency)}</strong>
                      <small>
                        {flow?.out?.account ? `and ${money(flow.out.account, currency)} from accounts` : 'nothing from accounts'}
                      </small>
                      <span className="d9-acc-hint">{openAccounts === 'out' ? 'Hide accounts' : 'Show accounts'}</span>
                    </button>
                  </div>
                  {openAccounts ? (
                    <div className="d9-acc-panel" role="region" aria-live="polite">
                      <h3 className="d9-methods-sub">
                        {openAccounts === 'in' ? 'Money in, by account' : 'Money out, by account'}
                      </h3>
                      {(openAccounts === 'in' ? (methodsIn?.rows || []).filter((r) => r.method !== 'cash') : (methods?.rows || []).filter((r) => r.method !== 'cash')).length ? (
                        <ul className="d9-acc-list">
                          {(openAccounts === 'in' ? (methodsIn?.rows || []).filter((r) => r.method !== 'cash') : (methods?.rows || []).filter((r) => r.method !== 'cash')).map((row) => {
                            const m = markFor(row.method, row.label);
                            return (
                              <li key={`${row.method}:${row.label || ''}`}>
                                <span className="d9-method-mark" style={{ background: `#${m.hex}`, color: m.ink }}>
                                  {m.letter}
                                </span>
                                <span className="d9-method-name">
                                  {m.name}
                                  <em>{row.count} {row.count === 1 ? 'entry' : 'entries'} &middot; {row.share}%</em>
                                </span>
                                <span className="num">{money(row.total, currency)}</span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="d9-muted">Nothing {openAccounts === 'in' ? 'came in to' : 'went out from'} an account this month.</p>
                      )}
                    </div>
                  ) : null}
                  {flow?.out?.cashShare !== null && flow?.out?.cashShare !== undefined ? (
                    <div className="d9-methods-bar" aria-label={`${flow.out.cashShare}% of spending was cash`}>
                      <i style={{ width: `${flow.out.cashShare}%` }} />
                    </div>
                  ) : null}
                  <p className="d9-methods-note">
                    Money reaches you digitally and leaves as notes. Withdrawals are not logged, so no balance is guessed.
                  </p>
                </div>
                <div className="d9-methods-main">
                  <h3 className="d9-methods-sub">Spent this month, by where it moved</h3>
                  <ul className="d9-methods-list">
                    {methods.rows.map((row) => {
                      const m = markFor(row.method, row.label);
                      return (
                        <li key={`${row.method}:${row.label || ''}`}>
                          <span className="d9-method-mark" style={{ background: `#${m.hex}`, color: m.ink }}>
                            {m.letter}
                          </span>
                          <span className="d9-method-name">
                            {m.name}
                            <em>{row.count} {row.count === 1 ? 'entry' : 'entries'}</em>
                          </span>
                          <span className="num">{money(row.total, currency)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="d9-muted">Nothing spent yet this month.</p>
            )}
          </section>
        </div>

        <div className="d9-row">
          {/* --- Spending activity ----------------------------------------- */}
          <section className="d9-card d9-activity">
            <div className="d9-head">
              <h2>Spending activity</h2>
            <Link to="/calendar" className="d9-link">
              Open calendar
            </Link>
              <span className="d9-pill is-dark is-small">{monthName}</span>
            </div>
            <div className="d9-activity-figure">
              <strong className="num">{activeDays.length}</strong>
              <span>days with spending</span>
            </div>
            {daily.length ? <DayGrid daily={daily} currency={currency} /> : <p className="d9-muted">No days to show yet.</p>}
            <div className="d9-legend">
              <span>Less</span>
              <i className="d9-day is-0" />
              <i className="d9-day is-1" />
              <i className="d9-day is-2" />
              <i className="d9-day is-3" />
              <span>More</span>
            </div>
            {busiest ? (
              <p className="d9-muted">
                Busiest day: {formatDate(busiest.date, { day: 'numeric', month: 'short' })}, {money(busiest.total, currency)}
              </p>
            ) : null}
          </section>
  
          {/* --- Quick add: dark tiles ------------------------------------- */}
          <section className="d9-card">
            <div className="d9-head">
              <h2>Quick add</h2>
              <span className="d9-muted">One tap</span>
            </div>
            <div className="d9-quick">
              {QUICK.map((item) => (
                <button key={item.label} type="button" onClick={() => quickAdd(item)}>
                  <span className="d9-quick-icon">
                    <img src={artUrl(item.art)} alt="" width="22" height="22" />
                  </span>
                  <strong>{item.label}</strong>
                  <small>{item.type === 'income' ? 'Money in' : 'Money out'}</small>
                </button>
              ))}
            </div>
            <button type="button" className="d9-pill is-dark is-wide" onClick={() => setAdding(true)}>
              <Icon name="camera" size={15} />
              Scan a receipt
            </button>
          </section>
  
          {/* --- Latest transactions --------------------------------------- */}
          <section className="d9-card">
            <div className="d9-head">
              <h2>Transactions</h2>
              <Link to="/transactions" className="d9-link">
                View all
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="empty">
                <WalletArt />
                <h3>Nothing logged yet</h3>
                <p>Start with the thing you bought most recently.</p>
              </div>
            ) : (
              <ul className="d9-tx">
                {recent.map((row) => {
                  const flagged = row.flags?.includes('duplicate') || row.flags?.includes('large') || row.flags?.includes('cash-no-source');
                  const flagWord = row.flags?.includes('duplicate')
                    ? 'duplicate?'
                    : row.flags?.includes('large')
                      ? 'unusual'
                      : 'no cash logged in';
                  return (
                    <li key={row._id}>
                      <CategoryIcon icon={row.category?.icon} slot={row.category?.slot} size={36} text={row.description} />
                      <span className="d9-tx-name">
                        <strong>{row.description || row.category?.name}</strong>
                        <small>
                          {row.category?.name}
                          {flagged ? <em> · {flagWord}</em> : null}
                        </small>
                      </span>
                      <span className="d9-tx-amount">
                        <strong className={`num${row.type === 'income' ? ' is-in' : ''}`}>
                          {row.type === 'income' ? '+' : '−'}
                          {money(row.amount, currency).replace('−', '')}
                        </strong>
                        <small>{formatDate(row.date, { day: 'numeric', month: 'short' })}</small>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
  
        <div className="d9-row">
          <section className="d9-card">
            <div className="d9-head">
              <h2>Coming up</h2>
              <span className="d9-muted">Repeating</span>
            </div>
            {upcoming.length ? (
              <ul className="d9-tx">
                {upcoming.map((row) => (
                  <li key={row._id}>
                    <CategoryIcon icon={row.category?.icon} slot={row.category?.slot} size={36} text={row.description} />
                    <span className="d9-tx-name">
                      <strong>{row.description || row.category?.name}</strong>
                      <small>{row.recurring.frequency}</small>
                    </span>
                    <span className="d9-tx-amount">
                      <strong className={`num${row.type === 'income' ? ' is-in' : ''}`}>
                        {row.type === 'income' ? '+' : '−'}
                        {money(row.amount, currency)}
                      </strong>
                      <small>{formatDate(row.recurring.nextRun, { day: 'numeric', month: 'short' })}</small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="d9-muted">Nothing repeats yet. Tick "This repeats" when you add an allowance or a subscription.</p>
            )}
          </section>
  
          <section className="d9-card d9-blue">
            <div className="d9-head">
              <h2>Coin's insight</h2>
              <button type="button" className="d9-round" onClick={() => openChat()} aria-label="Ask Coin">
                <Icon name="chat" size={17} />
              </button>
            </div>
            <p className="d9-insight">
              {insight?.summaryText ||
                (tips[0] ? tips[0].body : 'Log a couple of weeks of spending and Coin will sum up your month here.')}
            </p>
            <Link to="/insights" className="d9-pill is-light">
              Read the full insight
            </Link>
          </section>
  
          <section className="d9-card">
            <div className="d9-head">
              <h2>Worth doing</h2>
              <Link to="/tips" className="d9-link">
                All tips
              </Link>
            </div>
            {tips.length ? (
              <ul className="d9-tips">
                {tips.slice(0, 3).map((tip) => (
                  <li key={tip._id}>
                    <span className="d9-round is-small">
                      <Icon name="bulb" size={15} />
                    </span>
                    <span>
                      <strong>{tip.title}</strong>
                      {tip.impact > 0 ? <small>Could save {money(tip.impact, currency)} a month</small> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="d9-muted">Tips appear once there is a couple of weeks of history to compare against.</p>
            )}
          </section>
        </div>
        </>
      ) : (
        <div className="d9-row d9-row-fresh">
          <section className="d9-card">
            <div className="d9-head">
              <h2>Quick add</h2>
              <span className="d9-muted">One tap</span>
            </div>
            <div className="d9-quick">
              {QUICK.map((item) => (
                <button key={item.label} type="button" onClick={() => quickAdd(item)}>
                  <span className="d9-quick-icon">
                    <img src={artUrl(item.art)} alt="" width="22" height="22" />
                  </span>
                  <strong>{item.label}</strong>
                  <small>{item.type === 'income' ? 'Money in' : 'Money out'}</small>
                </button>
              ))}
            </div>
          </section>
          <section className="d9-card d9-fresh-note">
            <WalletArt />
            <h3>Your charts appear here</h3>
            <p className="d9-muted">
              After your first few entries, this is where your cash flow, where the money went and your budgets show up.
            </p>
          </section>
        </div>
      )}

      {adding ? (
        <Modal
          title="Add a transaction"
          onClose={() => {
            setAdding(false);
            setPreset(null);
          }}
        >
          <TransactionForm
            categories={categories}
            preset={preset}
            onSaved={() => {
              setAdding(false);
              load();
            }}
            onCancel={() => setAdding(false)}
          />
        </Modal>
      ) : null}
    </Layout>
  );
}
