import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon, { Wordmark } from '../components/Icon.jsx';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import { useAuth } from '../context/AppContext.jsx';
import { markFor } from '../lib/methods.js';

// What a week of a student's money looks like, as a slow reel under the form.
// These are examples and say so: nothing here comes from an account.
const FEED = [
  ['Allowance received', 'jazzcash', '+Rs 20,000', true],
  ['Canteen chai and paratha', 'cash', '−Rs 120', false],
  ['Rickshaw to campus', 'easypaisa', '−Rs 180', false],
  ['Photocopies for the exam', 'cash', '−Rs 60', false],
  ['Scholarship instalment', 'bank', '+Rs 15,000', true],
  ['Hostel rent', 'bank', '−Rs 12,000', false],
  ['Gym membership', 'card', '−Rs 654', false],
  ['Textbooks', 'cash', '−Rs 2,400', false],
];

/**
 * A moving column of example transactions that fills the space around a short
 * form. The list is written twice so the loop has no visible seam, the copy is
 * hidden from screen readers, and with reduced motion it stops and shows the
 * first few rows still.
 */
export function AuthFeed() {
  return (
    <section className="auth-feed" aria-label="Example activity">
      <header className="auth-feed-head">
        <span className="auth-feed-live" aria-hidden="true" />
        Example activity
        <em>yours appears here once you log it</em>
      </header>
      <div className="auth-feed-window" aria-hidden="true">
        <ul className="auth-feed-track">
          {[...FEED, ...FEED].map(([title, method, amount, incoming], i) => {
            const m = markFor(method);
            return (
              <li key={`${title}-${i}`}>
                <span className="auth-feed-mark" style={{ background: `#${m.hex}`, color: m.ink }}>
                  {m.letter}
                </span>
                <span className="auth-feed-text">
                  {title}
                  <em>{m.name}</em>
                </span>
                <span className={`auth-feed-amt num${incoming ? ' is-in' : ''}`}>{amount}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// What the app itself does for a student, as opposed to what they log: alerts,
// arrivals, insights and repeating entries. Different from the transaction reel
// on the form side, so the two are not saying the same thing twice. Examples.
const ACTIVITY = [
  ['bell', 'Food budget at 80%', 'Rs 7,200 of Rs 9,000', 'just now'],
  ['download', 'Allowance received', '+Rs 20,000 by JazzCash', '2 min ago'],
  ['chat', 'Coin noticed something', 'Food is 7% above your usual', '1 h ago'],
  ['repeat', 'Gym membership added', 'Rs 654 by card, repeats monthly', 'today'],
  ['target', 'Savings goal: 62% there', 'Rs 3,100 to go this month', 'yesterday'],
  ['spark', 'A tip worth Rs 3,100', 'Delivery orders on weekends', 'yesterday'],
];

/**
 * A stack of app events drifting up over the dashboard preview in the navy
 * panel, so the left half of every account page is moving too. Glass cards, cut
 * off top and bottom by a fade, written twice so the loop has no seam, hidden
 * from screen readers, and still under reduced motion.
 */
export function AuthActivity() {
  return (
    <div className="auth-activity" aria-hidden="true">
      <div className="auth-activity-head">
        <span className="auth-feed-live" />
        Coin at work &middot; examples
      </div>
      <div className="auth-activity-window">
        <ul className="auth-activity-track">
          {[...ACTIVITY, ...ACTIVITY].map(([icon, title, body, when], i) => (
            <li key={`${title}-${i}`}>
              <span className="auth-activity-icon">
                <Icon name={icon} size={15} />
              </span>
              <span className="auth-activity-text">
                {title}
                <em>{body}</em>
              </span>
              <time>{when}</time>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * The navy half of every sign-in page: the promise, and the real dashboard
 * the student is about to open, so they know what they are signing in to.
 */
export function AuthAside({ eyebrow = 'Student money. Clearly sorted.', title, highlight, lead }) {
  return (
    <aside className="auth-aside">
      <Link to="/" className="brand" style={{ padding: 0 }}>
        <Wordmark />
      </Link>
      <div>
        <span className="eyebrow has-rule">{eyebrow}</span>
        <h2 className="auth-title">
          {title || 'Six months from now,'}
          <em>{highlight || 'you will know where it went.'}</em>
        </h2>
        <p className="auth-lead">
          {lead ||
            'Log what comes in and what goes out. Campus Coin does the rest: the patterns, the budgets, and one honest sentence a month about what changed.'}
        </p>
      </div>
      <div className="auth-preview" aria-hidden="true">
        <img src="/shots/hero.png" alt="" />
        <AuthActivity />
        <div className="auth-preview-card">
          <span className="auth-preview-icon">
            <Icon name="bulb" size={17} />
          </span>
          <div>
            <strong>Tip of the day</strong>
            <span>Every tip quotes your own numbers</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

/** The strip above every sign-in form: a way home, and the other door. */
export function AuthTop({ children }) {
  return (
    <div className="auth-top">
      <Link to="/" className="auth-back">
        <Icon name="left" size={16} />
        Back to home
      </Link>
      {children}
    </div>
  );
}

/** A text input with an icon inside it, and an optional show/hide switch for passwords. */
export function IconField({ id, label, icon, type = 'text', aside, ...input }) {
  const [shown, setShown] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="field">
      <div className="field-label-row">
        <label htmlFor={id}>{label}</label>
        {aside}
      </div>
      <div className="input-icon">
        <Icon name={icon} size={17} />
        <input id={id} type={isPassword && shown ? 'text' : type} {...input} />
        {isPassword ? (
          <button
            type="button"
            className="input-toggle"
            onClick={() => setShown((was) => !was)}
            aria-label={shown ? 'Hide password' : 'Show password'}
            aria-pressed={shown}
          >
            <Icon name={shown ? 'eye-off' : 'eye'} size={17} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

// The seeded demo student, so anyone evaluating the app is one click from data.
const DEMO = { email: 'student@campuscoin.app', password: 'Student@12345' };

export default function Login() {
  const { login, verifyTwoFactor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Set once the password checks out on an account with two-step
  // verification on - swaps the form below for a single code field.
  const [twoFactor, setTwoFactor] = useState(null); // { userId }
  const [code, setCode] = useState('');

  const signIn = async (credentials) => {
    setBusy(true);
    setError('');
    try {
      const result = await login(credentials.email, credentials.password);
      if (result?.twoFactorRequired) {
        setTwoFactor({ userId: result.userId });
        return;
      }
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    signIn(form);
  };

  const submitCode = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await verifyTwoFactor(twoFactor.userId, code.trim());
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Fills the form first so the student sees what is being used, then signs in.
  const signInAsDemo = () => {
    setForm(DEMO);
    signIn(DEMO);
  };

  return (
    <div className="auth">
      <AuthAside />
      <div className="auth-form-side">
        <AuthTop>
          <span className="auth-top-note">
            New here?{' '}
            <Link to="/register" className="btn btn-sm">
              Create an account
            </Link>
          </span>
        </AuthTop>

        {/* On a phone this wrapper becomes the sheet, so the fine print sits on
            it rather than stranded on the dark below a card that stops short. */}
        <div className="auth-sheet">
        {twoFactor ? (
          <form className="auth-form" onSubmit={submitCode}>
            <div className="auth-head">
              <h1>Enter your code</h1>
              <p>We emailed a 6-digit code to {form.email}.</p>
            </div>

            {error ? <div className="form-error">{error}</div> : null}

            <IconField
              id="code"
              label="Verification code"
              icon="key"
              inputMode="numeric"
              placeholder="000000"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />

            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={busy}>
              {busy ? <span className="spinner" /> : null}
              {busy ? 'Checking' : 'Continue'}
            </button>

            <button type="button" className="btn btn-block" onClick={() => setTwoFactor(null)} disabled={busy}>
              Back to sign in
            </button>
          </form>
        ) : (
        <form className="auth-form has-feed" onSubmit={submit}>
          {/* The aside already carries the brand and the promise, so the card
              only has to ask for two things. */}
          <div className="auth-head">
            <h1>Sign in</h1>
          </div>

          {error ? <div className="form-error">{error}</div> : null}

          <IconField
            id="email"
            label="Email"
            icon="mail"
            type="email"
            autoComplete="email"
            placeholder="you@university.edu"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <IconField
            id="password"
            label="Password"
            icon="key"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            aside={
              <Link to="/forgot-password" className="field-link">
                Forgot?
              </Link>
            }
          />

          <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={busy}>
            {busy ? <span className="spinner" /> : null}
            {busy ? 'Signing in' : 'Sign in'}
            {busy ? null : <Icon name="arrow-ne" size={16} />}
          </button>

          <button type="button" className="btn btn-block auth-demo" onClick={signInAsDemo} disabled={busy}>
            <Icon name="user" size={16} />
            Use the demo account
          </button>
        </form>
        )}

        {!twoFactor ? <GoogleSignInButton /> : null}

        {/* Fills what was empty dark ground above and below a card this short. */}
        {!twoFactor ? <AuthFeed /> : null}

        {/* Out of the card: neither is part of signing in. */}
        <p className="auth-fine">
          No bank connection, no card details, no subscription.
          <Link to="/admin/login">Administrator sign-in</Link>
        </p>
        </div>
      </div>
    </div>
  );
}
