import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import Avatar from '../components/Avatar.jsx';
import { squarePhoto } from '../lib/images.js';
import { api, setToken } from '../lib/api.js';
import { artUrl } from '../components/Illustrations.jsx';
import { CURRENCY_SYMBOLS, formatDate } from '../lib/format.js';
import { StudyOptions, studyLabel } from '../lib/study.jsx';
import { useAuth, useTheme, useToast } from '../context/AppContext.jsx';
import { isNative, smsStatus, smsRequestPermission, smsConfigure, smsSetEnabled } from '../lib/smsForwarder.js';
import { startFeatureTour } from '../components/FeatureGuide.jsx';

const SCALES = [
  { value: 0.875, label: 'Small' },
  { value: 1, label: 'Default' },
  { value: 1.125, label: 'Large' },
  { value: 1.375, label: 'Largest' },
];

/**
 * The webhook key for automatic SMS logging. Shown exactly once, right after
 * it is generated - the server only ever keeps its hash, so there is no
 * "reveal it again" later, only "generate a new one".
 */
/**
 * Only real inside the Android app build: turns on the native SMS listener
 * (android/.../SmsReceiver.java), which catches bank SMS directly with no
 * MacroDroid or any other app involved. One tap generates a fresh webhook
 * key (same kind MacroDroid users paste by hand), hands it straight to the
 * native plugin, asks for the SMS permission, and switches it on.
 */
function NativeSmsSetup() {
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNative()) smsStatus().then(setStatus).catch(() => {});
  }, []);

  if (!isNative()) return null;

  const setUp = async () => {
    setBusy(true);
    try {
      const url = `${window.location.origin}/api/webhook/sms`;
      const { key } = await api.post('/auth/webhook-key', {});
      await smsConfigure(url, key);
      const result = await smsRequestPermission();
      if (!result.granted) {
        toast.error('Permission needed', 'Allow SMS access for this to work.');
        setStatus(result);
        return;
      }
      await smsSetEnabled(true);
      setStatus({ ...result, enabled: true, configured: true });
      toast.success('Done', 'Bank SMS will now log automatically, with the app closed.');
    } catch (err) {
      toast.error('Could not set this up', err.message);
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const result = await smsSetEnabled(false);
      setStatus(result);
    } finally {
      setBusy(false);
    }
  };

  if (status?.enabled) {
    return (
      <div className="security-row">
        <span>
          <strong>On for this phone</strong>
          <small>Bank SMS logs automatically - no MacroDroid, no app to open.</small>
        </span>
        <button type="button" className="btn btn-sm" onClick={turnOff} disabled={busy}>
          Turn off
        </button>
      </div>
    );
  }

  return (
    <div className="security-row">
      <span>
        <strong>Set up on this phone</strong>
        <small>Skip MacroDroid entirely - one tap, using the app you're in right now.</small>
      </span>
      <button type="button" className="btn btn-primary btn-sm" onClick={setUp} disabled={busy}>
        {busy ? 'Setting up…' : 'Turn on'}
      </button>
    </div>
  );
}

