import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import '../styles/welcome.css';

/* The opening of the app: a swipeable onboarding (welcome -> three feature
   slides -> join), shown to anyone opening signed out. Everything is hand-drawn
   with CSS/SVG so there are no screenshots to keep in sync and it stays crisp. */

/* The coin mark, used large on the hero and small as Coin's avatar. */
function CoinMark({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="wc-coin" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#6ee7b7" />
          <stop offset="0.5" stopColor="#22c55e" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="24" fill="url(#wc-coin)" />
      <path d="M32.5 15.5A12 12 0 1 0 32.5 32.5" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
      <circle cx="24" cy="24" r="3.4" fill="#fff" />
    </svg>
  );
}

const TopBar = ({ step, onSkip }) => (
  <div className="ob-top">
    <div className="ob-prog" aria-hidden="true">
      <span className={step >= 1 ? 'on' : ''} />
      <span className={step >= 2 ? 'on' : ''} />
      <span className={step >= 3 ? 'on' : ''} />
    </div>
    <button type="button" className="ob-skip" onClick={onSkip}>Skip</button>
  </div>
);

/* --- Slide 1: the hero ---------------------------------------------------- */
function SlideHero({ onStart, onLogin }) {
  return (
    <section className="ob-slide">
      <div className="ob-head">
        <div className="ob-brand"><CoinMark size={34} /><b>Campus Coin</b></div>
        <span className="ob-pill-free">Free for students</span>
      </div>

      <div className="ob-hero-art" aria-hidden="true">
        <span className="ob-ring" /><span className="ob-ring ob-ring2" />
        <div className="ob-coin3d"><CoinMark size={120} /></div>
        <div className="ob-chip ob-chip-a">
          <span className="ob-chip-ic" style={{ background: '#1e7d50' }}>🍜</span>
          <span><b>Saved Rs 450</b><em>Biryani with friends</em></span>
        </div>
        <div className="ob-chip ob-chip-b">
          <span className="ob-chip-ic" style={{ background: '#caa23a' }}>🧾</span>
          <span><b>Semester fee</b><em>Planned for Oct</em></span>
        </div>
        <div className="ob-chip ob-chip-c">
          <span className="ob-chip-ic" style={{ background: '#5b91ff' }}>🚗</span>
          <span><b>Careem ride Rs 320</b><em>Transport</em></span>
        </div>
      </div>

      <div className="ob-copy">
        <h1 className="ob-h1">Say it.<br />Saved.<br /><span className="g">Done.</span></h1>
        <p className="ob-sub">The money app for university students in Pakistan. Chai, rickshaws, rent and allowance in one calm place.</p>
      </div>
      <div className="ob-cta">
        <button type="button" className="ob-btn ob-btn-primary" onClick={onStart}>Get started <Icon name="arrow-ne" size={18} /></button>
        <button type="button" className="ob-link" onClick={onLogin}>I already have an account</button>
      </div>
    </section>
  );
}

