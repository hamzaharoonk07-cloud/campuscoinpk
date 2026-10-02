import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import { api } from '../lib/api.js';
import { money } from '../lib/format.js';
import { formatDate } from '../lib/format.js';
import { useAuth, useToast } from '../context/AppContext.jsx';

/* ---------------------------------------------------------------------------
   Udhaar — who owes whom.

   The small loans between friends, tracked apart from spending. Two totals at
   the top (owed to you, you owe), then a card per person with their running
   net and every open entry. A WhatsApp button drafts a polite reminder to
   whoever owes you - it opens WhatsApp with the message ready; the student
   sends it themselves.
--------------------------------------------------------------------------- */

// Builds the wa.me link that opens WhatsApp with a reminder ready to send.
function whatsappReminder(person, phone, amount, currency) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  const text = `Assalam o alaikum ${person}, chhoti si yaad dahani: Rs ${Math.round(amount)} udhaar baaki hai. Jab aasani ho bhej dena, shukriya. (Campus Coin)`;
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}

function AddForm({ onAdded }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState('owed_to_me');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await api.post('/udhaar', { person, amount: Number(amount), direction, phone, note });
      setPerson('');
      setAmount('');
      setPhone('');
      setNote('');
      setOpen(false);
      toast.success('Udhaar noted');
      onAdded();
    } catch (err) {
      toast.error('Could not save that', err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="udhaar-add-btn" onClick={() => setOpen(true)}>
        <Icon name="plus" size={18} />
        Add an udhaar
      </button>
    );
  }

  return (
    <form className="udhaar-form" onSubmit={submit}>
      <div className="udhaar-dir" role="group" aria-label="Who owes whom">
        <button type="button" className={direction === 'owed_to_me' ? 'is-on' : ''} onClick={() => setDirection('owed_to_me')}>
          They owe me
        </button>
        <button type="button" className={direction === 'i_owe' ? 'is-on' : ''} onClick={() => setDirection('i_owe')}>
          I owe them
        </button>
      </div>
      <div className="udhaar-fields">
        <input placeholder="Name" value={person} onChange={(e) => setPerson(e.target.value)} required maxLength={60} />
        <input
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
        <input placeholder="What for? (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      </div>
      <div className="udhaar-form-actions">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save udhaar'}
        </button>
      </div>
    </form>
  );
}

/**
 * Chai Split — one bill, divided among whoever was at the table. Adding a
 * name row for each friend (not just a headcount) means each one gets their
 * own udhaar entry and their own WhatsApp reminder, same as adding them by
 * hand would, just all at once.
 */
