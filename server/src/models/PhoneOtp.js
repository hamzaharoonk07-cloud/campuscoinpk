import mongoose from 'mongoose';

/* One pending phone-login code, keyed by the phone number. Only the SHA-256 hash
   of the code is stored, never the code itself, so a leaked database cannot be
   used to sign in. A TTL index expires documents automatically, and there is one
   per phone (upsert on each request), so an old code is replaced, not stacked. */
const phoneOtpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    codeHash: { type: String, required: true },
    expires: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Mongo removes the document shortly after `expires` passes.
phoneOtpSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('PhoneOtp', phoneOtpSchema);
