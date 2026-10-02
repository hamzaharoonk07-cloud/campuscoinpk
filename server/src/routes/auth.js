import crypto from 'crypto';
import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import { protect, signToken, wrap } from '../middleware/auth.js';
import { sendMail, mailConfigured, screenResetLinkAllowed } from '../services/mailer.js';
import { cleanImage } from '../utils/images.js';
import { passwordProblem, isDemo, MAX_FAILED, LOCK_MINUTES } from '../utils/passwords.js';
import { siteUrl } from '../utils/site.js';
import { emailLayout } from '../services/emailTemplate.js';

const router = express.Router();

// What the client is allowed to see about the signed-in user.
const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  academicYear: user.academicYear,
  institution: user.institution,
  monthlyAllowance: user.monthlyAllowance,
  savingsGoal: user.savingsGoal,
  currency: user.currency,
  phone: user.phone,
  profileComplete: user.profileComplete,
  twoFactorEnabled: user.twoFactorEnabled,
  avatarColor: user.avatarColor,
  avatar: user.avatar,
  preferences: user.preferences,
  passwordChangedAt: user.passwordChangedAt,
  mustChangePassword: Boolean(user.mustChangePassword),
  isDemo: isDemo(user),
  createdAt: user.createdAt,
});

const PALETTE = ['#121214', '#22c55e', '#4ade80', '#f472b6', '#a78bfa', '#fb923c'];

/** Tells the account holder their password changed, in case it was not them. */
const notifyPasswordChanged = (user) =>
  sendMail({
    to: user.email,
    subject: 'Your Campus Coin password was changed',
    ...emailLayout({
      heading: 'Your password was changed',
      preheader: 'Every other device has been signed out.',
      paragraphs: [
        `Hi ${user.name.split(' ')[0]}, the password on your Campus Coin account was just changed, and every other device was signed out.`,
        'If this was you, there is nothing more to do.',
      ],
      button: { label: 'This was not me - reset it', url: `${siteUrl()}/forgot-password` },
      note: `Changed ${new Date().toUTCString()}.`,
    }),
  }).catch(() => {});

/**
 * Creates a one-hour, one-time password link for an account and emails it.
 * Only the SHA-256 hash of the token is stored, so a leaked database cannot
 * be used to set anyone's password. Used by "Forgot password" and by
 * "Change password" in Settings - a password only ever changes through a
 * link sent to the account's own inbox.
 * Returns { sent, link }.
 */
async function sendPasswordLink(user, { change = false } = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  user.resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
  user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // one hour
  await user.save();

  const link = `${siteUrl()}/reset-password?token=${token}`;
  const first = user.name.split(' ')[0];
  const result = await sendMail({
    to: user.email,
    subject: change ? 'Change your Campus Coin password' : 'Reset your Campus Coin password',
    ...emailLayout({
      heading: change ? 'Change your password' : 'Reset your password',
      preheader: 'This link works once, for one hour.',
      paragraphs: [
        change
          ? `Hi ${first}, you asked to change the password on your Campus Coin account. Use the button below to choose a new one.`
          : `Hi ${first}, someone asked to reset the password on your Campus Coin account. If it was you, choose a new one below.`,
        'Your transactions, budgets and settings stay exactly as they are.',
      ],
      button: { label: 'Choose a new password', url: link },
      note: 'The link works once and expires in one hour. If you did not ask for this, ignore this email - your password will not change.',
    }),
  });
  return { ...result, link };
}

/**
 * Generates a 6-digit code, stores only its SHA-256 hash (expires in 10
 * minutes) and emails it - shared by signing in with 2FA on and turning 2FA
 * on in the first place, since both are really "prove you can read this
 * inbox right now".
 */
async function sendTwoFactorCode(user, { verb = 'sign in' } = {}) {
  const code = String(crypto.randomInt(100000, 1000000));
  user.twoFactorCodeHash = crypto.createHash('sha256').update(code).digest('hex');
  user.twoFactorCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  return sendMail({
    to: user.email,
    subject: `Your Campus Coin code is ${code}`,
    ...emailLayout({
      heading: 'Your verification code',
      preheader: 'This code works once, for 10 minutes.',
      paragraphs: [`Hi ${user.name.split(' ')[0]}, use this code to ${verb}:`],
      stats: [{ label: 'Code', value: code }],
      note: 'The code expires in 10 minutes. If you did not ask for this, ignore this email.',
    }),
  });
}