/* --- Slide 2: log it in seconds ------------------------------------------ */
function SlideLog({ step, onNext, onSkip }) {
  return (
    <section className="ob-slide">
      <TopBar step={step} onSkip={onSkip} />
      <div className="ob-art">
        <div className="ob-card ob-input-card">
          <div className="ob-row-between"><span className="ob-muted">What was it?</span><span className="ob-smart"><Icon name="spark" size={13} /> Smart category</span></div>
          <div className="ob-input"><span>Biryani with friends</span><b>Rs 450</b></div>
          <span className="ob-looks"><Icon name="spark" size={12} /> Looks like <b>Food</b></span>
        </div>
        <div className="ob-saved">
          <span className="ob-saved-ic">🍲</span>
          <span className="ob-saved-t"><b>Biryani with friends</b><em>Food, today 1:30 pm</em></span>
          <span className="ob-saved-amt"><b><i>−Rs</i> 450</b><span className="ob-saved-tag">Saved</span></span>
        </div>
        <div className="ob-receipt-row">
          <div className="ob-receipt">
            <div className="ob-r-head">STUDENT STATIONERS</div>
            <div className="ob-r-date">28/09/2026</div>
            <div className="ob-r-line"><span>Notes copy</span><span>120.00</span></div>
            <div className="ob-r-line"><span>Lab file</span><span>350.00</span></div>
            <div className="ob-r-line"><span>Pens x3</span><span>90.00</span></div>
            <div className="ob-r-total"><span>TOTAL</span><span>560.00</span></div>
          </div>
          <div className="ob-r-cards">
            <div className="ob-r-card"><span className="ob-muted">Total</span><b>Rs 560</b></div>
            <div className="ob-r-card"><span className="ob-muted">Shop</span><b>Student Stationers</b></div>
            <div className="ob-r-card"><span className="ob-muted">Date</span><b>28 Sept</b></div>
          </div>
        </div>
      </div>
      <div className="ob-copy">
        <h2 className="ob-h2">Log it in <span className="g">seconds.</span></h2>
        <p className="ob-sub">Type it and Campus Coin picks the category. Snap a receipt and it reads the total, shop and date, right on your phone.</p>
      </div>
      <div className="ob-cta"><button type="button" className="ob-btn ob-btn-primary" onClick={onNext}>Next <Icon name="arrow-ne" size={18} /></button></div>
    </section>
  );
}

/* --- Slide 3: see where it goes ------------------------------------------ */
function SlideBudget({ step, onNext, onSkip }) {
  const bars = [
    ['Food', 'Rs 3,850 of 9,000', 43, '#22c55e'],
    ['Transport', 'Rs 1,640 of 3,500', 47, '#5b91ff'],
    ['Semester & books', 'Rs 6,500 of 8,000', 81, '#f0b429'],
  ];
  return (
    <section className="ob-slide">
      <TopBar step={step} onSkip={onSkip} />
      <div className="ob-art">
        <div className="ob-card ob-budget">
          <div className="ob-budget-head">
            <div className="ob-ring58"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="7" /><circle cx="40" cy="40" r="34" fill="none" stroke="#22c55e" strokeWidth="7" strokeLinecap="round" strokeDasharray="124 214" transform="rotate(-90 40 40)" /></svg><span><b>58%</b><em>used</em></span></div>
            <div className="ob-budget-fig"><span className="ob-muted">Still available in October</span><div className="ob-big"><i>Rs</i> 8,510</div><span className="ob-amber-pill">Semester at 81%</span></div>
          </div>
          {bars.map(([name, amt, pct, col]) => (
            <div className="ob-bar" key={name}>
              <div className="ob-row-between"><b>{name}</b><span className="ob-muted">{amt}</span></div>
              <div className="ob-bartrack"><span style={{ width: `${pct}%`, background: col }} /></div>
            </div>
          ))}
        </div>
        <div className="ob-card ob-week">
          <div className="ob-row-between"><b>This week</b><span className="ob-muted">Mon to Fri</span></div>
          <svg className="ob-spark" viewBox="0 0 300 90" preserveAspectRatio="none">
            <defs><linearGradient id="wc-wk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22c55e" stopOpacity="0.3" /><stop offset="1" stopColor="#22c55e" stopOpacity="0" /></linearGradient></defs>
            <path d="M8 62 C40 44,60 40,95 54 C130 68,150 70,190 52 C230 34,255 24,292 14 L292 90 L8 90 Z" fill="url(#wc-wk)" />
            <path d="M8 62 C40 44,60 40,95 54 C130 68,150 70,190 52 C230 34,255 24,292 14" fill="none" stroke="#3ddc84" strokeWidth="3" strokeLinecap="round" />
            <circle cx="292" cy="14" r="5" fill="#3ddc84" />
          </svg>
        </div>
      </div>
      <div className="ob-copy">
        <h2 className="ob-h2">See where it <span className="g">goes.</span></h2>
        <p className="ob-sub">Set a cap for each category. Campus Coin tells you once at 80% and once if you go over, never on every purchase.</p>
      </div>
      <div className="ob-cta"><button type="button" className="ob-btn ob-btn-primary" onClick={onNext}>Next <Icon name="arrow-ne" size={18} /></button></div>
    </section>
  );
}

