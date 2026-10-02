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

export default function Budgets() {
  const { currency } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useState(monthKey());
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [draft, setDraft] = useState({ categoryId: '', limitAmount: '' });

  const load = useCallback(() => {
    api
      .get(`/budgets?month=${month}`)
      .then(setData)
      .catch((err) => toast.error('Could not load your budgets', err.message));
  }, [month, toast]);

  useEffect(load, [load]);

  useEffect(() => {
    api.get('/categories?type=expense').then(({ categories: list }) => setCategories(list)).catch(() => {});
  }, []);

  const save = async (event) => {
    event.preventDefault();
    try {
      await api.put('/budgets', { ...draft, month, limitAmount: Number(draft.limitAmount) });
      setDraft({ categoryId: '', limitAmount: '' });
      load();
      toast.success('Budget saved');
    } catch (err) {
      toast.error('Could not save that budget', err.message);
    }
  };

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

  const used = new Set((data?.budgets || []).map((b) => String(b.category._id)));
  const available = categories.filter((c) => !used.has(String(c._id)));

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
                <p>
                  Start with one. A single cap on the category you spend most on is the change students actually keep
                  to - five caps at once almost never survive the month.
                </p>
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

        <section className="panel">
          <div className="panel-head">
            <h3>Add a cap</h3>
          </div>
          <div className="panel-body">
            <GaugeArt label="A budget gauge filling up" />
            {available.length === 0 ? (
              <p className="muted small">Every expense category already has a cap this month.</p>
            ) : (
              <form className="stack" onSubmit={save}>
                <div className="field">
                  <label htmlFor="cat">Category</label>
                  <select
                    id="cat"
                    required
                    value={draft.categoryId}
                    onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
                  >
                    <option value="">Choose one</option>
                    {available.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="limit">Monthly cap</label>
                  <input
                    id="limit"
                    type="number"
                    min="0"
                    required
                    value={draft.limitAmount}
                    onChange={(e) => setDraft({ ...draft, limitAmount: e.target.value })}
                  />
                </div>

                <button type="submit" className="btn btn-primary">
                  Set the cap
                </button>

                <p className="small muted">
                  Campus Coin will tell you once when you pass 80% of it, and once if you go over. It will not nag on
                  every purchase after that.
                </p>
              </form>
            )}

            {categories.length ? (
              <div style={{ marginTop: '1.5rem' }}>
                <h4 className="small muted" style={{ marginBottom: '0.6rem', fontWeight: 600 }}>
                  Categories without a cap
                </h4>
                <div className="row row-wrap">
                  {available.slice(0, 8).map((c) => (
                    <span className="pill" key={c._id}>
                      <i className="swatch" style={{ background: slotColor(c.slot) }} />
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </Layout>
  );
}
