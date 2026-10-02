import { useEffect, useState } from 'react';
import { Modal } from './TransactionForm.jsx';
import { artUrl } from './Illustrations.jsx';

/* ---------------------------------------------------------------------------
   The one-time, step-by-step tour of what Campus Coin actually does, shown
   right after a brand-new account's first sign-in - not a tooltip chasing
   the student around the page, one modal with a handful of cards. Triggered
   by a flag AppContext.register() sets in localStorage (survives a reload,
   unlike the session-only "welcome back" note); dismissing it (Skip, Done,
   or the last step) clears that flag for good, so it never reappears.
--------------------------------------------------------------------------- */

const TOUR_FLAG = 'campuscoin.tour';
const TOUR_EVENT = 'campuscoin-tour';

/** Replays the tour on demand (Settings' "Core features" link) - same modal a brand-new account sees. */
export function startFeatureTour() {
  try {
    localStorage.setItem(TOUR_FLAG, '1');
  } catch {
    /* private mode - nothing to persist, but the event below still opens it this once */
  }
  window.dispatchEvent(new Event(TOUR_EVENT));
}

const STEPS = [
  {
    art: 'speech-balloon',
    title: 'Just type it',
    body: 'Adding a transaction is one line - "chai 150", "kiraya 5000", "ammi ne 2000 diye". Campus Coin finds the amount and picks the category itself, in English or Roman Urdu.',
  },
  {
    art: 'bank',
    title: 'Bank SMS can log itself',
    body: 'Settings has a key that turns your bank’s SMS alerts into transactions automatically - no typing, once it is set up.',
  },
  {
    art: 'money-bag',
    title: 'Set a budget, see it fill',
    body: 'One cap on the category you spend most on is the change that actually sticks. Budgets shows exactly how much room is left, all month.',
  },
  {
    art: 'money-with-wings',
    title: 'Udhaar - who owes who',
    body: 'Track loans between friends separately from your own spending, and send a reminder - with a branded card ready to share - in one tap.',
  },
  {
    art: 'bar-chart',
    title: 'Insights, from your own numbers',
    body: 'Reports and Insights turn what you log into real patterns - where it goes, which days cost the most - not generic advice.',
  },
];

export default function FeatureGuide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(TOUR_FLAG) === '1') setOpen(true);
    } catch {
      /* private mode - the tour just never shows, not worth breaking on */
    }
    const onReplay = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(TOUR_EVENT, onReplay);
    return () => window.removeEventListener(TOUR_EVENT, onReplay);
  }, []);

  const finish = () => {
    try {
      localStorage.removeItem(TOUR_FLAG);
    } catch {
      /* already gone */
    }
    setOpen(false);
  };

  if (!open) return null;
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <Modal title="A quick look around" onClose={finish}>
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <img src={artUrl(current.art)} alt="" width={64} height={64} />
        <h3 style={{ margin: 0 }}>{current.title}</h3>
        <p className="muted" style={{ margin: 0 }}>{current.body}</p>
        <div className="row" style={{ gap: '0.3rem' }}>
          {STEPS.map((_, i) => (
            <span
              key={i}
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: i === step ? 'var(--accent)' : 'var(--line-strong)',
              }}
            />
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={finish}>
            Skip
          </button>
          {step > 0 ? (
            <button type="button" className="btn" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={() => (last ? finish() : setStep((s) => s + 1))}>
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
