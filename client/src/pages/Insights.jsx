import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout, { MonthPicker, openChat } from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import { artUrl, CategoryIcon, SproutArt } from '../components/Illustrations.jsx';
import PersonalityCard from '../components/PersonalityCard.jsx';
import ZakatCalculator from '../components/ZakatCalculator.jsx';
import { api } from '../lib/api.js';
import { compactMoney, formatDate, money, monthKey, monthLabel } from '../lib/format.js';
import { useAuth, useToast } from '../context/AppContext.jsx';

/* ---------------------------------------------------------------------------
   Monthly insights.

   The month told as a story first - the written summary and a score out of
   100 that shows its working - then the evidence: how each category compared
   with the student's own usual, which days of the week cost the most, the
   biggest purchase, the budgets, and one piece of advice to act on. Every
   figure comes from the server (services/insights.js monthDetails).
--------------------------------------------------------------------------- */

/** The score as a ring, drawn in SVG, with its word in the middle. */
function ScoreRing({ score, word }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const tone = score >= 80 ? 'is-great' : score >= 60 ? 'is-good' : score >= 40 ? 'is-fair' : 'is-low';
  return (
    <div className={`in-ring ${tone}`} role="img" aria-label={`Month score ${score} out of 100, ${word}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={r} className="in-ring-track" />
        <circle
          cx="60"
          cy="60"
          r={r}
          className="in-ring-fill"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          style={{ '--c': c }}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <span>
        <strong className="num">{score}</strong>
        <small>{word}</small>
      </span>
    </div>
  );
}

/** "+12%" / "-8%" against something, coloured by whether that is good. */
function Change({ pct, goodWhenDown = true }) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return <span className="in-change is-flat">new</span>;
  if (pct === 0) return <span className="in-change is-flat">same</span>;
  const good = goodWhenDown ? pct < 0 : pct > 0;
  return (
    <span className={`in-change ${good ? 'is-good' : 'is-bad'}`}>
      {pct > 0 ? '↑' : '↓'} {Math.abs(pct)}%
    </span>
  );
}

const pctChange = (now, before) => (before ? Math.round(((now - before) / Math.abs(before)) * 100) : null);

export default function Insights() {
  const { currency, user } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useState(monthKey());
  const [insight, setInsight] = useState(null);
  const [details, setDetails] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [shareTo, setShareTo] = useState('');

  const load = useCallback(() => {
    setInsight(null);
    setDetails(null);
    api
      .get(`/insights/${month}`)
      .then((data) => {
        setInsight(data.insight);
        setDetails(data.details);
        setAiEnabled(data.aiEnabled);
      })
      .catch((err) => toast.error('Could not load that month', err.message));
    api.get('/insights').then(({ insights }) => setHistory(insights)).catch(() => {});
  }, [month, toast]);

  useEffect(load, [load]);

  const regenerate = async () => {
    setBusy(true);
    try {
      const { insight: fresh } = await api.post(`/insights/${month}/generate`, {});
      setInsight(fresh);
      toast.success('Rebuilt from your current transactions');
    } catch (err) {
      toast.error('Could not rebuild it', err.message);
    } finally {
      setBusy(false);
    }
  };

  const bookmark = async () => {
    try {
      const { insight: updated } = await api.post(`/insights/${month}/bookmark`, {});
      setInsight(updated);
      toast.success(updated.bookmarked ? 'Saved to your bookmarks' : 'Removed from bookmarks');
    } catch (err) {
      toast.error('Could not save it', err.message);
    }
  };

  const share = async (event) => {
    event.preventDefault();
    try {
      const result = await api.post(`/insights/${month}/share`, { email: shareTo || user.email });
      if (result.sent) toast.success(result.message);
      else toast.push('Nothing was emailed', { body: result.message, tone: 'warn', ms: 9000 });
      setShareTo('');
    } catch (err) {
      toast.error('Could not send it', err.message);
    }
  };

  const layout = (children) => (
    <Layout
      title="Monthly insights"
      crumbs={
        <>
          <Link to="/dashboard">Dashboard</Link> / <span>Insights</span>
        </>
      }
      actions={<MonthPicker value={month} onChange={setMonth} />}
    >
      {children}
    </Layout>
  );

  if (!insight || !details) {
    return layout(
      <>
        <div className="in-top">
          <div className="skeleton" style={{ height: 260 }} />
          <div className="skeleton" style={{ height: 260 }} />
        </div>
        <div className="in-stats">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="skeleton" style={{ height: 120 }} />
          ))}
        </div>
      </>
    );
  }

  const { score, totals, previous, usualExpense, categories, weekdays, habits, biggest, budgets } = details;
  const empty = totals.transactionCount === 0;
  const topWeekday = Math.max(...weekdays.map((w) => w.average), 1);
  const topCategory = Math.max(...categories.map((c) => Math.max(c.amount, c.usual || 0)), 1);
  const held = budgets.filter((b) => b.state !== 'exceeded').length;

  return layout(
    <>
      {/* --- The story and the score ------------------------------------- */}
      <div className="in-top">
        <section className="in-story">
          <div className="in-story-head">
            <span className="in-badge">
              <Icon name="spark" size={13} />
              {insight.engine === 'llm' ? 'Written by Claude from your figures' : "Coin's read on your month"}
            </span>
            <span className="in-story-actions">
              <button type="button" onClick={bookmark} aria-pressed={insight.bookmarked}>
                <Icon name="pin" size={14} />
                {insight.bookmarked ? 'Saved' : 'Save'}
              </button>
              <button type="button" onClick={regenerate} disabled={busy}>
                <Icon name="repeat" size={14} />
                {busy ? 'Rebuilding' : 'Rebuild'}
              </button>
            </span>
          </div>
          <h2>{monthLabel(month)}</h2>
          <p className="in-story-text">{insight.summaryText}</p>
          <div className="in-story-foot">
            <button type="button" className="in-ask" onClick={() => openChat(`How did I do in ${monthLabel(month)}?`)}>
              <Icon name="chat" size={15} />
              Ask Coin about this month
            </button>
            <small>
              Generated {formatDate(insight.generatedAt)} · a prompt to look closer, not financial advice.
            </small>
          </div>
        </section>

        <section className="in-card in-score">
          <div className="in-head">
            <h3>Month score</h3>
            <span className="in-muted">out of 100</span>
          </div>
          <div className="in-score-body">
            <ScoreRing score={score.score} word={score.word} />
            <ul className="in-score-parts">
              {score.parts.map((p) => (
                <li key={p.label}>
                  <span className="in-score-row">
                    <strong>{p.label}</strong>
                    <span className="num">
                      {p.points}/{p.max}
                    </span>
                  </span>
                  <span className="in-bar">
                    <i style={{ width: `${(p.points / p.max) * 100}%` }} />
                  </span>
                  <small>{p.note}</small>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {empty ? (
        <section className="in-card in-empty">
          <SproutArt />
          <h3>Nothing logged for {monthLabel(month)}</h3>
          <p className="in-muted">Add a few transactions and this page fills in on its own - the score, your habits and what changed.</p>
          <Link to="/transactions" className="in-pill is-dark">
            Go to transactions
          </Link>
        </section>
      ) : (
        <>
          {/* --- Four facts ---------------------------------------------- */}
          <div className="in-stats">
            <div className="in-card in-stat">
              <img src={artUrl('money-bag')} alt="" width="36" height="36" />
              <span className="in-muted">{totals.balance < 0 ? 'Over income by' : 'Kept'}</span>
              <strong className={`num${totals.balance < 0 ? ' is-bad' : ''}`}>{money(Math.abs(totals.balance), currency)}</strong>
              <span className="in-stat-foot">
                <Change pct={pctChange(totals.balance, previous?.balance)} goodWhenDown={false} /> vs last month
              </span>
            </div>
            <div className="in-card in-stat">
              <img src={artUrl('money-with-wings')} alt="" width="36" height="36" />
              <span className="in-muted">Spent</span>
              <strong className="num">{money(totals.expense, currency)}</strong>
              <span className="in-stat-foot">
                {usualExpense ? (
                  <>
                    <Change pct={pctChange(totals.expense, usualExpense)} /> vs your usual {compactMoney(usualExpense, currency)}
                  </>
                ) : (
                  'Your first month on record'
                )}
              </span>
            </div>
            <div className="in-card in-stat">
              <img src={artUrl('spiral-calendar')} alt="" width="36" height="36" />
              <span className="in-muted">Days with spending</span>
              <strong className="num">
                {habits.activeDays}
                <small> / {habits.daysInMonth}</small>
              </strong>
              <span className="in-stat-foot">about {money(habits.perActiveDay, currency)} on each of those days</span>
            </div>
            <div className="in-card in-stat">
              {biggest?.category ? (
                <CategoryIcon icon={biggest.category.icon} slot={biggest.category.slot} size={36} text={biggest.description} />
              ) : (
                <img src={artUrl('receipt')} alt="" width="36" height="36" />
              )}
              <span className="in-muted">Biggest purchase</span>
              <strong className="num">{biggest ? money(biggest.amount, currency) : '—'}</strong>
              <span className="in-stat-foot">
                {biggest ? `${biggest.description} · ${formatDate(biggest.date, { day: 'numeric', month: 'short' })}` : 'No spending yet'}
              </span>
            </div>
          </div>

          {/* --- Categories against the usual, and the week ------------- */}
          <div className="in-mid">
            <section className="in-card">
              <div className="in-head">
                <h3>Compared with your usual month</h3>
                <span className="in-legend">
                  <i className="is-now" /> This month <i className="is-usual" /> Your usual
                </span>
              </div>
              <ul className="in-cats">
                {categories.map((c) => (
                  <li key={c.name}>
                    <CategoryIcon icon={c.icon} slot={c.slot} size={38} />
                    <span className="in-cat-main">
                      <span className="in-cat-top">
                        <strong>{c.name}</strong>
                        <span className="num">{money(c.amount, currency)}</span>
                        <Change pct={c.changePct} />
                      </span>
                      <span className="in-cat-track">
                        <i className="is-now" style={{ width: `${(c.amount / topCategory) * 100}%` }} />
                        {c.usual ? <b style={{ left: `${(c.usual / topCategory) * 100}%` }} title={`Usual ${money(c.usual, currency)}`} /> : null}
                      </span>
                      <small className="in-muted">
                        {c.count} purchase{c.count === 1 ? '' : 's'} · {c.share}% of spending
                        {c.usual ? ` · usually ${money(c.usual, currency)}` : ' · new this month'}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="in-side">
              <ZakatCalculator />

              <section className="in-card">
                <div className="in-head">
                  <h3>Your spending week</h3>
                  <span className="in-muted">Average per day</span>
                </div>
                <div className="in-week">
                  {weekdays.map((w) => (
                    <span key={w.name} className={`in-week-day${habits.topDay?.name === w.name ? ' is-top' : ''}`}>
                      <span className="in-week-bar" title={money(w.average, currency)}>
                        <i style={{ height: `${Math.max(3, (w.average / topWeekday) * 100)}%` }} />
                      </span>
                      <small>{w.name}</small>
                    </span>
                  ))}
                </div>
                <ul className="in-habits">
                  {habits.topDay ? (
                    <li>
                      <img src={artUrl('calendar')} alt="" width="22" height="22" />
                      <span>
                        <strong>{habits.topDay.full}s</strong> cost the most, about {money(habits.topDay.average, currency)} a time.
                      </span>
                    </li>
                  ) : null}
                  <li>
                    <img src={artUrl('party-popper')} alt="" width="22" height="22" />
                    <span>
                      <strong>{habits.weekendShare}%</strong> of your spending happened at weekends.
                    </span>
                  </li>
                  {habits.small.count ? (
                    <li>
                      <img src={artUrl('coin')} alt="" width="22" height="22" />
                      <span>
                        <strong>{habits.small.count} small purchases</strong> under {money(habits.small.under, currency)} added up to{' '}
                        {money(habits.small.total, currency)}.
                      </span>
                    </li>
                  ) : null}
                  {habits.cash.share !== null && habits.cash.share !== undefined ? (
                    <li>
                      <img src={artUrl('dollar-banknote')} alt="" width="22" height="22" />
                      <span>
                        <strong>{habits.cash.share}%</strong> of what you spent left as cash
                        {habits.cash.digital ? `, the rest (${money(habits.cash.digital, currency)}) from an account or card` : ''}.
                      </span>
                    </li>
                  ) : null}
                </ul>
              </section>

              <section className="in-card in-advice">
                <div className="in-head">
                  <h3>One thing to try</h3>
                  <img src={artUrl('light-bulb')} alt="" width="30" height="30" />
                </div>
                <p>{insight.tipText}</p>
                <Link to="/budgets" className="in-pill is-light">
                  Open budgets
                </Link>
              </section>

              <PersonalityCard details={details} month={monthLabel(month)} currency={currency} />
            </div>
          </div>

          {/* --- Budgets and earlier months ------------------------------- */}
          <div className="in-bottom">
            <section className="in-card">
              <div className="in-head">
                <h3>Budgets this month</h3>
                <span className="in-muted">{budgets.length ? `${held} of ${budgets.length} held` : 'None set'}</span>
              </div>
              {budgets.length ? (
                <ul className="in-budgets">
                  {budgets.map((b) => (
                    <li key={b.name} className={`is-${b.state}`}>
                      <CategoryIcon icon={b.icon} slot={b.slot} size={32} />
                      <span className="in-cat-main">
                        <span className="in-cat-top">
                          <strong>{b.name}</strong>
                          <span className="num">
                            {money(b.spent, currency)} <small>of {money(b.limit, currency)}</small>
                          </span>
                        </span>
                        <span className="in-bar">
                          <i style={{ width: `${Math.min(100, b.pct)}%` }} />
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="in-muted">
                  No budgets for this month. <Link to="/budgets">Set one</Link> on your biggest category.
                </p>
              )}
            </section>

            <section className="in-card">
              <div className="in-head">
                <h3>Earlier months</h3>
              </div>
              {history.length === 0 ? (
                <p className="in-muted">Each month you use Campus Coin adds one here.</p>
              ) : (
                <ul className="in-history">
                  {history.map((row) => {
                    const key = new Date(row.month).toISOString().slice(0, 7);
                    const bal = row.stats?.balance || 0;
                    return (
                      <li key={row._id}>
                        <button type="button" className={key === month ? 'is-on' : ''} onClick={() => setMonth(key)}>
                          <span>
                            <strong>
                              {monthLabel(key)} {row.bookmarked ? <Icon name="pin" size={12} /> : null}
                            </strong>
                            <small>{row.stats?.topCategory ? `Most on ${row.stats.topCategory}` : 'No spending'}</small>
                          </span>
                          <span className={`num${bal < 0 ? ' is-bad' : ' is-good'}`}>
                            {bal < 0 ? '−' : '+'}
                            {money(Math.abs(bal), currency)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="in-card">
              <div className="in-head">
                <h3>Send it to yourself</h3>
                <img src={artUrl('envelope')} alt="" width="28" height="28" />
              </div>
              <p className="in-muted">The summary, the advice and the month's figures, by email.</p>
              <form className="in-share" onSubmit={share}>
                <input
                  type="email"
                  placeholder={user?.email}
                  value={shareTo}
                  onChange={(e) => setShareTo(e.target.value)}
                  aria-label="Email address"
                />
                <button type="submit" className="in-pill is-dark">
                  <Icon name="send" size={14} />
                  Send
                </button>
              </form>
              {!aiEnabled ? (
                <p className="in-note">
                  Written by Campus Coin&rsquo;s own statistical engine. With an <code>ANTHROPIC_API_KEY</code> on the
                  server, Claude rewrites the same figures in warmer words.
                </p>
              ) : null}
            </section>
          </div>
        </>
      )}
    </>
  );
}
