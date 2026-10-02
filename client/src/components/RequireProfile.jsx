import { useState } from 'react';
import { IconField } from '../pages/Login.jsx';
import { BrandMark } from './Icon.jsx';
import { CURRENCY_SYMBOLS } from '../lib/format.js';
import { StudyOptions } from '../lib/study.jsx';
import { useAuth, useToast } from '../context/AppContext.jsx';

/* ---------------------------------------------------------------------------
   The "finish your account" gate.

   Protected (App.jsx) renders this instead of the page a signed-in student
   asked for whenever something required is still missing:
     - `phone` - every account needs one on file now, including one made
       before this field existed.
     - `profileComplete` - false only for a Google sign-up, which skips the
       ordinary registration form entirely (year, institution, allowance,
       goal) - this is that same form, shown once, after the fact instead of
       before.
   Submitting updates the context's user object, so Protected's own next
   render lets the real page through - no separate "done" flag to clear.
--------------------------------------------------------------------------- */

export default function RequireProfile() {
  const { user, updateProfile, logout } = useAuth();
  const toast = useToast();
  const needsPhone = !user.phone;
  const needsProfile = !user.profileComplete;

  const [form, setForm] = useState({
    phone: user.phone || '',
    academicYear: user.academicYear || '',
    institution: user.institution || '',
    monthlyAllowance: user.monthlyAllowance || '',
    savingsGoal: user.savingsGoal || '',
    currency: user.currency || 'PKR',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    const phone = form.phone.trim();
    if (needsPhone && phone.length < 7) {
      setError('Enter a real phone number');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await updateProfile({
        phone,
        ...(needsProfile
          ? {
              academicYear: form.academicYear,
              institution: form.institution,
              monthlyAllowance: Number(form.monthlyAllowance) || 0,
              savingsGoal: Number(form.savingsGoal) || 0,
              currency: form.currency,
              profileComplete: true,
            }
          : {}),
      });
      toast.success('Thanks', 'Your details are saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth auth-solo">
      <div className="auth-form-side">
        <div className="auth-sheet">
          <form className="auth-form" onSubmit={submit}>
            <div className="auth-head">
              <span className="auth-mark">
                <BrandMark size={36} />
              </span>
              <span className="eyebrow">One more thing</span>
              <h1>Finish setting up your account</h1>
              <p>
                {needsProfile
                  ? "Signing in with Google skips our usual signup form - a couple of quick details and you're in."
                  : 'We need a contact number on file before you can continue - this covers accounts made before we asked, too.'}
              </p>
            </div>
            {error ? <div className="form-error">{error}</div> : null}

            {needsPhone ? (
              <IconField
                id="phone"
                label="Phone number"
                icon="chat"
                type="tel"
                placeholder="03xx xxxxxxx"
                autoComplete="tel"
                required
                value={form.phone}
                onChange={set('phone')}
              />
            ) : null}

            {needsProfile ? (
              <>
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
                <span className="small muted">Both are optional and easy to change later in Settings.</span>
              </>
            ) : null}

            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={busy}>
              {busy ? <span className="spinner" /> : null}
              {busy ? 'Saving' : 'Continue'}
            </button>
            <button type="button" className="btn btn-block" onClick={logout} disabled={busy}>
              Sign out instead
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
