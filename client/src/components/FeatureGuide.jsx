import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/* ---------------------------------------------------------------------------
   A guided, arrow coach-mark tour for a brand-new account's first visit: it
   spotlights a real feature on the page, points an arrow at it, and explains
   it - Skip, Back, Next, Done. Triggered by a flag AppContext.register() sets
   (survives the reload after sign-up); dismissing clears it so it shows once.
   Settings' "Take the tour" replays it via the same event.
--------------------------------------------------------------------------- */

const TOUR_FLAG = 'campuscoin.tour';
const TOUR_EVENT = 'campuscoin-tour';

export function startFeatureTour() {
  try {
    localStorage.setItem(TOUR_FLAG, '1');
  } catch {
    /* private mode - the event below still opens it this once */
  }
  window.dispatchEvent(new Event(TOUR_EVENT));
}

// Each step points at a real element (by a stable class). If one isn't on the
// page, its card just shows centred without a spotlight.
const STEPS = [
  { sel: '.d9-greet-add', title: 'Add in one tap', body: 'Tap here to log any income or expense - amount, category, how you paid.' },
  { sel: '.qp', title: 'Or just type it', body: 'Write it the way you’d say it - "chai 150", "bus 60" - and Campus Coin files it for you.' },
  { sel: '.nt-bell', title: 'Alerts live here', body: 'Budget warnings and reminders show up in the bell, so nothing slips by.' },
  { sel: '.chat-fab', title: 'Ask Coin anything', body: '"How much on food this month?" Coin answers from your own numbers.' },
  { sel: '.tabbar', title: 'Everything, one tap away', body: 'Spending, Budgets, Udhaar and Calendar all live down here.' },
];

export default function FeatureGuide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const popRef = useRef(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(TOUR_FLAG) === '1') setOpen(true);
    } catch {
      /* ignore */
    }
    const onReplay = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(TOUR_EVENT, onReplay);
    return () => window.removeEventListener(TOUR_EVENT, onReplay);
  }, []);

  const measure = useCallback(() => {
    const target = STEPS[step] && document.querySelector(STEPS[step].sel);
    if (target) {
      const r = target.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        return;
      }
    }
    setRect(null);
  }, [step]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const target = STEPS[step] && document.querySelector(STEPS[step].sel);
    try {
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch {
      /* older engines */
    }
    measure();
    let raf = 0;
    const onMove = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    // Re-measure for a moment, so a late-mounting element still gets spotlit.
    const poll = setInterval(measure, 350);
    const stopPoll = setTimeout(() => clearInterval(poll), 2200);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      clearInterval(poll);
      clearTimeout(stopPoll);
      cancelAnimationFrame(raf);
    };
  }, [open, step, measure]);

  const finish = () => {
    try {
      localStorage.removeItem(TOUR_FLAG);
    } catch {
      /* already gone */
    }
    setOpen(false);
    setStep(0);
  };

  if (!open) return null;
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  // Where to put the card + which way the arrow points.
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
  const CARD_W = Math.min(320, vw - 24);
  let placeBelow = true;
  let popStyle;
  let arrowStyle = null;
  if (rect) {
    placeBelow = rect.top + rect.height / 2 < vh / 2;
    const cx = Math.min(Math.max(rect.left + rect.width / 2, 20 + CARD_W / 2), vw - 20 - CARD_W / 2);
    const left = cx - CARD_W / 2;
    popStyle = placeBelow
      ? { top: rect.top + rect.height + 14, left, width: CARD_W }
      : { bottom: vh - rect.top + 14, left, width: CARD_W };
    const arrowLeft = Math.min(Math.max(rect.left + rect.width / 2 - left, 18), CARD_W - 18);
    arrowStyle = { left: arrowLeft };
  } else {
    popStyle = { top: '50%', left: '50%', width: CARD_W, transform: 'translate(-50%, -50%)' };
  }

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-label="Feature tour">
      {/* Dim everything, with a bright cut-out around the target. */}
      {rect ? (
        <div
          className="tour-spot"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      ) : (
        <div className="tour-dim" />
      )}

      <div className={`tour-pop${rect ? (placeBelow ? ' is-below' : ' is-above') : ' is-center'}`} style={popStyle} ref={popRef}>
        {rect ? <span className="tour-arrow" style={arrowStyle} /> : null}
        <strong className="tour-title">{current.title}</strong>
        <p className="tour-body">{current.body}</p>
        <div className="tour-foot">
          <div className="tour-dots" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span key={i} className={i === step ? 'is-on' : ''} />
            ))}
          </div>
          <div className="tour-btns">
            <button type="button" className="tour-skip" onClick={finish}>
              Skip
            </button>
            {step > 0 ? (
              <button type="button" className="tour-back" onClick={() => setStep((s) => s - 1)}>
                Back
              </button>
            ) : null}
            <button type="button" className="tour-next" onClick={() => (last ? finish() : setStep((s) => s + 1))}>
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
