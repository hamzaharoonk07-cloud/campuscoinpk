import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import ReceiptScanner from './ReceiptScanner.jsx';
import { api } from '../lib/api.js';
import { slotColor, todayInput } from '../lib/format.js';
import { METHODS, markFor } from '../lib/methods.js';
import { useAuth, useToast } from '../context/AppContext.jsx';

/**
 * The one form used for adding and editing. It carries the categorisation
 * assistant: as the description is typed it asks the server for a suggestion,
 * shows why it was suggested, and lets the student take it or ignore it. Which
 * of those happened is sent with the transaction, which is how the assistant
 * learns.
 */
export default function TransactionForm({ categories, existing, preset, onSaved, onCancel }) {
  const toast = useToast();
  const { currency } = useAuth();
  const [form, setForm] = useState(() => ({
    type: existing?.type || preset?.type || 'expense',
    amount: existing?.amount ?? '',
    description: existing?.description || preset?.description || '',
    note: existing?.note || '',
    // A preset can carry a date (the calendar adds on the day that was tapped).
    date: existing ? new Date(existing.date).toISOString().slice(0, 10) : preset?.date || todayInput(),
    categoryId: existing?.category?._id || existing?.category || '',
    // Most student spending is still notes, so cash is the resting choice.
    method: existing?.method || preset?.method || 'cash',
    methodLabel: existing?.methodLabel || '',
    recurringEnabled: existing?.recurring?.enabled || false,
    recurringFrequency: existing?.recurring?.frequency || 'monthly',
  }));
  const [suggestion, setSuggestion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Remembers which category the assistant proposed, so the server can be told
  // whether the student kept it.
  const proposed = useRef(null);
  // The receipt photo. undefined = leave a saved one as it is, a data URL =
  // attach this one, null = remove it.
  const [receipt, setReceipt] = useState(undefined);
  // After a scan the category is filled in from the suggestion automatically;
  // typed descriptions still wait for the student to tap it.
  const autoCategory = useRef(Boolean(preset));

  const options = useMemo(() => categories.filter((c) => c.type === form.type), [categories, form.type]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  // Ask for a suggestion a short moment after typing stops, never on every keystroke.
  useEffect(() => {
    const text = form.description.trim();
    if (existing || text.length < 3) {
      setSuggestion(null);
      return undefined;
    }
    const timer = setTimeout(() => {
      api
        .get(`/ai/suggest?q=${encodeURIComponent(text)}&type=${form.type}`)
        .then(({ suggestion: hint }) => {
          setSuggestion(hint);
          if (hint) proposed.current = hint.categoryId;
          if (hint && autoCategory.current) {
            autoCategory.current = false;
            setForm((current) => (current.categoryId ? current : { ...current, categoryId: hint.categoryId }));
          }
        })
        .catch(() => setSuggestion(null));
    }, 350);
    return () => clearTimeout(timer);
  }, [form.description, form.type, existing]);

  // What the scanner found goes into the form; anything it did not find is left
  // as the student had it.
  const fromReceipt = (found) => {
    autoCategory.current = true;
    setForm((current) => ({
      ...current,
      type: 'expense',
      categoryId: current.type === 'expense' ? current.categoryId : '',
      amount: found.amount ?? current.amount,
      description: found.merchant || current.description,
      date: found.date || current.date,
    }));
  };

  const applySuggestion = () => {
    if (suggestion) setForm((current) => ({ ...current, categoryId: suggestion.categoryId }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.categoryId) {
      setError('Choose a category');
      return;
    }
    setBusy(true);
    setError('');

    const payload = {
      type: form.type,
      amount: Number(form.amount),
      description: form.description.trim(),
      note: form.note.trim(),
      date: form.date,
      categoryId: form.categoryId,
      method: form.method,
      methodLabel: form.method === 'other' ? form.methodLabel.trim() : '',
      recurring: { enabled: form.recurringEnabled, frequency: form.recurringFrequency },
    };
    if (receipt !== undefined) payload.receipt = receipt;

    try {
      if (existing) {
        const { transaction } = await api.patch(`/transactions/${existing._id}`, payload);
        toast.success('Transaction updated');
        onSaved?.(transaction);
      } else {
        const data = await api.post('/transactions', { ...payload, aiSuggestedCategory: proposed.current });
        // An Undo right on the confirmation, not buried behind a delete
        // button on the ledger row - the save that most needs undoing is
        // the one still fresh in mind, a tap after Save.
        toast.push('Transaction added', {
          tone: 'good',
          action: {
            label: 'Undo',
            onClick: () => {
              api
                .del(`/transactions/${data.transaction._id}`)
                .then(() => {
                  toast.success('Removed');
                  onSaved?.(null);
                })
                .catch((err) => toast.error('Could not undo that', err.message));
            },
          },
        });
        // Unusual-amount and duplicate warnings are raised here, not buried.
        data.warnings?.forEach((warning) => toast.push('Worth a look', { body: warning, tone: 'warn', ms: 8000 }));
        data.alerts?.forEach((alert) => toast.push(alert.title, { body: alert.body, tone: 'bad', ms: 8000 }));
        onSaved?.(data.transaction);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack" onSubmit={submit}>
      {error ? <div className="form-error">{error}</div> : null}

      <div className="seg" role="group" aria-label="Transaction type">
        <button
          type="button"
          aria-pressed={form.type === 'expense'}
          onClick={() => setForm({ ...form, type: 'expense', categoryId: '' })}
        >
          Money out
        </button>
        <button
          type="button"
          aria-pressed={form.type === 'income'}
          onClick={() => setForm({ ...form, type: 'income', categoryId: '' })}
        >
          Money in
        </button>
      </div>

      {form.type === 'expense' || existing?.hasReceipt ? (
        <ReceiptScanner
          photo={receipt}
          onPhoto={setReceipt}
          onRead={fromReceipt}
          currency={currency}
          savedId={existing?._id}
          hasSaved={Boolean(existing?.hasReceipt) && receipt === undefined}
        />
      ) : null}

      <div className="field-row">
        <div className="field">
          <label htmlFor="amount">Amount</label>
          <input
            id="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={form.amount}
            onChange={set('amount')}
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="date">Date</label>
          <input id="date" type="date" required value={form.date} onChange={set('date')} max={todayInput()} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="description">What was it?</label>
        <input
          id="description"
          placeholder="Canteen lunch, rickshaw to campus, Spotify..."
          value={form.description}
          onChange={set('description')}
        />
      </div>

      {suggestion && suggestion.categoryId !== form.categoryId ? (
        <button type="button" className="panel" style={{ padding: '0.7rem 0.85rem', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--line-strong)' }} onClick={applySuggestion}>
          <div className="row">
            <Icon name="spark" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>
                Looks like <span style={{ color: slotColor(suggestion.slot) }}>{suggestion.name}</span>
              </div>
              <div className="small muted">
                {Math.round(suggestion.confidence * 100)}% sure, based on {suggestion.reason}. Tap to use it.
              </div>
            </div>
          </div>
        </button>
      ) : null}

      <div className="field">
        <label htmlFor="category">Category</label>
        <select id="category" required value={form.categoryId} onChange={set('categoryId')}>
          <option value="">Choose one</option>
          {options.map((category) => (
            <option key={category._id} value={category._id}>
              {category.name}
              {category.isDefault ? '' : ' (yours)'}
            </option>
          ))}
        </select>
      </div>

      {/* Cash or a wallet. Radios rather than a select, because this is the one
          field worth answering without opening anything. */}
      <fieldset className="field method-field">
        <legend>{form.type === 'income' ? 'Received in' : 'Paid with'}</legend>
        <div className="method-pills">
          {METHODS.map((m) => (
            <label key={m.id} className="method-pill" data-on={form.method === m.id || undefined}>
              <input
                type="radio"
                name="method"
                value={m.id}
                checked={form.method === m.id}
                onChange={set('method')}
              />
              <span className="method-mark" style={{ background: `#${markFor(m.id, form.methodLabel).hex}`, color: markFor(m.id, form.methodLabel).ink }}>
                {markFor(m.id, form.methodLabel).letter}
              </span>
              {m.id === 'other' && form.methodLabel.trim() ? form.methodLabel.trim() : m.short}
            </label>
          ))}
        </div>

        {/* A wallet Campus Coin has not heard of still gets to be itself: the
            name drives the logo through the same brand table the rows use. */}
        {form.method === 'other' ? (
          <div className="method-other">
            <label htmlFor="methodLabel">Which one?</label>
            <input
              id="methodLabel"
              value={form.methodLabel}
              onChange={set('methodLabel')}
              placeholder="UBL Omni, Keenu, a friend..."
              maxLength={40}
              autoComplete="off"
            />
          </div>
        ) : null}
      </fieldset>

      <div className="field">
        <label htmlFor="note">Note (optional)</label>
        <textarea id="note" rows={2} value={form.note} onChange={set('note')} />
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={form.recurringEnabled}
          onChange={(e) => setForm({ ...form, recurringEnabled: e.target.checked })}
        />
        This repeats
      </label>

      {form.recurringEnabled ? (
        <div className="field">
          <label htmlFor="frequency">How often</label>
          <select id="frequency" value={form.recurringFrequency} onChange={set('recurringFrequency')}>
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
            <option value="yearly">Every year</option>
          </select>
          <span className="small muted">Campus Coin will add it for you from the next one onwards.</span>
        </div>
      ) : null}

      <div className="modal-actions">
        {onCancel ? (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <span className="spinner" /> : null}
          {existing ? 'Save changes' : 'Add transaction'}
        </button>
      </div>
    </form>
  );
}

/** A plain modal wrapper - closes on Escape and on a click outside the panel. */
export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
