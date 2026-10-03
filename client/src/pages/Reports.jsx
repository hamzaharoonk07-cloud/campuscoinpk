import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout, { MonthPicker } from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import CountUp from '../components/CountUp.jsx';
import { CategorySpine, DayBars } from '../components/Charts.jsx';
import { DonutChart, MonthBars, Sparkline } from '../components/DashCharts.jsx';
import { api } from '../lib/api.js';
import { formatDate, money, monthKey } from '../lib/format.js';
import { useAuth, useToast } from '../context/AppContext.jsx';

/* ---------------------------------------------------------------------------
   The monthly report. Built on the same "design 9" card language as the
   dashboard - d9-card, d9-stat, d9-head - rather than the plainer panel/kpi
   system the rest of the pre-redesign app still used, so moving from the
   dashboard into a report does not feel like dropping into an older product.
   The headline figures also carry the same cash/accounts split the dashboard
   and calendar already show: a single "money in" or "money out" total treats
   a JazzCash transfer and a fold of cash as the same thing, which they are
   not to a student trying to reconcile what is actually in their pocket.
--------------------------------------------------------------------------- */

/** Percentage change from last month - the same reading the dashboard's
    headline figures use, so "+12%" means the same thing on both screens. */
const change = (now, before) => (before ? Math.round(((now - before) / Math.abs(before)) * 100) : null);

function Chip({ pct }) {
  if (pct === null) return <span className="d9-chip">new</span>;
  return (
    <span className="d9-chip">
      {pct >= 0 ? '+' : '−'}
      {Math.abs(pct)}%
    </span>
  );
}

