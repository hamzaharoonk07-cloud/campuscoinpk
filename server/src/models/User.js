import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { STUDY_LEVELS } from '../utils/study.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 80 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Enter a valid email address'],
    },
    // Not required: a Google account has nothing to hash here until (if
    // ever) the student sets a password of their own - checkPassword simply
    // fails closed for an account that doesn't have one yet.
    passwordHash: { type: String, select: false },
    role: { type: String, enum: ['student', 'admin'], default: 'student', index: true },

    // Set only for an account created or linked through "Sign in with
    // Google" - Google's own stable per-account identifier, separate from
    // email (which a student could change on Google's side).
    googleId: { type: String, index: true, sparse: true, unique: true },
    // A Google sign-up skips the usual registration form (year, institution,
    // allowance, goal), so it is created with this false; RequireProfile on
    // the client blocks the app until those are filled in once, the same way
    // the ordinary signup form already asks for them up front.
    profileComplete: { type: Boolean, default: true },
    // Confirmed once, at sign-up, by a code emailed to this address. A Google
    // sign-up is already verified by Google, and the seeded/demo accounts are
    // created verified; only a normal email/password sign-up starts false.
    emailVerified: { type: Boolean, default: true },

    // Profile fields from the SRS (section 1.6, "User Authentication and Management")
    // School, college, university or postgraduate year (utils/study.js).
    academicYear: { type: String, enum: STUDY_LEVELS, default: '' },
    institution: { type: String, trim: true, maxlength: 120, default: '' },
    monthlyAllowance: { type: Number, default: 0, min: 0 },
    savingsGoal: { type: Number, default: 0, min: 0 },
    currency: {
      type: String,
      enum: [
        'PKR', 'USD', 'EUR', 'GBP', 'INR', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD',
        'JPY', 'CNY', 'HKD', 'SGD', 'KRW', 'MYR', 'THB', 'IDR', 'PHP', 'VND', 'BDT', 'LKR',
        'NPR', 'AFN', 'AUD', 'CAD', 'NZD', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF',
        'RON', 'TRY', 'RUB', 'UAH', 'ZAR', 'NGN', 'KES', 'GHS', 'EGP', 'MAD', 'TZS', 'UGX',
        'BRL', 'MXN', 'ARS', 'CLP', 'COP',
      ],
      default: 'PKR',
    },
    avatarColor: { type: String, default: '#121214' },
    // The student's own contact number, required of every account (even one
    // created before this was added, and even a Google sign-in, which gives
    // no phone number of its own) - the app gates on this being empty rather
    // than trusting signup alone, since old accounts predate the field.
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    // The verified phone number for phone-OTP accounts, in +E.164 form. Sparse +
    // unique so it is the login handle for these accounts while email/Google
    // accounts (which never set it) are untouched. Distinct from `phone` above,
    // which is an unverified profile field any account may carry.
    authPhone: { type: String, trim: true, maxlength: 24, index: true, sparse: true, unique: true },
    // An optional profile photo as a small data URL (see utils/images.js).
    // The coloured initial is shown whenever this is empty.
    avatar: { type: String, default: '' },

    // Accessibility preferences (SRS "Accessibility and UI Enhancements")
    preferences: {
      theme: { type: String, enum: ['dark', 'light', 'system'], default: 'light' },
      fontScale: { type: Number, default: 1, min: 0.875, max: 1.375 },
      reducedMotion: { type: Boolean, default: false },
      alertsEnabled: { type: Boolean, default: true },
    },

    disabled: { type: Boolean, default: false },
    lastLoginAt: Date,

    // Password reset: only the hash of the token is stored, never the token itself.
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },

    // Two-step verification (opt-in, Settings > Security): a 6-digit code
    // emailed at login, after the password already checked out. Same
    // hash-only pattern as the reset token above - only its hash is stored,
    // and it is also reused (with the same two fields) while a student is
    // turning the feature on, to prove they can actually read that inbox.
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorCodeHash: { type: String, select: false },
    twoFactorCodeExpires: { type: Date, select: false },

    // Webhook automation (SRS brief, "Automation app + webhook"): a long-lived
    // key a phone-side forwarder (MacroDroit, Tasker, iOS Shortcuts) sends with
    // each bank SMS it relays, since that caller can't do a normal sign-in.
    // Same pattern as the reset token above - only its hash is stored, the
    // real key is shown once, at generation.
    webhookKeyHash: { type: String, select: false },
    // Which SIM/bank the forwarded SMS actually comes from - a label for the
    // student's own reference (a multi-SIM phone, more than one bank), not
    // something the webhook route checks against the sender.
    webhookPhone: { type: String, trim: true, maxlength: 20, default: '' },

    // Web Push subscriptions (Push API). One entry per browser/device the
    // student has turned notifications on for - the same account on a phone and
    // a laptop keeps two. Each is the raw PushSubscription the browser hands us
    // (endpoint + the p256dh/auth keys web-push signs with); a dead one (the
    // browser returns 404/410) is pruned the next time we try to send to it.
    // Never sent to the client - publicUser exposes only whether any exist.
    pushSubscriptions: {
      type: [
        {
          endpoint: { type: String, required: true },
          keys: { p256dh: String, auth: String },
          _id: false,
        },
      ],
      default: [],
      select: false,
    },

    // Sessions. Every sign-in token carries this number; raising it (on a new
    // password, or "sign out everywhere") makes every older token invalid.
    tokenVersion: { type: Number, default: 0 },
    passwordChangedAt: Date,
    // Set when an administrator issues a temporary password, so the student is
    // asked to choose their own the next time they sign in.
    mustChangePassword: { type: Boolean, default: false },

    // Sign-in lockout after repeated wrong passwords (see utils/passwords.js).
    failedLogins: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
  },
  { timestamps: true }
);

/**
 * Stores a new password as a bcrypt hash (cost 10, salted per password) and
 * ends every session signed in with the old one.
 */
userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
  this.passwordChangedAt = new Date();
  this.tokenVersion = (this.tokenVersion || 0) + 1;
};

userSchema.methods.checkPassword = function checkPassword(plain) {
  // A Google-only account has no passwordHash yet - fail closed rather than
  // let bcrypt.compare throw on undefined, which would otherwise read as a
  // 500 instead of the plain "wrong password" the login route expects.
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plain, this.passwordHash);
};

export default mongoose.models.User || mongoose.model('User', userSchema);