/** Checks a submitted code against the stored hash, clearing it either way. */
function checkTwoFactorCode(user, code) {
  const valid =
    user.twoFactorCodeHash &&
    user.twoFactorCodeExpires &&
    user.twoFactorCodeExpires > new Date() &&
    user.twoFactorCodeHash === crypto.createHash('sha256').update(String(code || '')).digest('hex');
  user.twoFactorCodeHash = undefined;
  user.twoFactorCodeExpires = undefined;
  return valid;
}

router.post(
  '/register',
  wrap(async (req, res) => {
    const { name, email, phone, password, academicYear, institution, monthlyAllowance, savingsGoal, currency } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are all required' });
    }
    const problem = passwordProblem(password, { email, name });
    if (problem) return res.status(400).json({ message: problem });
    if (await User.findOne({ email: String(email).toLowerCase() })) {
      return res.status(409).json({ message: 'An account with that email already exists' });
    }

    const user = new User({
      name,
      email,
      phone: phone || '',
      academicYear: academicYear || '',
      institution: institution || '',
      monthlyAllowance: Number(monthlyAllowance) || 0,
      savingsGoal: Number(savingsGoal) || 0,
      currency: currency || 'PKR',
      avatarColor: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      // Students always register as students; the admin account is seeded.
      role: 'student',
      // Verified once, now, by a code to this address - unless the address
      // cannot receive one (a mail outage, or the reserved @campuscoin.app
      // test domain), in which case there is nothing to verify against.
      emailVerified: !(mailConfigured() && !/@campuscoin\.app$/i.test(String(email))),
    });
    await user.setPassword(password);
    await user.save();

    const first = String(name).trim().split(' ')[0];

    // Email verification: one code, now, at sign-up. No token yet - the
    // account exists but the client must confirm the code first
    // (POST /auth/verify-email), which is what issues the token.
    if (!user.emailVerified) {
      await sendTwoFactorCode(user, { verb: 'verify your email and finish signing up' });
      return res.status(201).json({ verifyRequired: true, userId: user._id });
    }

    // A welcome, sent without waiting so a slow mail server never holds up
    // sign-up. (Nothing is sent to the made-up campuscoin.app test addresses.)
    sendMail({
      to: user.email,
      subject: `Welcome to Campus Coin, ${first}`,
      ...emailLayout({
        heading: `Welcome to Campus Coin, ${first}!`,
        preheader: 'Three things to do first.',
        paragraphs: [`Hi ${first}, your account is ready. Here is how to get your first useful picture of the month:`],
        steps: [
          "Log this month's allowance, so the dashboard knows what came in.",
          'Add the last few things you bought - tea, a bus fare, printing. The category fills itself in.',
          'Set one budget on the category you spend most on. It is the change students actually keep to.',
        ],
        button: { label: 'Open your dashboard', url: `${siteUrl()}/dashboard` },
        note: 'Campus Coin never connects to your bank and never asks for card details.',
      }),
    }).catch(() => {});

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

/**
 * "Sign in with Google" - verifies the ID token Google Identity Services
 * handed the client, then signs in an existing account or creates a new
 * one. Verification (signature, issuer, audience, expiry) is done by
 * google-auth-library against Google's own current public keys, never by
 * trusting anything the client sent about who the user is.
 */
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

router.post(
  '/google',
  wrap(async (req, res) => {
    if (!googleClient) return res.status(503).json({ message: 'Google sign-in is not configured on this server' });
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: 'No Google credential was sent' });

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ message: 'That Google sign-in could not be verified' });
    }
    if (!payload?.email_verified) return res.status(401).json({ message: 'That Google account has no verified email' });

    let user = await User.findOne({ googleId: payload.sub });
    if (!user) {
      // An account already exists under this email from a normal
      // registration - link Google to it rather than making a second
      // account for the same person, by the same email.
      user = await User.findOne({ email: payload.email.toLowerCase() });
      if (user) {
        user.googleId = payload.sub;
      } else {
        user = new User({
          name: payload.name || payload.email.split('@')[0],
          email: payload.email,
          googleId: payload.sub,
          avatarColor: PALETTE[Math.floor(Math.random() * PALETTE.length)],
          role: 'student',
          profileComplete: false,
        });
      }
      await user.save();
    }
    if (user.disabled) return res.status(403).json({ message: 'This account has been disabled' });

    user.lastLoginAt = new Date();
    await user.save();
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