export default function Reports() {
  const { currency, user } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useState(monthKey());
  const [report, setReport] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [view, setView] = useState('daily');

  const load = useCallback(() => {
    api
      .get(`/reports/monthly?month=${month}`)
      .then(setReport)
      .catch((err) => toast.error('Could not build that report', err.message));
    api
      .get(`/reports/forecast?month=${month}`)
      .then(({ forecast: f }) => setForecast(f))
      .catch(() => {});
  }, [month, toast]);

  useEffect(load, [load]);

  const exportCsv = async () => {
    try {
      const csv = await api.text(`/transactions/export?month=${month}`);
      const name = `campus-coin-${month}.csv`;
      // In the native app, blob downloads don't work in the WebView - hand the CSV
      // to the native bridge, which saves it to Downloads.
      if (window.AndroidDownload && typeof window.AndroidDownload.saveCsv === 'function') {
        window.AndroidDownload.saveCsv(name, csv);
        return;
      }
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Could not prepare the download', err.message);
    }
  };

  if (!report) {
    return (
      <Layout title="Reports">
        <div className="d9-row d9-row-4">
          <div className="skeleton" style={{ height: 156 }} />
          <div className="skeleton" style={{ height: 156 }} />
          <div className="skeleton" style={{ height: 156 }} />
          <div className="skeleton" style={{ height: 156 }} />
        </div>
        <div className="skeleton" style={{ height: 340, marginTop: '1rem' }} />
      </Layout>
    );
  }

  const { totals, expenses, income, daily, weekly, trend, budgets, flow, pace, label } = report;
  // Last month, for the change chips - the trend series ends with the month shown.
  const before = trend.length > 1 ? trend[trend.length - 2] : null;

  return (
    <Layout
      title="Monthly report"
      crumbs={
        <>
          <Link to="/dashboard">Dashboard</Link> / <span>Reports</span>
        </>
      }
      actions={
        <>
          <MonthPicker value={month} onChange={setMonth} />
          <button type="button" className="d9-pill is-dark is-small" onClick={() => window.print()}>
            <Icon name="download" size={14} />
            Save as PDF
          </button>
          <button type="button" className="d9-pill is-dark is-small" onClick={exportCsv}>
            <Icon name="upload" size={14} />
            CSV
          </button>
        </>
      }
    >
      {/* --- Four headline figures ------------------------------------------- */}
      <div className="d9-row d9-row-4">
        <section className="d9-card d9-stat">
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
          {/* Where it landed - money mostly arrives digitally, so accounts lead. */}
          {flow?.in?.total ? (
            <span className="d9-stat-split">
              <em>{money(flow.in.account, currency)} accounts</em>
              <em>{money(flow.in.cash, currency)} cash</em>
            </span>
          ) : null}
          <div style={{ marginTop: 'auto', paddingTop: '0.6rem' }}>
            <Sparkline values={trend.map((t) => t.income)} colour="var(--series-in)" from={trend[0]?.label} to={trend.at(-1)?.label} />
          </div>
        </section>

        <section className="d9-card d9-stat">
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
          {/* And where it left from - cash leads here, which is the whole point. */}
          {flow?.out?.total ? (
            <span className="d9-stat-split">
              <em>{money(flow.out.cash, currency)} cash</em>
              <em>{money(flow.out.account, currency)} accounts</em>
            </span>
          ) : null}
          <span className="d9-muted">{totals.transactionCount} transactions</span>
          <div style={{ marginTop: 'auto', paddingTop: '0.6rem' }}>
            <Sparkline values={trend.map((t) => t.expense)} colour="var(--series-out)" from={trend[0]?.label} to={trend.at(-1)?.label} />
          </div>
        </section>

        <section className="d9-card d9-stat">
          <span className="d9-stat-head">
            <Icon name="wallet" size={18} />
            {totals.balance < 0 ? 'Spent beyond income' : 'Kept'}
          </span>
          <span className="d9-stat-row">
            <strong className="num" style={{ color: totals.balance < 0 ? 'var(--bad)' : 'var(--good)' }}>
              <CountUp value={totals.balance} currency={currency} />
            </strong>
          </span>
          {totals.savingsRate !== null ? <span className="d9-muted">{totals.savingsRate}% of what came in</span> : null}
          <div style={{ marginTop: 'auto', paddingTop: '0.6rem' }}>
            <Sparkline
              values={trend.map((t) => t.balance)}
              colour={totals.balance < 0 ? 'var(--bad)' : 'var(--good)'}
              from={trend[0]?.label}
              to={trend.at(-1)?.label}
            />
          </div>
        </section>

        <section className="d9-card d9-stat">
          <span className="d9-stat-head">
            <Icon name="chart" size={18} />
            On a spending day
          </span>
          <span className="d9-stat-row">
            <strong className="num">
              <CountUp value={pace.perActiveDay} currency={currency} />
            </strong>
          </span>
          <span className="d9-muted">across {pace.activeDays} days with any spending</span>
        </section>
      </div>

      {/* --- Day by day / week by week ---------------------------------------- */}
      <section className="d9-card">
        <div className="d9-head">
          <h2>{label}</h2>
          <div className="d9-seg" role="group" aria-label="View">
            <button type="button" className={view === 'daily' ? 'is-on' : ''} aria-pressed={view === 'daily'} onClick={() => setView('daily')}>
              By day
            </button>
            <button type="button" className={view === 'weekly' ? 'is-on' : ''} aria-pressed={view === 'weekly'} onClick={() => setView('weekly')}>
              By week
            </button>
          </div>
        </div>
        {view === 'daily' ? (
          <DayBars data={daily} currency={currency} average={pace.perActiveDay} />
        ) : (
          <div className="spine">
            {weekly.map((week) => {
              const max = Math.max(...weekly.map((w) => w.total), 1);
              return (
                <div className="spine-row" key={week.week}>
                  <div className="spine-name">
                    <span>Week {week.week}</span>
                    <span className="d9-muted">
                      {formatDate(week.from, { day: 'numeric', month: 'short' })} &ndash;{' '}
                      {formatDate(week.to, { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div className="spine-amount num">{money(week.total, currency)}</div>
                  <div className="spine-bar">
                    <div className="spine-fill" style={{ width: `${(week.total / max) * 100}%`, background: 'var(--series-out)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {pace.busiestDay ? (
          <p className="d9-muted" style={{ marginTop: '0.9rem' }}>
            The heaviest single day was {formatDate(pace.busiestDay.date)} at {money(pace.busiestDay.total, currency)}.
          </p>
        ) : null}
      </section>

      {/* --- Where it went / where it came from ------------------------------- */}
      <div className="grid grid-2">
        <section className="d9-card">
          <div className="d9-head">
            <h2>Where it went</h2>
          </div>
          <CategorySpine rows={expenses} currency={currency} budgets={budgets} />
        </section>

        <section className="d9-card">
          <div className="d9-head">
            <h2>Where it came from</h2>
          </div>
          <DonutChart rows={income} currency={currency} total={totals.income} caption="Came in this month" />
        </section>
      </div>

      {/* --- Six-month trend, on black like the dashboard's cash flow ---------- */}
      <section className="d9-card d9-dark">
        <div className="d9-head">
          <h2>Income against spending, last six months</h2>
        </div>
        <MonthBars data={trend} currency={currency} dark />
      </section>

      {/* --- Next month, projected ---------------------------------------------- */}
      <section className="d9-card">
        <div className="d9-head">
          <h2>Next month, projected</h2>
        </div>
        {!forecast?.available ? (
          <p className="d9-muted">{forecast?.reason || 'Not enough history yet.'}</p>
        ) : (
          <div className="stack">
            <div className="row row-wrap" style={{ gap: '2rem' }}>
              <div>
                <div className="stat-label">Likely spending</div>
                <div className="stat-value num">
                  <CountUp value={forecast.expense} currency={currency} />
                </div>
              </div>
              <div>
                <div className="stat-label">Likely income</div>
                <div className="stat-value num">
                  <CountUp value={forecast.income} currency={currency} />
                </div>
              </div>
              <div>
                <div className="stat-label">Which leaves</div>
                <div className="stat-value num" style={{ color: forecast.balance < 0 ? 'var(--bad)' : 'var(--good)' }}>
                  <CountUp value={forecast.balance} currency={currency} />
                </div>
              </div>
            </div>

            {/* The forecast says how rough it is rather than implying precision. */}
            <p className="d9-muted" style={{ fontSize: '0.9rem' }}>
              Drawn as a straight line through your last {forecast.monthsUsed} months, so treat it as a direction
              rather than a number. It is <strong>{forecast.reliability}</strong> - the line usually sits about{' '}
              {money(forecast.margin, currency)} away from what actually happened.{' '}
              {forecast.trendPerMonth > 0
                ? `Spending has been climbing by about ${money(forecast.trendPerMonth, currency)} a month.`
                : forecast.trendPerMonth < 0
                  ? `Spending has been falling by about ${money(Math.abs(forecast.trendPerMonth), currency)} a month.`
                  : 'Spending has been steady.'}
            </p>
          </div>
        )}
      </section>

      {/* --- Every figure above, as a table --------------------------------- */}
      <section className="d9-card">
        <div className="d9-head">
          <h2>The numbers behind the charts</h2>
          <span className="d9-muted">Every figure above, as a table</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Category</th>
                <th className="right">Spent</th>
                <th className="right">Share</th>
                <th className="right">Transactions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((row) => (
                <tr key={row.categoryId}>
                  <td>{row.name}</td>
                  <td className="right num">{money(row.total, currency)}</td>
                  <td className="right num">{row.share}%</td>
                  <td className="right num">{row.count}</td>
                </tr>
              ))}
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="d9-muted">
                    Nothing spent this month.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <p className="d9-muted" style={{ textAlign: 'center' }}>
        Report for {user?.name}, generated {formatDate(new Date())}.
      </p>
    </Layout>
  );
}
