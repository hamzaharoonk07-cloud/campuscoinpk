import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { api } from '../lib/api.js';
import { money } from '../lib/format.js';
import { useAuth, useToast } from '../context/AppContext.jsx';

/* ---------------------------------------------------------------------------
   One-phrase entry — "Say it. Saved. Done."

   The student types or speaks one line ("chai with friends 150",
   "rickshaw do sau", "ammi ne 2 hazaar diye"). The server reads out the
   amount, whether it is money in or out, a clean description and a suggested
   category. When both an amount and a category come back we save it straight
   away and offer Undo; otherwise we show the draft so the student can pick a
   category or fix the amount before saving.

   Voice uses the browser's own SpeechRecognition — no account, no upload —
   and is simply hidden where the browser does not provide it.
--------------------------------------------------------------------------- */

// The browser speech API, where it exists. Chrome and Edge on Android and
// desktop have it; Firefox does not, so the mic button is hidden there.
const SpeechRecognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const EXAMPLES = ['chai with friends 150', 'rickshaw do sau', 'allowance 5000', 'printing 60', 'biryani 350'];

export default function QuickPhrase({ categories = [], onSaved }) {
  const { currency } = useAuth();
  const toast = useToast();
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [draft, setDraft] = useState(null); // set only when it needs a confirm
  const [hint, setHint] = useState(EXAMPLES[0]);
  const [mode, setMode] = useState('phrase'); // 'phrase' | 'sms'
  const recognitionRef = useRef(null);

  // Rotate the example in the placeholder so students see what they can say.
  useEffect(() => {
    const id = setInterval(() => setHint((h) => EXAMPLES[(EXAMPLES.indexOf(h) + 1) % EXAMPLES.length]), 3200);
    return () => clearInterval(id);
  }, []);

  // Tear down any live recognition if the component goes away mid-listen.
  useEffect(() => () => recognitionRef.current?.abort?.(), []);

  const saveDraft = async (d, categoryId) => {
    const category = categoryId || d.category?._id;
    if (!category) {
      setDraft(d);
      return;
    }
    setBusy(true);
    try {
      const { transaction } = await api.post('/transactions', {
        categoryId: category,
        type: d.type,
        amount: d.amount,
        description: d.description,
        aiSuggestedCategory: d.category?._id || null,
        // An SMS carries the wallet it moved through; a phrase does not.
        method: d.method || undefined,
        source: d.source || 'phrase',
      });
      setDraft(null);
      setPhrase('');
      const name = transaction.category?.name || 'saved';
      toast.push(`Saved ${money(d.amount, currency)} · ${name}`, {
        tone: 'good',
        body: d.description,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.del(`/transactions/${transaction._id}`);
              toast.push('Removed', { tone: 'info' });
              onSaved?.();
            } catch (err) {
              toast.error('Could not undo', err.message);
            }
          },
        },
      });
      onSaved?.();
    } catch (err) {
      toast.error('Could not save that', err.message);
    } finally {
      setBusy(false);
    }
  };

  const parse = async (text) => {
    const value = (text ?? phrase).trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const { draft: d } = await api.post('/transactions/parse', { phrase: value });
      // Amount and a confident category → save at once. Otherwise let the
      // student finish it off.
      if (d.amount && d.category) await saveDraft({ ...d, source: 'phrase' });
      else setDraft({ ...d, source: 'phrase' });
    } catch (err) {
      // The server sends the draft back even when it could not find an amount,
      // so the box keeps the words and tells the student what is missing.
      toast.error('Add an amount', err.message);
    } finally {
      setBusy(false);
    }
  };

  // Reads a pasted bank / wallet SMS. The merchant drives the category and the
  // wallet is recorded, so a confident read saves straight away like a phrase.
  const parseSmsText = async () => {
    const value = phrase.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const { draft: d } = await api.post('/transactions/parse-sms', { text: value });
      if (d.amount && d.category) await saveDraft({ ...d, source: 'sms' });
      else setDraft({ ...d, source: 'sms' });
    } catch (err) {
      toast.error("Couldn't read that SMS", err.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = () => (mode === 'sms' ? parseSmsText() : parse());

  const switchMode = (next) => {
    setMode(next);
    setPhrase('');
    setDraft(null);
  };

  const listen = () => {
    if (!SpeechRecognition) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-PK';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const said = event.results[0][0].transcript;
      setPhrase(said);
      parse(said);
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === 'not-allowed') toast.error('Microphone blocked', 'Allow mic access to speak your expense');
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  // The category options for the confirm step, in the draft's own direction.
  const options = categories.filter((c) => c.type === (draft?.type || 'expense'));

  return (
    <section className="qp" aria-label="Quick add by phrase">
      {mode === 'sms' ? (
        <div className="qp-bar is-sms">
          <Icon name="chat" size={18} />
          <textarea
            className="qp-input qp-area"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="Paste a bank or wallet SMS — e.g. “Rs 1,500 spent on your HBL Debit Card at FOODPANDA…”"
            aria-label="Paste a bank SMS"
            rows={2}
            disabled={busy && !draft}
          />
          <button type="button" className="qp-go" onClick={parseSmsText} disabled={busy || !phrase.trim()}>
            {busy ? '…' : 'Read'}
          </button>
        </div>
      ) : (
        <div className="qp-bar">
          <Icon name="spark" size={18} />
          <input
            className="qp-input"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && parse()}
            placeholder={`Try "${hint}"`}
            aria-label="Say what you spent on"
            disabled={busy && !draft}
          />
          {SpeechRecognition ? (
            <button
              type="button"
              className={`qp-mic ${listening ? 'is-live' : ''}`}
              onClick={listen}
              aria-label={listening ? 'Stop listening' : 'Speak your expense'}
              title={listening ? 'Listening…' : 'Speak'}
            >
              <Icon name="mic" size={18} />
            </button>
          ) : null}
          <button type="button" className="qp-go" onClick={() => parse()} disabled={busy || !phrase.trim()}>
            {busy ? '…' : 'Add'}
          </button>
        </div>
      )}

      <div className="qp-modes">
        <button type="button" className={mode === 'phrase' ? 'is-on' : ''} onClick={() => switchMode('phrase')}>
          Say it
        </button>
        <button type="button" className={mode === 'sms' ? 'is-on' : ''} onClick={() => switchMode('sms')}>
          Paste bank SMS
        </button>
      </div>

      {draft ? (
        <div className="qp-draft">
          <div className="qp-draft-line">
            <strong className={draft.type === 'income' ? 'is-in' : 'is-out'}>
              {draft.type === 'income' ? '+' : '−'}
              {money(draft.amount || 0, currency)}
            </strong>
            <span>{draft.description || 'No description'}</span>
          </div>
          {draft.amount ? (
            <label className="qp-draft-cat">
              <span>Category</span>
              <select
                defaultValue={draft.category?._id || ''}
                onChange={(e) => e.target.value && saveDraft(draft, e.target.value)}
              >
                <option value="" disabled>
                  Choose a category…
                </option>
                {options.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="qp-draft-miss">Add an amount, like “{draft.description} 150”.</p>
          )}
          <button type="button" className="qp-draft-x" onClick={() => setDraft(null)} aria-label="Dismiss">
            <Icon name="x" size={16} />
          </button>
        </div>
      ) : null}
    </section>
  );
}
