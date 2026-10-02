import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import { api } from '../lib/api.js';
import { money } from '../lib/format.js';
import { useAuth, useToast } from '../context/AppContext.jsx';

/* ---------------------------------------------------------------------------
   Committee (kameti/BC) - a fixed group, a fixed amount each round, one
   member takes the whole pot per round in order until everyone has had a
   turn. Payout order is just the members list's own order.
--------------------------------------------------------------------------- */

function CreateForm({ onAdded }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [members, setMembers] = useState([{ name: '', phone: '' }, { name: '', phone: '' }]);
  const [busy, setBusy] = useState(false);

  const updateMember = (i, field, value) => setMembers((list) => list.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));
  const addMember = () => setMembers((list) => [...list, { name: '', phone: '' }]);
  const removeMember = (i) => setMembers((list) => list.filter((_, idx) => idx !== i));

  const reset = () => {
    setName('');
    setAmount('');
    setFrequency('monthly');
    setMembers([{ name: '', phone: '' }, { name: '', phone: '' }]);
    setOpen(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await api.post('/committees', { name, amountPerMember: Number(amount), frequency, members });
      toast.success('Committee started');
      reset();
      onAdded();
    } catch (err) {
      toast.error('Could not start that committee', err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="udhaar-add-btn" onClick={() => setOpen(true)}>
        <Icon name="repeat" size={18} />
        Start a committee
      </button>
    );
  }

  return (
    <form className="udhaar-form" onSubmit={submit}>
      <div className="udhaar-fields">
        <input placeholder="Committee name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
        <input
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          placeholder="Amount per member, per round"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>
      <div className="udhaar-dir" role="group" aria-label="How often">
        <button type="button" className={frequency === 'monthly' ? 'is-on' : ''} onClick={() => setFrequency('monthly')}>
          Monthly
        </button>
        <button type="button" className={frequency === 'weekly' ? 'is-on' : ''} onClick={() => setFrequency('weekly')}>
          Weekly
        </button>
      </div>
      <div className="udhaar-split-friends">
        {members.map((m, i) => (
          <div className="udhaar-split-row" key={i}>
            <input placeholder={`Member ${i + 1} name`} value={m.name} onChange={(e) => updateMember(i, 'name', e.target.value)} maxLength={60} />
            <input placeholder="Phone (optional)" value={m.phone} onChange={(e) => updateMember(i, 'phone', e.target.value)} maxLength={20} />
            {members.length > 2 ? (
              <button type="button" className="udhaar-mini is-danger" onClick={() => removeMember(i)} aria-label="Remove member">
                <Icon name="x" size={14} />
              </button>
            ) : null}
          </div>
        ))}
        <button type="button" className="udhaar-split-add" onClick={addMember}>
          <Icon name="plus" size={14} /> Add another member
        </button>
      </div>
      <p className="udhaar-split-share">Payout order is the order above - first name, first round.</p>
      <div className="udhaar-form-actions">
        <button type="button" className="btn btn-ghost" onClick={reset}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Starting…' : 'Start committee'}
        </button>
      </div>
    </form>
  );
}

function CommitteeCard({ committee, currency, onChange }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const togglePaid = async (memberName) => {
    try {
      await api.patch(`/committees/${committee._id}/paid`, { memberName });
      onChange();
    } catch (err) {
      toast.error('Could not update that', err.message);
    }
  };

  const advance = async () => {
    setBusy(true);
    try {
      await api.post(`/committees/${committee._id}/advance`);
      toast.success(committee.receiver ? `Round closed - ${committee.receiver} was paid` : 'Round closed');
      onChange();
    } catch (err) {
      toast.error('Could not close the round', err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove "${committee.name}"? This cannot be undone.`)) return;
    try {
      await api.del(`/committees/${committee._id}`);
      toast.success('Committee removed');
      onChange();
    } catch (err) {
      toast.error('Could not remove that', err.message);
    }
  };

  return (
    <article className="udhaar-person committee-card">
      <header>
        <div>
          <strong>{committee.name}</strong>
          <span className="is-in">
            {committee.done ? 'All rounds complete' : `Round ${committee.currentRound} of ${committee.members.length}`}
          </span>
        </div>
        <button type="button" className="udhaar-mini is-danger" onClick={remove} title="Remove committee">
          <Icon name="trash" size={15} />
        </button>
      </header>

      {!committee.done ? (
        <>
          <p className="committee-receiver">
            <Icon name="award" size={15} />
            {committee.receiver} receives {money(committee.total, currency)} this round
          </p>
          <ul className="committee-members">
            {committee.members.map((m) => {
              const paid = committee.paidThisRound.includes(m.name);
              return (
                <li key={m.name} className={m.name === committee.receiver ? 'is-receiver' : ''}>
                  <button type="button" className={`committee-check${paid ? ' is-paid' : ''}`} onClick={() => togglePaid(m.name)}>
                    {paid ? <Icon name="check" size={14} /> : null}
                  </button>
                  <span>{m.name}</span>
                  <span className="committee-paid-note">{paid ? 'paid' : 'not yet'}</span>
                </li>
              );
            })}
          </ul>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem' }}>
            <span className="small muted">
              {money(committee.collected, currency)} of {money(committee.total, currency)} collected
            </span>
            <button type="button" className="btn btn-sm btn-primary" onClick={advance} disabled={busy}>
              {busy ? 'Closing…' : 'Close this round'}
            </button>
          </div>
        </>
      ) : (
        <p className="committee-done">Every member has had their round. Start a new committee to go again.</p>
      )}

      {committee.history?.length ? (
        <details className="committee-history">
          <summary>Past rounds ({committee.history.length})</summary>
          <ul>
            {committee.history.map((h) => (
              <li key={h.round}>
                Round {h.round}: {h.receiver} received {money(h.total, currency)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}

export default function Committees() {
  const { currency } = useAuth();
  const toast = useToast();
  const [committees, setCommittees] = useState(null);

  const load = useCallback(() => {
    api
      .get('/committees')
      .then((d) => setCommittees(d.committees))
      .catch((err) => toast.error('Could not load your committees', err.message));
  }, [toast]);

  useEffect(load, [load]);

  return (
    <Layout title="Committees">
      <p className="security-note" style={{ marginBottom: '1rem' }}>
        <Icon name="repeat" size={16} />
        What this is: a committee (kameti/BC) is a group of friends who each put in the same
        amount every round. One member takes the whole pot each round, in turn, until everyone
        has had theirs once. Add everyone below in the order they'll be paid - member 1 gets
        round 1, member 2 gets round 2, and so on. Tick a name off once they've paid their
        share, then "Close this round" to hand the pot to that round's member and move to the next.
      </p>
      <CreateForm onAdded={load} />

      {!committees ? (
        <div className="skeleton" style={{ height: 120, marginTop: '1rem' }} />
      ) : committees.length ? (
        <div className="udhaar-list">
          {committees.map((c) => (
            <CommitteeCard key={c._id} committee={c} currency={currency} onChange={load} />
          ))}
        </div>
      ) : (
        <div className="udhaar-empty">
          <Icon name="repeat" size={28} />
          <p>No committees yet. Start one when you and a group of friends put in a fixed amount each round.</p>
        </div>
      )}
    </Layout>
  );
}
