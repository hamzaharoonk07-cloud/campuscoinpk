import { useState } from 'react';
import { api } from '../lib/api.js';
import { money } from '../lib/format.js';
import { useAuth, useToast } from '../context/AppContext.jsx';

/* ---------------------------------------------------------------------------
   Zakat & Sadqa (brief: "Local context").

   Zakat is 2.5% of wealth held for a lunar year, by the usual rule -
   calculated here, never decided here: the figure is a prompt to check
   against the student's own understanding, not a fatwa. Logging it writes a
   normal transaction through the same /transactions/parse the phrase box
   uses, so it lands in Miscellaneous by the same keyword match ('zakat',
   'sadqa') rather than a dedicated thirteenth category - the SRS fixes the
   default twelve.
--------------------------------------------------------------------------- */

const RATE = 0.025;

export default function ZakatCalculator() {
  const { currency } = useAuth();
  const toast = useToast();
  const [savings, setSavings] = useState('');
  const [busy, setBusy] = useState(false);
  const [logged, setLogged] = useState('');

  const due = Number(savings) > 0 ? Math.round(Number(savings) * RATE * 100) / 100 : 0;

  const log = async (kind) => {
    if (!(due > 0) || busy) return;
    setBusy(true);
    try {
      const { draft } = await api.post('/transactions/parse', { phrase: `${kind} ${due}` });
      const categoryId = draft.category?._id;
      if (!categoryId) throw new Error('Could not find a category for that');
      await api.post('/transactions', { categoryId, type: 'expense', amount: due, description: kind, source: 'manual' });
      setLogged(kind);
      toast.success(`${kind} logged`, money(due, currency));
    } catch (err) {
      toast.error('Could not log that', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="in-card in-zakat">
      <div className="in-head">
        <h3>Zakat &amp; Sadqa</h3>
      </div>
      <p className="in-muted" style={{ marginBottom: '0.75rem' }}>
        2.5% of savings held a lunar year, by the usual rule - enter what you're holding to see what's due. A prompt
        to check against your own understanding, not religious advice.
      </p>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        placeholder="Savings held"
        value={savings}
        onChange={(e) => {
          setSavings(e.target.value);
          setLogged('');
        }}
      />
      {due > 0 ? (
        <p className="in-zakat-due">
          {money(due, currency)} <span>due</span>
        </p>
      ) : null}
      <div className="row row-wrap" style={{ gap: '0.5rem', marginTop: '0.7rem' }}>
        <button type="button" className="in-pill is-light" disabled={!due || busy} onClick={() => log('Zakat')}>
          {logged === 'Zakat' ? 'Logged' : 'Log as Zakat'}
        </button>
        <button type="button" className="in-pill is-light" disabled={!due || busy} onClick={() => log('Sadqa')}>
          {logged === 'Sadqa' ? 'Logged' : 'Log as Sadqa'}
        </button>
      </div>
    </section>
  );
}
