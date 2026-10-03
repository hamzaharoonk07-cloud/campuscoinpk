import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout.jsx';
import Icon from '../../components/Icon.jsx';
import { Modal } from '../../components/TransactionForm.jsx';
import Avatar from '../../components/Avatar.jsx';
import { api } from '../../lib/api.js';
import { formatDate, money } from '../../lib/format.js';
import { useToast } from '../../context/AppContext.jsx';
import { studyLabel } from '../../lib/study.jsx';

export default function AdminStudents() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [issued, setIssued] = useState(null);
  const [detail, setDetail] = useState(null); // the full response from GET /admin/users/:id
  const [detailBusy, setDetailBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get(`/admin/users${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      .then(({ users: list }) => setUsers(list))
      .catch((err) => toast.error('Could not load the students', err.message));
  }, [query, toast]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const toggle = async (user) => {
    try {
      const { message } = await api.patch(`/admin/users/${user._id}`, { disabled: !user.disabled });
      toast.success(message);
      load();
    } catch (err) {
      toast.error('Could not update the account', err.message);
    }
  };

  const makeAdmin = async (user) => {
    if (!window.confirm(`Make ${user.name} (${user.email}) an administrator? They'll get full admin access.`)) return;
    try {
      const { message } = await api.patch(`/admin/users/${user._id}/promote`, {});
      toast.success(message);
      load();
    } catch (err) {
      toast.error('Could not promote', err.message);
    }
  };

  const resetPassword = async (user) => {
    if (!window.confirm(`Issue a new temporary password for ${user.name}? Their current one stops working.`)) return;
    try {
      const data = await api.post(`/admin/users/${user._id}/reset-password`, {});
      setIssued({ user, ...data });
    } catch (err) {
      toast.error('Could not reset it', err.message);
    }
  };

  const view = async (user) => {
    setDetailBusy(true);
    try {
      const data = await api.get(`/admin/users/${user._id}`);
      setDetail(data);
    } catch (err) {
      toast.error('Could not load that account', err.message);
    } finally {
      setDetailBusy(false);
    }
  };

  const remove = async (user) => {
    const typed = window.prompt(
      `This permanently deletes ${user.name} and all ${user.transactionCount} of their transactions. Type DELETE to confirm.`
    );
    if (typed !== 'DELETE') return;
    try {
      const { message } = await api.del(`/admin/users/${user._id}`);
      toast.success(message);
      load();
    } catch (err) {
      toast.error('Could not delete the account', err.message);
    }
  };

  return (
    <Layout title="Student accounts">
      <section className="panel">
        <div className="panel-body">
          <div className="field">
            <label htmlFor="q">Search by name or email</label>
            <input id="q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{users.length} account{users.length === 1 ? '' : 's'}</h2>
        </div>
        <div className="panel-body table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Student</th>
                <th>Year</th>
                <th className="right">Transactions</th>
                <th>Last signed in</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td>
                    <span className="person">
                      <Avatar user={user} size={32} />
                      <strong>{user.name}</strong>
                    </span>
                    <div className="small muted">{user.email}</div>
                  </td>
                  <td>
                    {studyLabel(user.academicYear) || '--'}
                    {user.institution ? <div className="small muted">{user.institution}</div> : null}
                  </td>
                  <td className="right num">{user.transactionCount}</td>
                  <td>{user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}</td>
                  <td>
                    <span className={`pill is-${user.disabled ? 'bad' : 'good'}`}>
                      {user.disabled ? 'Disabled' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <div className="row">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => view(user)} disabled={detailBusy}>
                        <Icon name="eye" size={14} />
                        View
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggle(user)}>
                        {user.disabled ? 'Enable' : 'Disable'}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => makeAdmin(user)}>
                        Make admin
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => resetPassword(user)}>
                        <Icon name="key" size={14} />
                        Reset
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(user)}>
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No students match that search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {issued ? (
        <Modal title="Temporary password" onClose={() => setIssued(null)}>
          <div className="stack">
            <p>{issued.message}</p>
            <div
              className="panel num"
              style={{ padding: '1rem', textAlign: 'center', fontSize: 'var(--step-2)', fontWeight: 700, letterSpacing: '0.02em' }}
            >
              {issued.temporaryPassword}
            </div>
            <p className="small muted">
              Write it down now - reopening this page will not show it again, because only a hash of it is stored.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  navigator.clipboard?.writeText(issued.temporaryPassword);
                  toast.success('Copied');
                  setIssued(null);
                }}
              >
                Copy and close
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {detail ? (
        <Modal title={detail.user.name} onClose={() => setDetail(null)}>
          <div className="stack">
            <div className="field-row">
              <div className="field">
                <label>Email</label>
                <div>{detail.user.email}</div>
              </div>
              <div className="field">
                <label>Phone</label>
                <div>{detail.user.phone || '--'}</div>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Where they study</label>
                <div>{studyLabel(detail.user.academicYear) || '--'}{detail.user.institution ? ` · ${detail.user.institution}` : ''}</div>
              </div>
              <div className="field">
                <label>Security</label>
                <div>
                  {detail.user.twoFactorEnabled ? 'Two-step on' : 'Two-step off'}
                  {detail.user.googleId ? ' · Google-linked' : ''}
                </div>
              </div>
            </div>

            <div className="row row-wrap" style={{ gap: '0.5rem' }}>
              <span className="pill">{detail.totals.transactionCount} transactions</span>
              <span className="pill is-good">In: {money(detail.totals.income, detail.user.currency)}</span>
              <span className="pill is-bad">Out: {money(detail.totals.expense, detail.user.currency)}</span>
              <span className="pill">{detail.budgets.length} budgets</span>
              <span className="pill">{detail.udhaarOpen} open udhaar</span>
              <span className="pill">{detail.ownCategoryCount} own categories</span>
            </div>

            {detail.udhaarOpen ? (
              <p className="small muted">
                Owed to them: {money(detail.udhaarOwedToThem, detail.user.currency)} · They owe:{' '}
                {money(detail.udhaarTheyOwe, detail.user.currency)}
              </p>
            ) : null}

            <h3 style={{ margin: '0.5rem 0 0' }}>Recent transactions</h3>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th className="right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recentTransactions.map((t) => (
                    <tr key={t._id}>
                      <td>{formatDate(t.date)}</td>
                      <td>{t.category?.name || '--'}</td>
                      <td>{t.description || '--'}</td>
                      <td className={`right num ${t.type === 'income' ? 'is-good' : ''}`}>
                        {t.type === 'income' ? '+' : '-'}
                        {money(t.amount, detail.user.currency)}
                      </td>
                    </tr>
                  ))}
                  {detail.recentTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted">
                        No transactions yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      ) : null}
    </Layout>
  );
}