function WebhookKey() {
  const toast = useToast();
  const [active, setActive] = useState(null);
  const [key, setKey] = useState('');
  const [phone, setPhone] = useState('');
  const [savedPhone, setSavedPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    api
      .get('/auth/webhook-key')
      .then((d) => {
        setActive(d.active);
        setPhone(d.phone || '');
        setSavedPhone(d.phone || '');
      })
      .catch(() => {});
  }, []);

  const url = `${window.location.origin}/api/webhook/sms`;

  const generate = async () => {
    setBusy(true);
    try {
      const { key: newKey, phone: savedKeyPhone } = await api.post('/auth/webhook-key', { phone });
      setKey(newKey);
      setActive(true);
      setSavedPhone(savedKeyPhone || '');
      toast.success('Key generated - copy it now, it will not be shown again');
    } catch (err) {
      toast.error('Could not generate a key', err.message);
    } finally {
      setBusy(false);
    }
  };

  const savePhone = async () => {
    setSavingPhone(true);
    try {
      const { phone: saved } = await api.patch('/auth/webhook-key', { phone });
      setSavedPhone(saved || '');
      toast.success('Label saved');
    } catch (err) {
      toast.error('Could not save that', err.message);
    } finally {
      setSavingPhone(false);
    }
  };

  const copy = (text) => {
    navigator.clipboard?.writeText(text);
    toast.success('Copied');
  };

  return (
    <div className="webhook-key">
      <p className="security-note" style={{ marginBottom: '1rem' }}>
        <Icon name="bell" size={16} />
        What this does: when a bank SMS arrives on your phone, it gets logged here automatically, with no app to
        open. Campus Coin itself cannot read your SMS (no website can) - a small automation app on your phone has to
        forward the message here. MacroDroid is the easiest free one. Steps: 1) install MacroDroid, 2) make a rule
        "When SMS received → HTTP Request", 3) paste the URL and key below into it.
      </p>
      <a
        className="btn btn-sm"
        href="https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid"
        target="_blank"
        rel="noreferrer"
        style={{ marginBottom: '1rem', display: 'inline-flex' }}
      >
        <Icon name="download" size={14} />
        Get MacroDroid
      </a>

      <div className="webhook-field">
        <label>Which SIM or bank is this for?</label>
        <div className="webhook-copy-row">
          <input
            placeholder="e.g. 0300-1234567 (HBL)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
            style={{ flex: 1, border: 0, background: 'transparent', font: 'inherit', color: 'inherit' }}
          />
          {active && phone !== savedPhone ? (
            <button type="button" className="btn btn-sm" onClick={savePhone} disabled={savingPhone}>
              {savingPhone ? 'Saving…' : 'Save'}
            </button>
          ) : null}
        </div>
        <p className="security-note is-quiet" style={{ marginTop: '0.3rem' }}>
          A label for your own reference if you have more than one SIM or bank - not checked against the sender, since
          the key is already what proves the message is yours.
        </p>
      </div>

      <div className="webhook-field">
        <label>Webhook URL</label>
        <div className="webhook-copy-row">
          <code>{url}</code>
          <button type="button" className="btn btn-sm" onClick={() => copy(url)}>
            Copy
          </button>
        </div>
      </div>

      {key ? (
        <div className="webhook-field">
          <label>Your key (shown once)</label>
          <div className="webhook-copy-row">
            <code>{key}</code>
            <button type="button" className="btn btn-sm" onClick={() => copy(key)}>
              Copy
            </button>
          </div>
        </div>
      ) : null}

      <button type="button" className="btn btn-primary btn-sm" onClick={generate} disabled={busy}>
        <Icon name="repeat" size={14} />
        {busy ? 'Generating…' : active ? 'Generate a new key' : 'Generate a key'}
      </button>
      {active && !key ? <p className="security-note is-quiet">A key is already active. Generating a new one replaces it.</p> : null}

      <p className="security-note is-quiet" style={{ marginTop: '0.75rem' }}>
        Send a POST request to the URL above with JSON body <code>{'{'}"key": "…", "text": "…"{'}'}</code>
        (the pasted SMS) - a MacroDroid "HTTP Request" action or a Tasker/Shortcuts HTTP step both do this.
      </p>
    </div>
  );
}

/**
 * Email verification note. Verification happens once, at sign-up (a code to
 * the address), not on every sign-in - this just confirms the state. The
 * shared demo accounts on @campuscoin.app have no real inbox, so they are
 * created already verified.
 */
function TwoFactorToggle() {
  const { user } = useAuth();
  return (
    <div className="security-row">
      <span>
        <strong>Email {user.isDemo ? 'verification' : 'verified'}</strong>
        <small>
          {user.isDemo
            ? 'This shared demo account has no real inbox, so it skips email verification.'
            : `${user.email} was verified by a code when you signed up. You will not be asked again.`}
        </small>
      </span>
    </div>
  );
}