/* --- Slide 4: ask Coin --------------------------------------------------- */
function SlideCoin({ step, onNext, onSkip }) {
  return (
    <section className="ob-slide">
      <TopBar step={step} onSkip={onSkip} />
      <div className="ob-art">
        <div className="ob-coin-head"><span className="ob-coin-av"><CoinMark size={54} /></span><span><b>Coin</b><em><i className="ob-dot" /> Answers from your own money</em></span></div>
        <div className="ob-q">Can I afford biryani night for 4?</div>
        <div className="ob-a">Yes. After Rs 2,000 you would still have Rs 6,510 for the 29 days left, about Rs 224 a day. Semester &amp; books is at 81%, so keep the rest of the week light.</div>
        <div className="ob-tiles">
          <div className="ob-tile"><span className="ob-muted">Left now</span><b><i>Rs</i> 8,510</b></div>
          <div className="ob-tile"><span className="ob-muted">After 2,000</span><b><i>Rs</i> 6,510</b></div>
          <div className="ob-tile"><span className="ob-muted">Per day</span><b className="g"><i>Rs</i> 224</b></div>
        </div>
        <p className="ob-lock">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          Coin only uses the numbers you have logged.
        </p>
      </div>
      <div className="ob-copy">
        <h2 className="ob-h2">Ask Coin <span className="g">anything.</span></h2>
        <p className="ob-sub">Can you afford it? Where did the money go? Coin answers in plain words, from your own spending.</p>
      </div>
      <div className="ob-cta"><button type="button" className="ob-btn ob-btn-primary" onClick={onNext}>Create my account <Icon name="arrow-ne" size={18} /></button></div>
    </section>
  );
}

/* --- Slide 5: join (the ways in) ----------------------------------------- */
function SlideJoin({ onPhone, onEmail, onLogin }) {
  return (
    <section className="ob-slide ob-join">
      <div className="ob-brand ob-brand-center"><CoinMark size={40} /><b>Campus Coin</b></div>
      <h2 className="ob-h2 ob-join-h">Create your <span className="g">account</span></h2>
      <p className="ob-sub ob-center">Pick the way that suits you. It takes seconds.</p>
      <div className="ob-cta ob-join-cta">
        <button type="button" className="ob-btn ob-btn-primary" onClick={onPhone}><Icon name="user" size={18} /> Continue with phone number</button>
        <div className="ob-google"><GoogleSignInButton bare /></div>
        <button type="button" className="ob-btn ob-btn-ghost" onClick={onEmail}>Sign up with email</button>
        <button type="button" className="ob-link" onClick={onLogin}>I already have an account</button>
      </div>
    </section>
  );
}

export default function Welcome() {
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const track = useRef(null);
  const start = useRef(0);

  const go = (n) => setI(Math.max(0, Math.min(4, n)));
  const onTouchStart = (e) => { start.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - start.current;
    if (dx < -45) go(i + 1);
    else if (dx > 45) go(i - 1);
  };

  return (
    <main className="ob">
      <div
        className="ob-track"
        ref={track}
        style={{ transform: `translateX(-${i * 100}%)` }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <SlideHero onStart={() => go(1)} onLogin={() => navigate('/login')} />
        <SlideLog step={1} onNext={() => go(2)} onSkip={() => go(4)} />
        <SlideBudget step={2} onNext={() => go(3)} onSkip={() => go(4)} />
        <SlideCoin step={3} onNext={() => go(4)} onSkip={() => go(4)} />
        <SlideJoin onPhone={() => navigate('/phone')} onEmail={() => navigate('/register')} onLogin={() => navigate('/login')} />
      </div>
    </main>
  );
}
