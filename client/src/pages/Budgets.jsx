import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout, { MonthPicker } from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import CountUp, { CountNumber } from '../components/CountUp.jsx';
import { GaugeArt } from '../components/Illustrations.jsx';
import { BudgetMeter } from '../components/Charts.jsx';
import { api } from '../lib/api.js';
import { money, monthKey, shiftMonth, slotColor } from '../lib/format.js';
import { useAuth, useToast } from '../context/AppContext.jsx';

/** The line under each budget's progress bar - encouraging where the plain
 * figure alone reads as cold, not just "Rs X left/over". */
function budgetNote(budget, currency) {
  if (budget.remaining < 0) {
    return `${money(Math.abs(budget.remaining), currency)} over - pull back a little this week`;
  }
  const share = budget.limitAmount > 0 ? budget.remaining / budget.limitAmount : 1;
  if (share >= 0.5) return `${money(budget.remaining, currency)} left - plenty of room`;
  if (share > 0.15) return `${money(budget.remaining, currency)} left - good pace`;
  return `${money(budget.remaining, currency)} left - almost there, ease off a bit`;
}

/**
 * Set several category caps in one go. Every uncapped category that has real
 * spending history is listed with an amount already filled in from what the
 * student usually spends there (GET /budgets/suggestions), so this starts
 * from real numbers, not blank fields. Clearing a row's amount skips it.
 */