export default function Settings() {
  const { user, updateProfile } = useAuth();
  const { theme, setTheme, fontScale, setFontScale } = useTheme();
  const toast = useToast();

  const [profile, setProfile] = useState({
    name: user.name,
    phone: user.phone || '',
    academicYear: user.academicYear || '',
    institution: user.institution || '',
    monthlyAllowance: user.monthlyAllowance || 0,
    savingsGoal: user.savingsGoal || 0,
    currency: user.currency,
  });
  // The password link: null, 'sending', or the server's reply once sent.
  const [pwLink, setPwLink] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => setProfile({ ...profile, [key]: event.target.value });

  // Profile photo: cropped square and shrunk to about 20 KB in the browser
  // (lib/images.js), then saved straight away - no separate save button.
  const photoInput = useRef(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const applyPhoto = async (file) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      await updateProfile({ avatar: await squarePhoto(file) });
      toast.success('Photo updated', 'It now shows in the sidebar and the chat.');
    } catch (err) {
      toast.error('Could not use that picture', err.message);
    } finally {
      setPhotoBusy(false);
      if (photoInput.current) photoInput.current.value = '';
    }
  };

  const removePhoto = async () => {
    try {
      await updateProfile({ avatar: null });
      toast.success('Photo removed');
    } catch (err) {
      toast.error('Could not remove it', err.message);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await updateProfile({
        ...profile,
        monthlyAllowance: Number(profile.monthlyAllowance) || 0,
        savingsGoal: Number(profile.savingsGoal) || 0,
      });
      toast.success('Profile saved');
    } catch (err) {
      toast.error('Could not save your profile', err.message);
    } finally {
      setBusy(false);
    }
  };

  // Accessibility choices are saved to the account too, so they follow the
  // student to a different device rather than living only in this browser.
  const savePreferences = async (next) => {
    try {
      await updateProfile({ preferences: { ...user.preferences, ...next } });
    } catch {
      /* the local change already applied; the server copy can wait */
    }
  };

  // A password never changes here directly: this emails a one-time link to
  // the account's own inbox, and the new password is chosen from that link.
  const emailPasswordLink = async () => {
    setPwLink('sending');
    try {
      const reply = await api.post('/auth/password-link', {});
      setPwLink(reply);
    } catch (err) {
      setPwLink(null);
      toast.error('Could not send the link', err.message);
    }
  };

  const signOutEverywhere = async () => {
    try {
      const data = await api.post('/auth/logout-all', {});
      setToken(data.token);
      toast.success('Signed out everywhere else', 'This device stays signed in.');
    } catch (err) {
      toast.error('Could not sign the other devices out', err.message);
    }
  };

  return (
    <Layout
      title="Account settings"
      crumbs={
        <>
          <Link to="/dashboard">Dashboard</Link> / <span>Settings</span>
        </>
      }
    >
      {/* The account at a glance, with a way to each section below. */}
      <section className="acct-card">
        <Avatar user={user} size={64} />
        <span className="acct-who">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
          <small>
            {user.isDemo ? 'Shared demo account' : 'Student account'}
            {user.academicYear ? ` · ${studyLabel(user.academicYear)}` : ''}
            {user.institution ? ` · ${user.institution}` : ''}
            {user.createdAt ? ` · member since ${formatDate(user.createdAt, { month: 'long', year: 'numeric' })}` : ''}
          </small>
        </span>
        <nav className="acct-jump" aria-label="Settings sections">
          <a href="#profile">
            <Icon name="user" size={15} /> Profile
          </a>
          <a href="#display">
            <Icon name="sun" size={15} /> Display
          </a>
          <a href="#password">
            <Icon name="key" size={15} /> Password
          </a>
        </nav>
      </section>

      <section className="panel">
        <div className="panel-body security-row">
          <span>
            <strong>Core features</strong>
            <small>Phrase entry, automatic SMS logging, budgets, udhaar and insights - a quick tour of each.</small>
          </span>
          <button type="button" className="btn btn-sm" onClick={startFeatureTour}>
            <Icon name="spark" size={14} />
            Take the tour
          </button>
        </div>
      </section>

      <div className="grid grid-2">
        <section className="panel" id="profile">
          <div className="panel-head">
            <h2>Your profile</h2>
          </div>
          <div className="panel-body">
            <div
              className={`photo-picker${dragging ? ' is-dragging' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                applyPhoto(e.dataTransfer.files[0]);
              }}
            >
              <button
                type="button"
                className="photo-face"
                onClick={() => photoInput.current?.click()}
                aria-label="Choose a profile photo"
                disabled={photoBusy}
              >
                <Avatar user={user} size={92} />
                <span className="photo-badge">{photoBusy ? <span className="spinner" /> : <Icon name="upload" size={15} />}</span>
              </button>
              <div className="photo-copy">
                <strong>Profile photo</strong>
                <p className="small muted">
                  Click the picture or drop one on it. It is cropped to a square and shrunk before it is uploaded.
                </p>
                <div className="row">
                  <button type="button" className="btn btn-sm" onClick={() => photoInput.current?.click()} disabled={photoBusy}>
                    <Icon name="upload" size={14} />
                    {user.avatar ? 'Change photo' : 'Upload photo'}
                  </button>
                  {user.avatar ? (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={removePhoto} disabled={photoBusy}>
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
              <input
                ref={photoInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => applyPhoto(e.target.files[0])}
              />
            </div>

            <form className="stack" onSubmit={saveProfile}>
              <div className="field">
                <label htmlFor="name">Name</label>
                <input id="name" required value={profile.name} onChange={set('name')} />
              </div>

              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" value={user.email} disabled />
                <span className="small muted">Your email is how you sign in and cannot be changed here.</span>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="year">Where you study</label>
                  <select id="year" value={profile.academicYear} onChange={set('academicYear')}>
                    <option value="">Prefer not to say</option>
                    <StudyOptions />
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="currency">Currency</label>
                  <select id="currency" value={profile.currency} onChange={set('currency')}>
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
                <input id="institution" value={profile.institution} onChange={set('institution')} />
              </div>

              <div className="field">
                <label htmlFor="phone">Phone number</label>
                <input id="phone" type="tel" value={profile.phone} onChange={set('phone')} required />
                <span className="small muted">Required on every account.</span>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="allowance">Monthly allowance</label>
                  <input id="allowance" type="number" min="0" value={profile.monthlyAllowance} onChange={set('monthlyAllowance')} />
                </div>
                <div className="field">
                  <label htmlFor="goal">Monthly savings goal</label>
                  <input id="goal" type="number" min="0" value={profile.savingsGoal} onChange={set('savingsGoal')} />
                </div>
              </div>
              <span className="small muted">
                Your savings goal is what the tips measure against, so it is worth setting honestly.
              </span>

              <button type="submit" className="btn btn-primary" disabled={busy}>
                Save profile
              </button>
            </form>
          </div>
        </section>

        <div className="stack">
          <section className="panel" id="display">
            <div className="panel-head">
              <h2>Reading and display</h2>
            </div>
            <div className="panel-body stack">
              <div className="field">
                <label>Theme</label>
                <div className="seg" role="group" aria-label="Theme">
                  {['light', 'dark', 'system'].map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={theme === option}
                      onClick={() => {
                        setTheme(option);
                        savePreferences({ theme: option });
                      }}
                    >
                      {option === 'system' ? 'Match device' : option === 'light' ? 'Light' : 'Dark'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>Text size</label>
                <div className="seg" role="group" aria-label="Text size">
                  {SCALES.map((scale) => (
                    <button
                      key={scale.value}
                      type="button"
                      aria-pressed={fontScale === scale.value}
                      onClick={() => {
                        setFontScale(scale.value);
                        savePreferences({ fontScale: scale.value });
                      }}
                    >
                      {scale.label}
                    </button>
                  ))}
                </div>
                <span className="small muted">Everything on the page scales together, including the charts.</span>
              </div>

              <label className="check">
                <input
                  type="checkbox"
                  checked={user.preferences?.alertsEnabled !== false}
                  onChange={(e) => savePreferences({ alertsEnabled: e.target.checked })}
                />
                Tell me when a budget is close or broken
              </label>
            </div>
          </section>

          <section className="panel" id="password">
            <div className="panel-head">
              <h2>Password and security</h2>
              <span className="panel-note">
                {user.passwordChangedAt ? `Changed ${formatDate(user.passwordChangedAt, { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Set when you registered'}
              </span>
            </div>
            <div className="panel-body">
              {user.mustChangePassword ? (
                <div className="form-error" style={{ marginBottom: '1rem' }}>
                  You signed in with a temporary password from an administrator. Email yourself a link below and choose your own.
                </div>
              ) : null}
              {user.isDemo ? (
                <p className="security-note">
                  <Icon name="shield" size={16} />
                  This is the shared demo account, so its password stays as published. Register your own account to try
                  changing a password.
                </p>
              ) : null}
              <div className="pw-link">
                <span className="pw-link-art" aria-hidden="true">
                  <img src={artUrl('envelope')} alt="" width="34" height="34" />
                </span>
                <span className="pw-link-copy">
                  <strong>Change your password</strong>
                  <small>
                    For your safety, a password only changes through a link sent to {user.email}. Open it within the
                    hour to choose a new one.
                  </small>
                </span>
              </div>
              {pwLink && pwLink !== 'sending' ? (
                <div className="pw-link-sent" role="status">
                  <Icon name="check" size={16} strokeWidth={2.4} />
                  <span>
                    {pwLink.message}
                    {pwLink.devResetLink ? (
                      <>
                        {' '}
                        <Link to={pwLink.devResetLink.replace(/^.*?\/\/[^/]+/, '')}>Open the link</Link>
                      </>
                    ) : (
                      ' Check your inbox (and the spam folder).'
                    )}
                  </span>
                </div>
              ) : null}
              <button
                type="button"
                className="btn btn-primary pw-link-btn"
                onClick={emailPasswordLink}
                disabled={user.isDemo || pwLink === 'sending'}
              >
                <Icon name="mail" size={15} />
                {pwLink === 'sending' ? 'Sending' : pwLink ? 'Send another link' : 'Email me a link'}
              </button>

              <TwoFactorToggle />

              <div className="security-row">
                <span>
                  <strong>Signed in somewhere else?</strong>
                  <small>Ends every other session - a lab computer, an old phone. This device stays signed in.</small>
                </span>
                <button type="button" className="btn btn-sm" onClick={signOutEverywhere} disabled={user.isDemo}>
                  <Icon name="logout" size={14} />
                  Sign out everywhere
                </button>
              </div>
              <p className="security-note is-quiet">
                <Icon name="shield" size={16} />
                Passwords are stored only as salted bcrypt hashes. Five wrong tries lock sign-in for 15 minutes.
              </p>
            </div>
          </section>

          <section className="panel" id="webhook">
            <div className="panel-head">
              <h2>Log transactions from bank SMS automatically</h2>
              <span className="panel-note">5-minute setup, once</span>
            </div>
            <div className="panel-body">
              <NativeSmsSetup />
              <WebhookKey />
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
