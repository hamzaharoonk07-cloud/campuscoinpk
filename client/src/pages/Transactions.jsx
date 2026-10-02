import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import TransactionForm, { Modal } from '../components/TransactionForm.jsx';
import { CategoryIcon, WalletArt } from '../components/Illustrations.jsx';
import ImportWizard from '../components/ImportWizard.jsx';
import { api } from '../lib/api.js';
import { dayHeading, formatDate, money, slotColor } from '../lib/format.js';
import { markFor, METHODS } from '../lib/methods.js';
import { useAuth, useToast } from '../context/AppContext.jsx';

const EMPTY_FILTERS = { q: '', type: '', category: '', method: '', from: '', to: '', flagged: '' };

export default function Transactions() {
  const { currency } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  // The rail's search arrives as ?q=, the dashboard's Flagged button as ?flagged=1.
  const [filters, setFilters] = useState(() => ({ ...EMPTY_FILTERS, q: params.get('q') || '', flagged: params.get('flagged') || '', from: params.get('from') || '', to: params.get('to') || '', method: params.get('method') || '' }));
  const [page, setPage] = useState(1);
  // On a phone only the search shows until the student opens the other filters.
  const [moreFilters, setMoreFilters] = useState(false);
  const [result, setResult] = useState(null);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    const query = new URLSearchParams({ page: String(page), limit: '25' });
    Object.entries(filters).forEach(([key, value]) => value && query.set(key, value));
    api
      .get(`/transactions?${query}`)
      .then(setResult)
      .catch((err) => toast.error('Could not load your transactions', err.message));
  }, [filters, page, toast]);

  useEffect(load, [load]);

  useEffect(() => {
    api.get('/categories').then(({ categories: list }) => setCategories(list)).catch(() => {});
  }, []);

  const setFilter = (key) => (event) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: event.target.value }));
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete "${row.description || row.category?.name}"? This cannot be undone.`)) return;
    try {
      const { message } = await api.del(`/transactions/${row._id}`);
      toast.success(message);
      load();
    } catch (err) {
      toast.error('Could not delete it', err.message);
    }
  };

  const exportCsv = async () => {
    try {
      const csv = await api.text('/transactions/export');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'campus-coin-transactions.csv';
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Your transactions have been downloaded');
    } catch (err) {
      toast.error('Could not prepare the download', err.message);
    }
  };

  const active = Object.values(filters).some(Boolean);

  // Transactions are grouped under the day they happened, the way a bank
  // statement reads, so the eye can find "last Tuesday" without hunting.
  const grouped = [];
  for (const row of result?.transactions || []) {
    const key = new Date(row.date).toISOString().slice(0, 10);
    const last = grouped[grouped.length - 1];
    if (last && last.key === key) last.rows.push(row);
    else grouped.push({ key, rows: [row] });
  }

  return (
    <Layout
      title="Transactions"
      crumbs={
        <>
          <Link to="/dashboard">Dashboard</Link> / <span>Transactions</span>
        </>
      }
      actions={
        <>
          <button type="button" className="btn btn-sm" onClick={() => setImporting(true)}>
            <Icon name="upload" size={15} />
            Import
          </button>
          <button type="button" className="btn btn-sm" onClick={exportCsv}>
            <Icon name="download" size={15} />
            Export
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <Icon name="plus" />
            Add
          </button>
        </>
      }
    >
      <section className={`panel tx-filters${moreFilters ? ' is-open' : ''}`}>
        <div className="panel-body">
          <div className="field-row">
            <div className="field">
              <label htmlFor="q">Search</label>
              <input id="q" type="search" placeholder="canteen, rickshaw..." value={filters.q} onChange={setFilter('q')} />
            </div>
            <div className="field">
              <label htmlFor="type">Direction</label>
              <select id="type" value={filters.type} onChange={setFilter('type')}>
                <option value="">In and out</option>
                <option value="expense">Money out</option>
                <option value="income">Money in</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="cat">Category</label>
              <select id="cat" value={filters.category} onChange={setFilter('category')}>
                <option value="">Any category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="method">Paid with</label>
              <select id="method" value={filters.method} onChange={setFilter('method')}>
                <option value="">Any way</option>
                <option value="cash">Cash</option>
                <option value="digital">Any account (not cash)</option>
                {METHODS.filter((m) => m.id !== 'cash').map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="from">From</label>
              <input id="from" type="date" value={filters.from} onChange={setFilter('from')} />
            </div>
            <div className="field">
              <label htmlFor="to">To</label>
              <input id="to" type="date" value={filters.to} onChange={setFilter('to')} />
            </div>
          </div>

          <button type="button" className="btn btn-sm tx-filter-toggle" onClick={() => setMoreFilters((was) => !was)} aria-expanded={moreFilters}>
            <Icon name="filter" size={14} />
            {moreFilters ? 'Fewer filters' : 'More filters'}
            {!moreFilters && ['type', 'category', 'method', 'from', 'to', 'flagged'].some((k) => filters[k]) ? <span className="tx-filter-dot" /> : null}
          </button>

          <div className="row row-wrap" style={{ marginTop: '0.85rem' }}>
            <label className="check">
              <input
                type="checkbox"
                checked={filters.flagged === '1'}
                onChange={(e) => {
                  setPage(1);
                  setFilters((c) => ({ ...c, flagged: e.target.checked ? '1' : '' }));
                }}
              />
              Only ones Campus Coin flagged
            </label>
            {active ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm push"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{result ? `${result.total} transaction${result.total === 1 ? '' : 's'}` : 'Loading'}</h2>
          {result?.pages > 1 ? (
            <span className="panel-note">
              Page {result.page} of {result.pages}
            </span>
          ) : null}
        </div>
        <div className="panel-body">
          {!result ? (
            <div className="skeleton" style={{ height: 240 }} />
          ) : result.transactions.length === 0 ? (
            <div className="empty">
              <WalletArt />
              <h3>{active ? 'Nothing matches those filters' : 'No transactions yet'}</h3>
              <p>
                {active
                  ? 'Try widening the date range or clearing the search.'
                  : 'Add your first one, or import a CSV if you have been tracking elsewhere.'}
              </p>
            </div>
          ) : (
            <div className="ledger">
              {grouped.map((group) => (
                <div key={group.key}>
                  <div className="ledger-day">
                    <span>{dayHeading(group.key)}</span>
                    <span className="num">
                      {money(
                        group.rows.reduce((acc, r) => acc + (r.type === 'income' ? r.amount : -r.amount), 0),
                        currency,
                        { sign: true }
                      )}
                    </span>
                  </div>
                  {group.rows.map((row) => (
                    <div
                      className="ledger-row"
                      key={row._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setEditing(row)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setEditing(row);
                        }
                      }}
                    >
                      <CategoryIcon icon={row.category?.icon} slot={row.category?.slot} size={42} text={row.description} />
                      <span className="ledger-main">
                        <span className="ledger-title">{row.description || row.category?.name}</span>
                        <span className="ledger-sub">
                          {row.category?.name}
                          {/* Which account it moved through, or cash. Every row says
                              so, because "cash" is as much an answer as "Easypaisa". */}
                          <span className="ledger-method">
                            <i
                              className="ledger-method-mark"
                              style={{
                                background: `#${markFor(row.method, row.methodLabel).hex}`,
                                color: markFor(row.method, row.methodLabel).ink,
                              }}
                              aria-hidden="true"
                            >
                              {markFor(row.method, row.methodLabel).letter}
                            </i>
                            {markFor(row.method, row.methodLabel).name}
                          </span>
                          {row.recurring?.enabled ? (
                            <span className="pill">
                              <Icon name="repeat" size={11} /> repeats
                            </span>
                          ) : null}
                          {row.source === 'csv' ? <span className="pill">imported</span> : null}
                          {row.hasReceipt ? (
                            <span className="pill is-accent">
                              <Icon name="receipt" size={11} /> receipt
                            </span>
                          ) : null}
                          {row.flags?.includes('duplicate') ? <span className="pill is-warn">possible duplicate</span> : null}
                          {row.flags?.includes('large') ? <span className="pill is-warn">unusually large</span> : null}
                          {row.flags?.includes('cash-no-source') ? (
                            <span className="pill is-warn" title="No cash income logged this month - normal for an ATM withdrawal, worth a look otherwise">
                              no cash logged in
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className={`ledger-amount num${row.type === 'income' ? ' is-in' : ''}`}>
                        {row.type === 'income' ? '+' : '−'}
                        {money(row.amount, currency).replace('−', '')}
                      </span>
                      <button
                        type="button"
                        className="ledger-del"
                        title="Delete this transaction"
                        aria-label="Delete this transaction"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(row);
                        }}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {result?.pages > 1 ? (
            <div className="row" style={{ justifyContent: 'center', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <Icon name="left" size={15} />
                Newer
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={page >= result.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Older
                <Icon name="right" size={15} />
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {adding ? (
        <Modal title="Add a transaction" onClose={() => setAdding(false)}>
          <TransactionForm
            categories={categories}
            onSaved={() => {
              setAdding(false);
              load();
            }}
            onCancel={() => setAdding(false)}
          />
        </Modal>
      ) : null}

      {editing ? (
        <Modal title="Edit transaction" onClose={() => setEditing(null)}>
          <div className="stack">
            <p className="small muted">
              Added {formatDate(editing.createdAt)}
              {editing.recurringParent ? ' by a repeating rule' : ''}.
            </p>
            <TransactionForm
              categories={categories}
              existing={editing}
              onSaved={() => {
                setEditing(null);
                load();
              }}
              onCancel={() => setEditing(null)}
            />
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => {
                const row = editing;
                setEditing(null);
                remove(row);
              }}
            >
              <Icon name="trash" size={15} />
              Delete this transaction
            </button>
          </div>
        </Modal>
      ) : null}

      {importing ? (
        <ImportWizard
          categories={categories}
          onClose={() => setImporting(false)}
          onDone={() => {
            setImporting(false);
            load();
          }}
        />
      ) : null}
    </Layout>
  );
}
