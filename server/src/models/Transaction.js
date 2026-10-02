import mongoose from 'mongoose';
import { startOfMonth } from '../utils/dates.js';

/** Where money moved, in the order the form offers them. `cash` is notes in
 *  hand; every other value is digital, which is the split the dashboard draws. */
export const PAYMENT_METHODS = ['cash', 'bank', 'easypaisa', 'jazzcash', 'sadapay', 'nayapay', 'card', 'other'];
export const isDigital = (method) => method !== 'cash';

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    type: { type: String, enum: ['income', 'expense'], required: true, index: true },
    amount: { type: Number, required: [true, 'Amount is required'], min: [0.01, 'Amount must be greater than zero'] },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    date: { type: Date, required: true, index: true },
    // Denormalised month key so reports can group without a date pipeline.
    month: { type: Date, index: true },

    // Where the money actually moved. Students here are paid in a mix of notes
    // and wallets, and the two behave differently: cash leaves no trace and is
    // the part that goes missing at the end of the month, so the split is worth
    // carrying on every row rather than inferring it later. `cash` is notes in
    // hand; every other value is digital.
    method: { type: String, enum: PAYMENT_METHODS, default: 'cash', index: true },
    // Only meaningful when `method` is 'other': the name the student typed, so
    // a wallet Campus Coin has never heard of still shows as itself rather than
    // as "Something else". The logo is derived from the name (lib/brands.js).
    methodLabel: { type: String, trim: true, maxlength: 40, default: '' },

    // Set when the categorisation assistant proposed a category. Comparing this
    // with `category` is what tells the assistant it guessed wrong and should learn.
    aiSuggestedCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    aiAccepted: { type: Boolean, default: null },

    // Recurring entries (monthly allowance, subscriptions). The parent row holds
    // the rule; each generated copy points back at it through recurringParent.
    recurring: {
      enabled: { type: Boolean, default: false },
      frequency: { type: String, enum: ['weekly', 'monthly', 'yearly'], default: 'monthly' },
      nextRun: Date,
      endsOn: Date,
    },
    recurringParent: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },

    source: { type: String, enum: ['manual', 'csv', 'recurring', 'phrase', 'sms'], default: 'manual' },
    // An optional photo of the receipt. Excluded from every query by default -
    // a page of 25 transactions must not carry 25 images - and fetched on its
    // own when the student opens it. hasReceipt lets lists show the icon.
    receipt: { type: String, default: '', select: false },
    hasReceipt: { type: Boolean, default: false },

    // Flags raised by the anomaly check (unusually large / possible duplicate).
    flags: { type: [String], default: [] },
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, month: 1, type: 1 });

transactionSchema.pre('validate', function setMonth(next) {
  if (this.date) this.month = startOfMonth(this.date);
  next();
});

export default mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
