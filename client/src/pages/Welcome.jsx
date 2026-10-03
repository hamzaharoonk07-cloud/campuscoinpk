/* Campus Coin welcome / onboarding — premium 4-step flow for first-time phone
   visitors, ported from the approved reference designs.

   How the premium-craft items are met:
   - Depth/light: aurora (0.3x) + cards (1x) + orbit chips (1.4x) move apart on
     pointer tilt; glass cards use a gradient (not flat) border + inner top
     highlight; an inline feTurbulence grain overlay at ~9%; the 3D coin has a
     moving specular highlight so the spin reads as metal.
   - Motion: spring easings (entrances .16,1,.3,1; pops overshoot); 60-90ms
     stagger; count-ups with tabular figures; step change re-keys the container so
     entrances replay; swipe left/right + arrow keys change steps.
   - Micro: CTA press scales + haptic (navigator.vibrate); typing caret; "Looks
     like Food" pop; receipt scan beam; Coin answer streams word-by-word with a
     cursor; stat chips count up.
   - First impression: a 900ms branded intro (ring draws, dot drops) once per
     device, skippable by tap; idle state only drifts/floats/shines.
   - Reduced motion: everything renders in its finished state.
   Hard-coded (no token fit on this dark surface): bg #09090c, greens/mints/blue/
   amber per welcome.css header. */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/* Each step scrolls if it is taller than the screen, so nothing is ever cut;
   short steps fill the screen with the footer pinned to the bottom. */
function FitStep({ children }) {
  return (
    <div className="wl-step">
      <div className="wl-scale">{children}</div>
    </div>
  );
}
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import '../styles/welcome.css';

const SAMPLE = {
  typed: 'Biryani with friends',
  answer:
    'Yes. After Rs 2,000 you would still have Rs 6,510 for the 29 days left, about Rs 224 a day. Semester & books is at 81%, so keep the rest of the week light.',
  bars: [
    { name: 'Food', spent: 3850, cap: 9000, color: '#22c55e' },
    { name: 'Transport', spent: 1640, cap: 3500, color: '#5b91ff' },
    { name: 'Semester & books', spent: 6500, cap: 8000, color: '#f5c46b' },
  ],
};

const reduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const haptic = () => { try { navigator.vibrate && navigator.vibrate(8); } catch { /* unsupported */ } };

