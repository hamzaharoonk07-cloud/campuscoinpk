import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon, { Wordmark } from '../components/Icon.jsx';
import { useAuth } from '../context/AppContext.jsx';
import '../styles/welcome.css';

/* Phone sign-in: enter a number, get a texted code, enter it. A new number is
   signed up on the spot (the app then collects a name and runs the tour). */
export default function Phone() {
  const { startPhone, loginWithPhone } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('number'); // 'number' | 'code'
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const sendCode = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNote('');
    try {
      const res = await startPhone(phone);
      if (!res.sent && !res.devCode) {
        setError(res.message || 'Could not send a code right now.');
        return;
      }
      // Test mode (no SMS provider yet): the server hands back the code so the
      // flow is testable. Shown here only because the server chose to reveal it.
      if (res.devCode) setNote(`Test mode — your code is ${res.devCode}`);
      setStep('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await loginWithPhone(phone, code.trim());
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="wel wel-plain">
      <div className="wel-inner wel-inner-top">
        <Link to="/welcome" className="wel-back">
          <Icon name="left" size={18} /> Back
        </Link>

        <div className="wel-brand">
          <Wordmark size={30} />
        </div>

        {step === 'number' ? (
          <form className="wel-actions" onSubmit={sendCode}>
            <h1 className="wel-h1">Enter your phone number</h1>
            <p className="wel-sub">We&apos;ll text you a 6-digit code to sign in.</p>
            {error ? <div className="wel-error">{error}</div> : null}
            <input
              className="wel-input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="03xx xxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoFocus
            />
            <button type="submit" className="wel-btn wel-btn-primary" disabled={busy}>
              {busy ? <span className="spinner" /> : null}
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form className="wel-actions" onSubmit={verify}>
            <h1 className="wel-h1">Enter the code</h1>
            <p className="wel-sub">Sent to {phone}.</p>
            {note ? <div className="wel-note">{note}</div> : null}
            {error ? <div className="wel-error">{error}</div> : null}
            <input
              className="wel-input wel-input-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
            />
            <button type="submit" className="wel-btn wel-btn-primary" disabled={busy}>
              {busy ? <span className="spinner" /> : null}
              {busy ? 'Checking…' : 'Verify & continue'}
            </button>
            <button type="button" className="wel-btn wel-btn-ghost" onClick={() => { setStep('number'); setCode(''); setError(''); }} disabled={busy}>
              Change number
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
