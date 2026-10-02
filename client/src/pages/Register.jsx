import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthAside, AuthTop, IconField } from './Login.jsx';
import { BrandMark } from '../components/Icon.jsx';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import PasswordStrength from '../components/PasswordStrength.jsx';
import { CURRENCY_SYMBOLS } from '../lib/format.js';
import { StudyOptions } from '../lib/study.jsx';
import { passwordOk } from '../lib/password.js';
import { useAuth } from '../context/AppContext.jsx';


export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
    academicYear: '',
    institution: '',
    monthlyAllowance: '',
    savingsGoal: '',
    currency: 'PKR',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    if (!passwordOk(form.password, form)) {
      setError('Your password does not meet the rules under it yet');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Those two passwords do not match');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { confirm, ...details } = form;
      await register({
        ...details,
        monthlyAllowance: Number(form.monthlyAllowance) || 0,
        savingsGoal: Number(form.savingsGoal) || 0,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <AuthAside
        title="Start this month,"
        highlight="know it by the next."
        lead="Two minutes to set up. Add your allowance and a savings goal if you have one, and every chart, budget and tip is built from your own numbers from then on."
      />
      <div className="auth-form-side">
        <AuthTop>
          <span className="auth-top-note">
            Have an account?
            <Link to="/login" className="btn btn-sm">
              Sign in
            </Link>
          </span>
        </AuthTop>
        {/* On a phone this becomes the white sheet, as on sign-in. */}
        <div className="auth-sheet">
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-head">
            <span className="auth-mark">
              <BrandMark size={36} />
            </span>
            <span className="eyebrow">Get started</span>
            <h1>Create your account</h1>
            <p>Free, and no bank details, ever.</p>
          </div>
          {error ? <div className="form-error">{error}</div> : null}

          <IconField id="name" label="Your name" icon="user" required value={form.name} onChange={set('name')} autoComplete="name" />

          <IconField
            id="email"
            label="Email"
            icon="mail"
            type="email"
            placeholder="you@university.edu"
            required
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
          />

          <IconField
            id="phone"
            label="Phone number"
            icon="chat"
            type="tel"
            placeholder="03xx xxxxxxx"
            required
            value={form.phone}
            onChange={set('phone')}
            autoComplete="tel"
          />

          <IconField
            id="password"
            label="Password"
            icon="key"
            type="password"
            placeholder="At least 8 characters"
            required
            minLength={8}
            value={form.password}
            onChange={set('password')}
            autoComplete="new-password"
          />

          <IconField
            id="confirm"
            label="Confirm password"
            icon="key"
            type="password"
            required
            value={form.confirm}
            onChange={set('confirm')}
            autoComplete="new-password"
          />
          {form.password ? <PasswordStrength password={form.password} confirm={form.confirm} email={form.email} name={form.name} /> : null}

          <div className="field-row">
            <div className="field">
              <label htmlFor="year">Where you study</label>
              <select id="year" value={form.academicYear} onChange={set('academicYear')}>
                <option value="">Prefer not to say</option>
                <StudyOptions />
              </select>
            </div>
            <div className="field">
              <label htmlFor="currency">Currency</label>
              <select id="currency" value={form.currency} onChange={set('currency')}>
                {Object.keys(CURRENCY_SYMBOLS).map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="institution">School, college or university</label>
            <input id="institution" value={form.institution} onChange={set('institution')} />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="allowance">Monthly allowance</label>
              <input id="allowance" type="number" min="0" value={form.monthlyAllowance} onChange={set('monthlyAllowance')} />
            </div>
            <div className="field">
              <label htmlFor="goal">Monthly savings goal</label>
              <input id="goal" type="number" min="0" value={form.savingsGoal} onChange={set('savingsGoal')} />
            </div>
          </div>
          <span className="small muted">
            Both are optional and easy to change later. They only shape the advice you get.
          </span>

          <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={busy}>
            {busy ? <span className="spinner" /> : null}
            {busy ? 'Creating' : 'Create account'}
          </button>

          <p className="auth-alt">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>

        <GoogleSignInButton />
        </div>
      </div>
    </div>
  );
}