function MultiSetForm({ month, options, onSaved }) {
  const toast = useToast();
  const [amounts, setAmounts] = useState({});
  const [busy, setBusy] = useState(false);

  // Start blank - you choose which categories to cap and the amount yourself.
  // Any usual-spend figure is shown only as a placeholder hint, never pre-filled.
  useEffect(() => {
    setAmounts({});
  }, [month, options]);

  const submit = async (event) => {
    event.preventDefault();
    const budgets = Object.entries(amounts)
      .map(([categoryId, v]) => ({ categoryId, limitAmount: Number(v) }))
      .filter((b) => Number.isFinite(b.limitAmount) && b.limitAmount > 0);
    if (!budgets.length) {
      toast.error('Nothing to save', 'Enter an amount for at least one category.');
      return;
    }
    setBusy(true);
    try {
      const { saved } = await api.put('/budgets/bulk', { month, budgets });
      toast.success(`${saved} budget${saved === 1 ? '' : 's'} set`);
      onSaved();
    } catch (err) {
      toast.error('Could not save those', err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!options.length) return null;

  return (
    <form className="stack" onSubmit={submit}>
      <p className="small muted" style={{ margin: 0 }}>
        Pick any categories and set your own caps - type an amount for the ones you want, leave the rest blank.
      </p>
      <div className="budget-multi">
        {options.map((s) => (
          <div className="budget-multi-row" key={s.categoryId}>
            <span className="budget-multi-name">
              <i className="swatch" style={{ background: slotColor(s.slot) }} />
              {s.name}
            </span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              placeholder={s.suggested ? `e.g. ${s.suggested}` : 'amount'}
              value={amounts[s.categoryId] ?? ''}
              onChange={(e) => setAmounts({ ...amounts, [s.categoryId]: e.target.value })}
              aria-label={`${s.name} cap`}
            />
          </div>
        ))}
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Saving…' : 'Set these caps'}
      </button>
    </form>
  );
}

/** The one overall monthly cap, across everything - set, change or clear it. */
function OverallBudgetCard({ month, overall, onSaved, currency }) {
  const toast = useToast();
  const [value, setValue] = useState(overall ? String(overall.limitAmount) : '');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setValue(overall ? String(overall.limitAmount) : '');
    setEditing(false);
  }, [overall]);

  const save = async (event) => {
    event.preventDefault();
    try {
      await api.put('/budgets/overall', { month, limitAmount: Number(value) || 0 });
      toast.success(Number(value) > 0 ? 'Overall budget set' : 'Overall budget cleared');
      onSaved();
    } catch (err) {
      toast.error('Could not save that', err.message);
    }
  };

  if (overall && !editing) {
    const tone = overall.state === 'exceeded' ? 'bad' : overall.state === 'warning' ? 'warn' : 'good';
    return (
      <section className="panel">
        <div className="panel-head">
          <h3>Overall budget</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
            Change
          </button>
        </div>
        <div className="panel-body">
          <div className="spine-amount num" style={{ marginBottom: '0.5rem' }}>
            {money(overall.spent, currency)} <span className="muted small">of {money(overall.limitAmount, currency)}</span>
            <span className={`pill is-${tone}`} style={{ marginLeft: '0.5rem' }}>
              {overall.state === 'exceeded' ? 'Over' : overall.state === 'warning' ? 'Close' : 'On track'}
            </span>
          </div>
          <div className="spine-bar">
            <div
              className="spine-fill"
              style={{
                width: `${Math.min(100, overall.pct)}%`,
                background: tone === 'bad' ? 'var(--bad)' : tone === 'warn' ? 'var(--warn)' : 'var(--accent)',
              }}
            />
          </div>
          <p className="small muted" style={{ marginTop: '0.4rem' }}>
            {overall.remaining >= 0
              ? `${money(overall.remaining, currency)} left across everything this month`
              : `${money(Math.abs(overall.remaining), currency)} over your total for the month`}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Overall budget</h3>
      </div>
      <div className="panel-body">
        <form className="stack" onSubmit={save}>
          <p className="small muted" style={{ margin: 0 }}>
            One cap for everything this month, on top of the per-category ones.
          </p>
          <div className="field">
            <label htmlFor="overall">Total monthly cap</label>
            <input id="overall" type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 30000" />
          </div>
          <div className="row">
            <button type="submit" className="btn btn-primary">
              {overall ? 'Update' : 'Set it'}
            </button>
            {overall ? (
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}

export default function Budgets() {
  const { currency } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useState(monthKey());
  const [data, setData] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [categories, setCategories] = useState([]);

  const load = useCallback(() => {
    api
      .get(`/budgets?month=${month}`)
      .then(setData)
      .catch((err) => toast.error('Could not load your budgets', err.message));
    api
      .get(`/budgets/suggestions?month=${month}`)
      .then(({ suggestions: list }) => setSuggestions(list))
      .catch(() => setSuggestions([]));
    api
      .get('/categories')
      .then(({ categories: list }) => setCategories(list || []))
      .catch(() => setCategories([]));
  }, [month, toast]);

  useEffect(load, [load]);

  const remove = async (budget) => {
    try {
      await api.del(`/budgets/${budget._id}`);
      load();
      toast.success(`${budget.category.name} budget removed`);
    } catch (err) {
      toast.error('Could not remove it', err.message);
    }
  };

  const copyForward = async () => {
    try {
      const { copied } = await api.post('/budgets/copy-forward', { from: shiftMonth(month, -1), to: month });
      load();
      toast.success(`Copied ${copied} budget${copied === 1 ? '' : 's'} from last month`);
    } catch (err) {
      toast.error('Nothing to copy', err.message);
    }
  };

  // Every expense category you haven't capped yet — so you can budget any of
  // them, with or without spending history. Suggested amounts become hints only.
  const cappedIds = new Set((data?.budgets || []).map((b) => String(b.category?._id || b.category)));
  const suggMap = new Map(suggestions.map((s) => [String(s.categoryId), s.suggested]));
  const capOptions = categories
    .filter((c) => c.type === 'expense' && !c.archived && !cappedIds.has(String(c._id)))
    .map((c) => ({ categoryId: c._id, name: c.name, slot: c.slot, suggested: suggMap.get(String(c._id)) }));

  return (
    <Layout
      title="Budgets"
      crumbs={
        <>
          <Link to="/dashboard">Dashboard</Link> / <span>Budgets</span>
        </>
      }
      actions={<MonthPicker value={month} onChange={setMonth} />}
    >
      {data?.budgets.length ? (
        <div className="stat-row">
          <div className="stat">
            <div className="stat-label">Budgeted</div>
            <div className="stat-value num"><CountUp value={data.summary.totalLimit} currency={currency} /></div>
          </div>
          <div className="stat">
            <div className="stat-label">Spent against it</div>
            <div className="stat-value num"><CountUp value={data.summary.totalSpent} currency={currency} /></div>
            <div className="stat-meta">{data.summary.pct}% of the total cap</div>
            {data.summary.totalSpent > 0 ? (
              <div className="spine-split" style={{ marginTop: '0.4rem' }}>
                <span>
                  <i style={{ background: 'var(--series-out)' }} />
                  {money(data.summary.totalCash, currency)} cash
                </span>
                <span>
                  <i style={{ background: 'var(--faint)' }} />
                  {money(data.summary.totalDigital, currency)} card / account
                </span>
              </div>
            ) : null}
          </div>
          <div className="stat">
            <div className="stat-label">Still available</div>
            <div className="stat-value num" style={{ color: data.summary.totalRemaining < 0 ? 'var(--bad)' : undefined }}>
              <CountUp value={data.summary.totalRemaining} currency={currency} />
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Over their cap</div>
            <div className="stat-value num"><CountNumber value={data.summary.overCount} /></div>
            <div className="stat-meta">{data.summary.overCount === 0 ? 'Nothing has gone over' : 'categories'}</div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-main">
        <section className="panel">
          <div className="panel-head">
            <h2>This month&rsquo;s caps</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={copyForward}>
              <Icon name="repeat" size={14} />
              Copy last month
            </button>
          </div>
          <div className="panel-body">
            {!data ? (
              <div className="skeleton" style={{ height: 160 }} />
            ) : data.budgets.length === 0 ? (
              <div className="empty">
                <GaugeArt />
                <h3>No caps set for this month</h3>
                <p>Set caps on the right - pick any categories and choose your own amounts.</p>
              </div>
            ) : (
              <div className="spine">
                {data.budgets.map((budget) => (
                  <div key={budget._id}>
                    <BudgetMeter budget={budget} currency={currency} />
                    <div className="row" style={{ marginTop: '-0.35rem' }}>
                      <span className="small muted">{budgetNote(budget, currency)}</span>
                      <button type="button" className="btn btn-ghost btn-sm push" onClick={() => remove(budget)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="stack">
          <OverallBudgetCard month={month} overall={data?.overall || null} onSaved={load} currency={currency} />

          <section className="panel">
            <div className="panel-head">
              <h3>Set category caps</h3>
            </div>
            <div className="panel-body">
              {capOptions.length ? (
                <MultiSetForm month={month} options={capOptions} onSaved={load} />
              ) : (
                <p className="muted small">Every category already has a cap this month.</p>
              )}
              <p className="small muted" style={{ marginTop: '1rem' }}>
                Campus Coin tells you once when you pass 80% of a cap, and once if you go over - it will not nag on every
                purchase.
              </p>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