// rAF seconds counter; resets when key changes. Freezes at a large value under
// reduced motion so typing/streaming/count-ups render finished.
function useElapsed(key) {
  const [t, setT] = useState(reduced ? 999 : 0);
  useEffect(() => {
    if (reduced) { setT(999); return undefined; }
    setT(0);
    const t0 = Date.now();
    let raf;
    const tick = () => { const e = (Date.now() - t0) / 1000; setT(e); if (e < 8) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key]);
  return t;
}
const easeOut = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const countTo = (target, t, start, dur) => Math.round(target * easeOut((t - start) / dur));

function CoinFace({ id }) {
  return (
    <svg width="150" height="150" viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#6ee7b7" /><stop offset="0.5" stopColor="#22c55e" /><stop offset="1" stopColor="#15803d" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="24" fill={`url(#${id})`} />
      <circle cx="24" cy="24" r="20.5" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.8" />
      <path d="M32.5 15.5A12 12 0 1 0 32.5 32.5" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
      <circle cx="24" cy="24" r="3.4" fill="#fff" />
    </svg>
  );
}
const BrandMark = ({ size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <defs><linearGradient id="wlbm" x1="0.15" y1="0" x2="0.85" y2="1"><stop offset="0" stopColor="#6ee7b7" /><stop offset="0.5" stopColor="#22c55e" /><stop offset="1" stopColor="#15803d" /></linearGradient></defs>
    <circle cx="24" cy="24" r="24" fill="url(#wlbm)" />
    <path d="M32.5 15.5A12 12 0 1 0 32.5 32.5" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
    <circle cx="24" cy="24" r="3.4" fill="#fff" />
  </svg>
);
const Arrow = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#052e16" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;

const TopBar = ({ feat, onSkip }) => (
  <div className="wl-top" role="group" aria-label={`Step ${feat + 1} of 4`}>
    <div className="wl-segs">
      {[0, 1, 2].map((n) => (
        <div key={n} className={`wl-seg${n < feat ? ' is-done' : ''}${n === feat ? ' is-active' : ''}`}><span className="wl-seg-fill" /></div>
      ))}
    </div>
    <button type="button" className="wl-skip" onClick={onSkip}>Skip</button>
  </div>
);

/* ---- Step 1: hero -------------------------------------------------------- */
function Hero({ onStart, onLogin, tilt }) {
  const chip = (ic, bg, stroke, title, sub, pos, delay) => (
    <div style={pos}>
      <div className="wl-counter">
        <div className="wl-chip wl-pop" style={{ animationDelay: `${delay}s` }}>
          <span className="wl-chip-ic" style={{ background: bg }}>{ic(stroke)}</span>
          <span className="wl-chip-txt"><b>{title}</b><em>{sub}</em></span>
        </div>
      </div>
    </div>
  );
  const bowl = (s) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11h18a9 9 0 0 1-18 0zM8 7c0-1.5 1-1.5 1-3M12 7c0-1.5 1-1.5 1-3M16 7c0-1.5 1-1.5 1-3" /></svg>;
  const car = (s) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 16V11l2-4h10l2 4v5M5 16h14M5 16v2M19 16v2" /><circle cx="8.5" cy="13.5" r="1" /><circle cx="15.5" cy="13.5" r="1" /></svg>;
  const book = (s) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7" /></svg>;
  return (
    <div className="wl-fit is-enter">
      <div className="wl-brandrow wl-up" style={{ animationDelay: '0.1s', justifyContent: 'flex-end' }}>
        <span className="wl-free">Free for students</span>
      </div>
      <div className="wl-hero" style={{ transform: tilt }}>
        <div className="wl-pulse" /><div className="wl-pulse" style={{ animationDelay: '1.2s' }} />
        <div className="wl-ring-dashed" />
        <div className="wl-orbit">
          {chip(bowl, '#4ade80', '#052e16', 'Saved Rs 450', 'Biryani with friends', { position: 'absolute', left: 118, top: -18 }, 0.9)}
          {chip(car, '#8fb3ff', '#0b1b4a', 'Careem Rs 320', 'Transport', { position: 'absolute', left: -8, top: 150 }, 1.1)}
          {chip(book, '#f5c46b', '#3a2600', 'Semester fee', 'Planned for Oct', { position: 'absolute', left: 120, top: 188 }, 1.3)}
        </div>
        <div className="wl-coinwrap">
          <div className="wl-coin3d">
            <div className="wl-coinface"><div className="wl-coin-rim" /><div style={{ position: 'relative' }}><CoinFace id="wlf" /><div className="wl-coin-sheen" /></div><div className="wl-spec" /></div>
            <div className="wl-coinface is-back"><div className="wl-coin-rim" /><div style={{ position: 'relative' }}><CoinFace id="wlb" /><div className="wl-coin-sheen" /></div><div className="wl-spec" /></div>
          </div>
        </div>
      </div>
      <div className="wl-foot">
        <h1 className="wl-h1">
          <span className="wl-shim" style={{ animationDelay: '0.4s, 0s' }}>Say it.</span>
          <span className="wl-shim" style={{ animationDelay: '0.58s, 0.4s' }}>Saved.</span>
          <span className="wl-up wl-accentword" style={{ animationDelay: '0.9s' }}>Done.</span>
        </h1>
        <p className="wl-sub wl-up" style={{ animationDelay: '1.05s' }}>The money app for university students in Pakistan. Chai, rickshaws, rent and allowance in one calm place.</p>
        <div style={{ height: 4 }} />
        <button type="button" className="wl-cta wl-up" style={{ animationDelay: '1.2s' }} onClick={() => { haptic(); onStart(); }}>Get started<Arrow /><span className="wl-shine" /></button>
        <button type="button" className="wl-link wl-up" style={{ animationDelay: '1.35s' }} onClick={onLogin}>I already have an account</button>
      </div>
    </div>
  );
}

/* ---- Step 2: log it ----------------------------------------------------- */
function Log({ feat, onNext, onSkip }) {
  const t = useElapsed('log');
  const typed = SAMPLE.typed.slice(0, Math.floor(easeOut((t - 0.3) / 1.0) * SAMPLE.typed.length));
  const doneTyping = typed.length >= SAMPLE.typed.length;
  return (
    <div className="wl-fit is-enter">
      <TopBar feat={feat} onSkip={onSkip} />
      <div className="wl-art" style={{ marginTop: 18 }}>
        <div className="wl-glass wl-inputcard wl-up">
          <div className="wl-rowbtw"><span className="wl-muted">What was it?</span><span className="wl-smart">✦ Smart category</span></div>
          <div className="wl-input">
            <span className="wl-input-txt">{typed}{!doneTyping && !reduced ? <span className="wl-caret" /> : ''}</span>
            <span className="wl-input-amt" style={{ opacity: doneTyping ? 1 : 0, transition: 'opacity .3s' }}>Rs 450</span>
          </div>
          {(doneTyping || reduced) ? <span className="wl-looks wl-pop">✦ Looks like <b>Food</b></span> : null}
        </div>
        <div className="wl-saved wl-fly" style={{ animationDelay: '1.4s' }}>
          <span className="wl-saved-ic">🍲</span>
          <span className="wl-saved-t"><b>Biryani with friends</b><em>Food, today 1:30 pm</em></span>
          <span className="wl-saved-amt"><b><i>−Rs</i> 450</b><span className="wl-saved-tag">Saved</span></span>
        </div>
        <div className="wl-receipt-row">
          <div className="wl-receipt wl-up" style={{ animationDelay: '1.6s' }}>
            {!reduced ? <span className="wl-beam" /> : null}
            <div className="wl-rhead">STUDENT STATIONERS</div>
            <div className="wl-rdate">28/09/2026</div>
            <div className="wl-rline"><span>Notes copy</span><span>120.00</span></div>
            <div className="wl-rline"><span>Lab file</span><span>350.00</span></div>
            <div className="wl-rline"><span>Pens x3</span><span>90.00</span></div>
            <div className="wl-rtotal"><span>TOTAL</span><span>560.00</span></div>
          </div>
          <div className="wl-rcards">
            {[['Total', 'Rs 560', 2.0], ['Shop', 'Student Stationers', 2.2], ['Date', '28 Sept', 2.4]].map(([l, v, d]) => (
              <div key={l} className="wl-glass wl-rcard wl-pop" style={{ animationDelay: `${d}s` }}><span>{l}</span><b>{v}</b></div>
            ))}
          </div>
        </div>
      </div>
      <div className="wl-foot">
        <h2 className="wl-h2"><span>Log it in <span className="wl-mintword">seconds.</span></span></h2>
        <p className="wl-sub">Type it and Campus Coin picks the category. Snap a receipt and it reads the total, shop and date, right on your phone.</p>
        <div style={{ height: 4 }} />
        <button type="button" className="wl-cta" onClick={() => { haptic(); onNext(); }}>Next<Arrow /><span className="wl-shine" /></button>
      </div>
    </div>
  );
}

/* ---- Step 3: budget ----------------------------------------------------- */
function Budget({ feat, onNext, onSkip }) {
  const t = useElapsed('budget');
  const avail = reduced ? 8510 : countTo(8510, t, 0.4, 1.4);
  return (
    <div className="wl-fit is-enter">
      <TopBar feat={feat} onSkip={onSkip} />
      <div className="wl-art" style={{ marginTop: 18 }}>
        <div className="wl-glass wl-budget wl-up">
          <div className="wl-budget-head">
            <div className="wl-ring"><span><b>58%</b><em>used</em></span></div>
            <div className="wl-budget-fig">
              <span className="wl-muted">Still available in October</span>
              <div className="wl-big"><i>Rs</i> {fmt(avail)}</div>
              <span className="wl-amber">Semester at 81%</span>
            </div>
          </div>
          {SAMPLE.bars.map((b, i) => {
            const pct = (b.spent / b.cap) * 100;
            const val = reduced ? b.spent : countTo(b.spent, t, 0.4 + i * 0.15, 1.2);
            return (
              <div className="wl-bar" key={b.name}>
                <div className="wl-rowbtw"><b>{b.name}</b><span className="wl-muted"><span className="wl-rs">Rs</span>{fmt(val)} of {fmt(b.cap)}</span></div>
                <div className="wl-bartrack"><div className="wl-barfill" style={{ width: `${pct}%`, background: b.color, animationDelay: `${0.3 + i * 0.15}s`, '--wl-final': `${pct}%` }} /></div>
              </div>
            );
          })}
        </div>
        <div className="wl-glass wl-week wl-up" style={{ animationDelay: '0.3s' }}>
          <div className="wl-rowbtw"><b>This week</b><span className="wl-muted">Mon to Fri</span></div>
          <svg className="wl-spark" viewBox="0 0 300 90" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="wlwk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22c55e" stopOpacity="0.3" /><stop offset="1" stopColor="#22c55e" stopOpacity="0" /></linearGradient></defs>
            <path d="M8 62 C40 44,60 40,95 54 C130 68,150 70,190 52 C230 34,255 24,292 14 L292 90 L8 90 Z" fill="url(#wlwk)" opacity="0.9" className="wl-fade" style={{ animationDelay: '1.2s' }} />
            <path className="wl-sparkline" d="M8 62 C40 44,60 40,95 54 C130 68,150 70,190 52 C230 34,255 24,292 14" fill="none" stroke="#3ddc84" strokeWidth="3" strokeLinecap="round" />
            <circle cx="292" cy="14" r="5" fill="#3ddc84" className="wl-fade" style={{ animationDelay: '2s' }} />
          </svg>
        </div>
      </div>
      <div className="wl-foot">
        <h2 className="wl-h2"><span>See where it <span className="wl-mintword">goes.</span></span></h2>
        <p className="wl-sub">Set a cap for each category. Campus Coin tells you once at 80% and once if you go over, never on every purchase.</p>
        <div style={{ height: 4 }} />
        <button type="button" className="wl-cta" onClick={() => { haptic(); onNext(); }}>Next<Arrow /><span className="wl-shine" /></button>
      </div>
    </div>
  );
}

/* ---- Step 4: Ask Coin --------------------------------------------------- */
function Coin({ feat, onNext, onSkip }) {
  const t = useElapsed('coin');
  const words = SAMPLE.answer.split(' ');
  const showTyping = !reduced && t < 0.9;
  const shown = reduced ? words.length : Math.floor(Math.max(0, (t - 0.9)) / 0.05);
  const streaming = shown < words.length && !reduced;
  const answer = reduced ? SAMPLE.answer : words.slice(0, shown).join(' ');
  const statsT = Math.max(0, t - (0.9 + words.length * 0.05) - 0.1);
  const tiles = [
    ['Left now', countTo(8510, statsT, 0, 0.9), false],
    ['After 2,000', countTo(6510, statsT, 0.1, 0.9), false],
    ['Per day', countTo(224, statsT, 0.2, 0.9), true],
  ];
  return (
    <div className="wl-fit is-enter">
      <TopBar feat={feat} onSkip={onSkip} />
      <div className="wl-art" style={{ marginTop: 18 }}>
        <div className="wl-coinhead wl-up">
          <span className="wl-halo"><BrandMark size={32} /></span>
          <span><b>Coin</b><em><i className="wl-dotgreen" /> Answers from your own money</em></span>
        </div>
        <div className="wl-qbubble wl-pop" style={{ animationDelay: '0.3s' }}>Can I afford biryani night for 4?</div>
        <div className="wl-glass wl-abubble" aria-live="polite">
          {showTyping ? <span className="wl-dots"><i /><i /><i /></span> : <>{answer}{streaming ? <span className="wl-cursor" /> : ''}</>}
        </div>
        <div className="wl-tiles">
          {tiles.map(([l, v, g]) => (
            <div key={l} className="wl-glass wl-tile"><span>{l}</span><b className={g ? 'g' : ''}><span className="wl-rs">Rs</span>{fmt(v)}</b></div>
          ))}
        </div>
        <p className="wl-lock">🔒 Coin only uses the numbers you have logged.</p>
      </div>
      <div className="wl-foot">
        <h2 className="wl-h2"><span>Ask Coin <span className="wl-mintword">anything.</span></span></h2>
        <p className="wl-sub">Can you afford it? Where did the money go? Coin answers in plain words, from your own spending.</p>
        <div style={{ height: 4 }} />
        <button type="button" className="wl-cta" onClick={() => { haptic(); onNext(); }}>Create my account<Arrow /><span className="wl-shine" /></button>
      </div>
    </div>
  );
}

/* ---- Step 5: join ------------------------------------------------------- */
function Join({ onPhone, onEmail, onLogin }) {
  return (
    <div className="wl-fit is-enter wl-join">
      <h2 className="wl-h2" style={{ textAlign: 'center', fontSize: 34, marginTop: 8 }}>Create your <span className="wl-accentword">account</span></h2>
      <p className="wl-sub" style={{ textAlign: 'center', margin: '8px auto 18px' }}>Pick the way that suits you. It takes seconds.</p>
      <div className="wl-google"><GoogleSignInButton bare shape="pill" /></div>
      <button type="button" className="wl-cta" onClick={() => { haptic(); onEmail(); }}>Sign up with email<span className="wl-shine" /></button>
      <button type="button" className="wl-link" onClick={onLogin}>I already have an account</button>
    </div>
  );
}

export default function Welcome() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [tilt, setTilt] = useState('');
  const [intro, setIntro] = useState(() => {
    if (reduced) return false;
    try { return !localStorage.getItem('campuscoin.introseen'); } catch { return true; }
  });
  const startX = useRef(0);

  useEffect(() => {
    if (!intro) return undefined;
    try { localStorage.setItem('campuscoin.introseen', '1'); } catch { /* ignore */ }
    const id = setTimeout(() => setIntro(false), 1350);
    return () => clearTimeout(id);
  }, [intro]);

  // Mark the visitor welcomed when they reach the join step or leave the flow.
  const markWelcomed = () => { try { localStorage.setItem('campuscoin.welcomed', '1'); } catch { /* ignore */ } };
  const go = (n) => { const c = Math.max(0, Math.min(4, n)); if (c === 4) markWelcomed(); setStep(c); };

  // Stories-style auto-forward: each welcome step advances on its own (synced to
  // the 5s progress bar); the join step (4) waits for the user. Any manual
  // swipe/arrow/skip resets the timer via the step dependency. Held during the
  // intro splash.
  useEffect(() => {
    if (intro || step >= 4) return undefined;
    const id = setTimeout(() => go(step + 1), 5200);
    return () => clearTimeout(id);
  }, [step, intro]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'ArrowRight') go(step + 1); else if (e.key === 'ArrowLeft') go(step - 1); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  const onTouchStart = (e) => { startX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => { const dx = e.changedTouches[0].clientX - startX.current; if (dx < -45) go(step + 1); else if (dx > 45) go(step - 1); };
  const onMove = (e) => { const r = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width - 0.5) * 8; const y = -((e.clientY - r.top) / r.height - 0.5) * 8; setTilt(`perspective(900px) rotateX(${y.toFixed(1)}deg) rotateY(${x.toFixed(1)}deg)`); };
  const onLeave = () => setTilt('');

  const toLogin = () => { markWelcomed(); navigate('/login'); };
  const toRegister = () => { markWelcomed(); navigate('/register'); };
  const toPhone = () => { markWelcomed(); navigate('/phone'); };

  return (
    <main className="wl" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="wl-bg" style={{ transform: tilt ? 'translate(var(--d))' : undefined }}>
        <div className="wl-aur wl-aur1" /><div className="wl-aur wl-aur2" /><div className="wl-aur wl-aur3" />
        <div className="wl-dots" />
        <svg className="wl-grain" width="390" height="844" aria-hidden="true"><filter id="wlgrain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" /></filter><rect width="390" height="844" filter="url(#wlgrain)" /></svg>
        <div className="wl-vig" />
      </div>

      <div className="wl-logobar"><BrandMark size={24} /><b>Campus Coin</b></div>

      <FitStep key={step}>
        {step === 0 && <Hero onStart={() => go(1)} onLogin={toLogin} tilt={tilt} />}
        {step === 1 && <Log feat={0} onNext={() => go(2)} onSkip={() => go(4)} />}
        {step === 2 && <Budget feat={1} onNext={() => go(3)} onSkip={() => go(4)} />}
        {step === 3 && <Coin feat={2} onNext={() => go(4)} onSkip={() => go(4)} />}
        {step === 4 && <Join onPhone={toPhone} onEmail={toRegister} onLogin={toLogin} />}
      </FitStep>

      {intro ? (
        <div className="wl-intro" onClick={() => setIntro(false)}>
          <div className="wl-intro-glow" />
          <svg className="wl-introcoin" width="120" height="120" viewBox="0 0 48 48" aria-hidden="true">
            <circle cx="24" cy="24" r="22" fill="none" stroke="#22c55e" strokeWidth="1.2" opacity="0.5" />
            <path className="wl-ringdraw" d="M32.5 15.5A12 12 0 1 0 32.5 32.5" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
            <circle className="wl-drop" cx="24" cy="24" r="3.4" fill="#fff" />
          </svg>
        </div>
      ) : null}
    </main>
  );
}
