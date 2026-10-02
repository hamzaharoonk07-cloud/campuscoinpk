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
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['student', 'admin'], default: 'student', index: true },

    // Profile fields from the SRS (section 1.6, "User Authentication and Management")
    // School, college, university or postgraduate year (utils/study.js).
    academicYear: { type: String, enum: STUDY_LEVELS, default: '' },
    institution: { type: String, trim: true, maxlength: 120, default: '' },
    monthlyAllowance: { type: Number, default: 0, min: 0 },
    savingsGoal: { type: Number, default: 0, min: 0 },
    currency: { type: String, enum: ['PKR', 'USD', 'EUR', 'GBP', 'INR', 'AED'], default: 'PKR' },
    avatarColor: { type: String, default: '#121214' },
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
  return bcrypt.compare(plain, this.passwordHash);
};

export default mongoose.models.User || mongoose.model('User', userSchema);