function SplitForm({ onAdded, currency }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState('');
  const [note, setNote] = useState('');
  const [friends, setFriends] = useState([{ name: '', phone: '' }]);
  const [busy, setBusy] = useState(false);

  const updateFriend = (i, field, value) =>
    setFriends((list) => list.map((f, idx) => (idx === i ? { ...f, [field]: value } : f)));
  const addFriend = () => setFriends((list) => [...list, { name: '', phone: '' }]);
  const removeFriend = (i) => setFriends((list) => list.filter((_, idx) => idx !== i));

  const diners = friends.filter((f) => f.name.trim()).length + 1;
  const share = Number(total) > 0 ? Math.round((Number(total) / diners) * 100) / 100 : 0;

  const reset = () => {
    setTotal('');
    setNote('');
    setFriends([{ name: '', phone: '' }]);
    setOpen(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await api.post('/udhaar/split', {
        totalAmount: Number(total),
        note,
        people: friends.filter((f) => f.name.trim()),
      });
      toast.success(`Split, ${diners} ways`, `${friends.filter((f) => f.name.trim()).length} friend(s) each owe their share`);
      reset();
      onAdded();
    } catch (err) {
      toast.error('Could not split that bill', err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="udhaar-add-btn is-split" onClick={() => setOpen(true)}>
        <Icon name="user" size={18} />
        Chai Split
      </button>
    );
  }

  return (
    <form className="udhaar-form" onSubmit={submit}>
      <div className="udhaar-fields">
        <input
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          placeholder="Bill total"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          required
        />
        <input placeholder="What was it? (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      </div>
      <div className="udhaar-split-friends">
        {friends.map((f, i) => (
          <div className="udhaar-split-row" key={i}>
            <input placeholder={`Friend ${i + 1} name`} value={f.name} onChange={(e) => updateFriend(i, 'name', e.target.value)} maxLength={60} />
            <input placeholder="Phone (optional)" value={f.phone} onChange={(e) => updateFriend(i, 'phone', e.target.value)} maxLength={20} />
            {friends.length > 1 ? (
              <button type="button" className="udhaar-mini is-danger" onClick={() => removeFriend(i)} aria-label="Remove friend">
                <Icon name="x" size={14} />
              </button>
            ) : null}
          </div>
        ))}
        <button type="button" className="udhaar-split-add" onClick={addFriend}>
          <Icon name="plus" size={14} /> Add another friend
        </button>
      </div>
      {share ? (
        <p className="udhaar-split-share">
          {diners} people &middot; {money(share, currency)} each
        </p>
      ) : null}
      <div className="udhaar-form-actions">
        <button type="button" className="btn btn-ghost" onClick={reset}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Splitting…' : 'Split the bill'}
        </button>
      </div>
    </form>
  );
}

function PersonCard({ group, currency, onChange }) {
  const toast = useToast();
  const theyOweMe = group.net > 0;

  const settle = async (entry) => {
    try {
      await api.patch(`/udhaar/${entry._id}/settle`);
      onChange();
    } catch (err) {
      toast.error('Could not settle that', err.message);
    }
  };
  const remove = async (entry) => {
    try {
      await api.del(`/udhaar/${entry._id}`);
      onChange();
    } catch (err) {
      toast.error('Could not remove that', err.message);
    }
  };

  return (
    <article className="udhaar-person">
      <header>
        <div>
          <strong>{group.person}</strong>
          <span className={theyOweMe ? 'is-in' : 'is-out'}>
            {theyOweMe ? 'owes you' : 'you owe'} {money(Math.abs(group.net), currency)}
          </span>
        </div>
        {theyOweMe ? (
          <a
            className="udhaar-remind"
            href={whatsappReminder(group.person, group.phone, Math.abs(group.net), currency)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="send" size={15} />
            Remind
          </a>
        ) : null}
      </header>
      <ul className="udhaar-entries">
        {group.entries.map((entry) => (
          <li key={entry._id}>
            <span className={entry.direction === 'owed_to_me' ? 'dot is-in' : 'dot is-out'} />
            <span className="udhaar-entry-amt">{money(entry.amount, currency)}</span>
            <span className="udhaar-entry-note">{entry.note || (entry.direction === 'owed_to_me' ? 'lent' : 'borrowed')}</span>
            <span className="udhaar-entry-date">{formatDate(entry.date)}</span>
            <button type="button" className="udhaar-mini" onClick={() => settle(entry)} title="Mark settled">
              <Icon name="check" size={15} />
            </button>
            <button type="button" className="udhaar-mini is-danger" onClick={() => remove(entry)} title="Remove">
              <Icon name="trash" size={15} />
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function Udhaar() {
  const { currency } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    api
      .get('/udhaar')
      .then(setData)
      .catch((err) => toast.error('Could not load your udhaar', err.message));
  }, [toast]);

  useEffect(load, [load]);

  const title = 'Udhaar';

  return (
    <Layout title={title}>
      <div className="udhaar-top">
        <div className="udhaar-tile is-in">
          <span>Owed to you</span>
          <strong>{money(data?.summary.owedToMe || 0, currency)}</strong>
        </div>
        <div className="udhaar-tile is-out">
          <span>You owe</span>
          <strong>{money(data?.summary.iOwe || 0, currency)}</strong>
        </div>
        <div className="udhaar-tile">
          <span>Net</span>
          <strong className={(data?.summary.net || 0) >= 0 ? 'is-in' : 'is-out'}>
            {(data?.summary.net || 0) >= 0 ? '+' : '−'}
            {money(Math.abs(data?.summary.net || 0), currency)}
          </strong>
        </div>
      </div>

      <div className="udhaar-actions-row">
        <AddForm onAdded={load} />
        <SplitForm onAdded={load} currency={currency} />
      </div>

      {!data ? (
        <div className="skeleton" style={{ height: 120, marginTop: '1rem' }} />
      ) : data.people.length ? (
        <div className="udhaar-list">
          {data.people.map((group) => (
            <PersonCard key={group.person} group={group} currency={currency} onChange={load} />
          ))}
        </div>
      ) : (
        <div className="udhaar-empty">
          <Icon name="user" size={28} />
          <p>No open udhaar. When you lend for chai or split a bill, note it here so nobody forgets.</p>
        </div>
      )}
    </Layout>
  );
}