/**
 * The password check shared by the student and administrator sign-ins, with
 * the lockout: after MAX_FAILED wrong passwords in a row the account refuses
 * sign-in for LOCK_MINUTES. Returns the user, or sends the error and returns null.
 */
async function checkSignIn(req, res, { adminOnly = false } = {}) {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email || '').toLowerCase() }).select('+passwordHash +failedLogins +lockUntil');
  const wrong = adminOnly ? 'Those administrator credentials were not recognised' : 'That email and password do not match';

  if (user && user.lockUntil && user.lockUntil > new Date()) {
    const minutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
    res.status(429).json({ message: `Too many wrong passwords. This account is locked for ${minutes} more minute${minutes === 1 ? '' : 's'} - or reset the password to get in now.` });
    return null;
  }

  const ok = user && (!adminOnly || user.role === 'admin') && (await user.checkPassword(String(password || '')));
  if (!ok) {
    // Count the miss against a real account (never the shared demo ones).
    if (user && !isDemo(user)) {
      user.failedLogins = (user.failedLogins || 0) + 1;
      if (user.failedLogins >= MAX_FAILED) {
        user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60000);
        user.failedLogins = 0;
      }
      await user.save();
    }
    // The same message whether or not the email exists, so the form cannot be
    // used to find out which addresses have accounts.
    res.status(401).json({ message: wrong });
    return null;
  }
  if (user.disabled) {
    res.status(403).json({ message: 'This account has been disabled. Please contact an administrator.' });
    return null;
  }

  // Kept for the reply, so the welcome message can say when they were last here.
  user.$locals.previousLoginAt = user.lastLoginAt || null;
  user.failedLogins = 0;
  user.lockUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

router.post(
  '/login',
  wrap(async (req, res) => {
    const user = await checkSignIn(req, res);
    if (!user) return;
    // Email is verified once, at sign-up. If an account was created but never
    // finished that step (closed the tab on the code screen), it is caught
    // here on the next sign-in - but only then; a verified account is never
    // asked again. `=== false` on purpose: accounts that predate this field
    // read as undefined and are left alone, and the demo/seed accounts (which
    // cannot receive mail) are exempt too.
    const canReceiveCode = mailConfigured() && !/@campuscoin\.app$/i.test(user.email);
    if (user.emailVerified === false && canReceiveCode) {
      await sendTwoFactorCode(user, { verb: 'verify your email' });
      return res.json({ verifyRequired: true, userId: user._id });
    }
    res.json({ token: signToken(user), user: publicUser(user), previousLoginAt: user.$locals.previousLoginAt });
  })
);

/**
 * Confirms the sign-up email code, marks the address verified for good, and
 * issues the token. Reached from both the registration code screen and the
 * one-time catch at the next login if sign-up was abandoned on that screen.
 */
router.post(
  '/verify-email',
  wrap(async (req, res) => {
    const { userId, code } = req.body;
    const user = await User.findById(userId).select('+twoFactorCodeHash +twoFactorCodeExpires');
    if (!user || !checkTwoFactorCode(user, code)) {
      if (user) await user.save();
      return res.status(401).json({ message: 'That code is wrong or has expired' });
    }
    user.emailVerified = true;
    user.lastLoginAt = new Date();
    await user.save();
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

/**
 * The SRS asks for a separate, direct-access administrator login. It is the same
 * credential check with an extra role gate, so a student's password can never
 * open the admin panel even if they find the URL.
 */
router.post(
  '/admin/login',
  wrap(async (req, res) => {
    const user = await checkSignIn(req, res, { adminOnly: true });
    if (user) res.json({ token: signToken(user), user: publicUser(user) });
  })
);

router.get('/me', protect, (req, res) => res.json({ user: publicUser(req.user) }));

router.patch(
  '/me',
  protect,
  wrap(async (req, res) => {
    const fields = ['name', 'academicYear', 'institution', 'monthlyAllowance', 'savingsGoal', 'currency', 'avatarColor', 'phone', 'profileComplete'];
    for (const field of fields) {
      if (req.body[field] !== undefined) req.user[field] = req.body[field];
    }
    if (req.body.preferences) {
      req.user.preferences = { ...req.user.preferences.toObject(), ...req.body.preferences };
    }
    // null or '' removes the photo; anything else must be a small image.
    if (req.body.avatar !== undefined) {
      req.user.avatar = cleanImage(req.body.avatar, { maxKb: 150, label: 'Profile photo' });
    }
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  })
);

/** Starts turning two-step verification on: sends a code to prove the inbox is real. */
router.post(
  '/2fa/enable',
  protect,
  wrap(async (req, res) => {
    if (req.user.twoFactorEnabled) return res.json({ sent: false });
    await sendTwoFactorCode(req.user, { verb: 'turn on two-step verification' });
    res.json({ sent: true });
  })
);

/** Finishes turning it on, once the emailed code checks out. */
router.post(
  '/2fa/confirm',
  protect,
  wrap(async (req, res) => {
    const user = await User.findById(req.user._id).select('+twoFactorCodeHash +twoFactorCodeExpires');
    if (!checkTwoFactorCode(user, req.body.code)) {
      await user.save();
      return res.status(401).json({ message: 'That code is wrong or has expired' });
    }
    user.twoFactorEnabled = true;
    await user.save();
    res.json({ user: publicUser(user) });
  })
);

/** Turns two-step verification back off - the password alone is enough to do this. */
router.post(
  '/2fa/disable',
  protect,
  wrap(async (req, res) => {
    req.user.twoFactorEnabled = false;
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  })
);

/**
 * Creates (or rotates) this account's webhook key for automated SMS
 * forwarding (MacroDroid, Tasker, iOS Shortcuts). The raw key is returned
 * exactly once, here - only its hash is kept, so a lost key means
 * generating a new one, not recovering the old.
 */
router.post(
  '/webhook-key',
  protect,
  wrap(async (req, res) => {
    const key = crypto.randomBytes(24).toString('hex');
    req.user.webhookKeyHash = crypto.createHash('sha256').update(key).digest('hex');
    // Which SIM/bank this is for - the student's own label, not checked
    // against anything, so leaving it blank just means "unlabelled".
    if (req.body.phone !== undefined) req.user.webhookPhone = String(req.body.phone || '').trim().slice(0, 20);
    await req.user.save();
    res.json({ key, phone: req.user.webhookPhone });
  })
);

/** Whether a webhook key already exists, without exposing it again. */
router.get(
  '/webhook-key',
  protect,
  wrap(async (req, res) => {
    const user = await User.findById(req.user._id).select('+webhookKeyHash');
    res.json({ active: Boolean(user.webhookKeyHash), phone: user.webhookPhone || '' });
  })
);

/** Relabels which SIM/bank the webhook is for, without rotating the key. */
router.patch(
  '/webhook-key',
  protect,
  wrap(async (req, res) => {
    req.user.webhookPhone = String(req.body.phone || '').trim().slice(0, 20);
    await req.user.save();
    res.json({ phone: req.user.webhookPhone });
  })
);

/**
 * Change password while signed in. The password is never changed here
 * directly: this emails a one-time link to the account's own address, so
 * only someone who can read that inbox can set a new password - a stolen
 * session alone is not enough.
 */
router.post(
  '/password-link',
  protect,
  wrap(async (req, res) => {
    if (isDemo(req.user)) {
      return res.status(403).json({ message: 'The demo account keeps its published password so everyone can use it. Register your own account to try this.' });
    }
    const user = await User.findById(req.user._id).select('+resetTokenHash +resetTokenExpires');
    const sent = await sendPasswordLink(user, { change: true });
    const inbox = user.email.replace(/^(.).*(@.*)$/, '$1•••$2');
    if (sent.sent) return res.json({ sent: true, message: `A link to change your password is on its way to ${inbox}.` });
    if (!sent.failed && screenResetLinkAllowed()) {
      return res.json({ sent: false, devResetLink: sent.link, message: 'Email is not set up on this machine, so the link is shown here instead.' });
    }
    res.status(502).json({ message: 'The email could not be sent. Please try again in a minute.' });
  })
);

/** The old in-place change is closed: a password only changes through a link. */
router.post('/change-password', protect, (req, res) =>
  res.status(410).json({ message: 'Passwords now change through a link sent to your email. Use "Email me a link" in Settings.' })
);

/** Signs out every other device by raising the session version. */
router.post(
  '/logout-all',
  protect,
  wrap(async (req, res) => {
    if (isDemo(req.user)) {
      return res.status(403).json({ message: 'The demo account is shared, so it cannot sign everyone else out.' });
    }
    req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
    await req.user.save();
    res.json({ message: 'Every other device has been signed out', token: signToken(req.user) });
  })
);

/**
 * Password recovery. A random token is emailed; only its hash is stored, so a
 * leaked database cannot be used to reset anyone's password.
 */
router.post(
  '/forgot-password',
  wrap(async (req, res) => {
    const email = String(req.body.email || '').toLowerCase();
    const user = await User.findOne({ email });

    // Always the same reply, so this endpoint cannot enumerate accounts.
    const reply = { message: 'If that email has an account, a reset link is on its way.' };
    if (!user) return res.json(reply);
    if (isDemo(user)) {
      return res.json({ ...reply, note: 'The demo accounts keep their published passwords, so no link is sent for them.' });
    }

    const sent = await sendPasswordLink(user);
    const link = sent.link;

    if (sent.sent) return res.json(reply);
    // On a development machine with no email set up, the link comes back in
    // the response so the flow can still be demonstrated. Never on the live
    // site: there, showing it would let anyone reset any account.
    if (!sent.failed && screenResetLinkAllowed()) {
      return res.json({ ...reply, devResetLink: link, note: 'Email is not set up on this machine, so the link is shown here instead.' });
    }
    res.json(reply);
  })
);

/** Checks a reset link before the form is shown, so an expired one says so up front. */
router.get(
  '/reset-password/check',
  wrap(async (req, res) => {
    const hash = crypto.createHash('sha256').update(String(req.query.token || '')).digest('hex');
    const user = await User.findOne({ resetTokenHash: hash, resetTokenExpires: { $gt: new Date() } }).select('+resetTokenHash +resetTokenExpires');
    res.json({ valid: Boolean(user), email: user ? user.email.replace(/^(.).*(@.*)$/, '$1•••$2') : null });
  })
);

router.post(
  '/reset-password',
  wrap(async (req, res) => {
    const { token, password } = req.body;
    const hash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
    const user = await User.findOne({ resetTokenHash: hash, resetTokenExpires: { $gt: new Date() } }).select(
      '+passwordHash +resetTokenHash +resetTokenExpires +failedLogins +lockUntil'
    );
    if (!user) return res.status(400).json({ message: 'That reset link is invalid or has expired' });

    const problem = passwordProblem(password, user);
    if (problem) return res.status(400).json({ message: problem });

    await user.setPassword(password);
    // The link works once, and a reset also lifts any sign-in lock.
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;
    user.failedLogins = 0;
    user.lockUntil = undefined;
    user.mustChangePassword = false;
    await user.save();
    notifyPasswordChanged(user);

    res.json({ token: signToken(user), user: publicUser(user), message: 'Your password has been reset' });
  })
);

router.get('/mail-status', (req, res) => res.json({ configured: mailConfigured() }));

/** Whether Google sign-in is set up, and the client ID to render the button
 *  with - public by design, the same way any OAuth client ID is. */
router.get('/google-status', (req, res) => res.json({ configured: Boolean(googleClient), clientId: process.env.GOOGLE_CLIENT_ID || null }));

export { publicUser };
export default router;
