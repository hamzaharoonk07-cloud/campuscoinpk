import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Udhaar — the small loans between friends that every student carries and no
// general budgeting app tracks: the 200 you lent for chai, the 2,000 a
// flatmate owes for the bill. Each row is one direction of one debt with one
// person; "net with Ali" is worked out by adding his rows up.
//
// Udhaar sits beside transactions rather than inside them: lending money is
// not spending it, and the dashboard's income/expense totals should not move
// when you note that someone owes you. Settling is a flag, not a delete, so
// the history of who paid back and when is kept.
// ---------------------------------------------------------------------------

const udhaarSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // The friend's name as the student wrote it; free text, since these people
    // are not Campus Coin accounts.
    person: { type: String, required: [true, 'Whose udhaar is this?'], trim: true, maxlength: 60 },
    // Optional number so the WhatsApp reminder can open straight to them.
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    amount: { type: Number, required: true, min: [0.01, 'Amount must be greater than zero'] },
    // Which way the money went. 'owed_to_me' = I lent it; 'i_owe' = I borrowed.
    direction: { type: String, enum: ['owed_to_me', 'i_owe'], required: true },
    note: { type: String, trim: true, maxlength: 200, default: '' },
    date: { type: Date, required: true, default: Date.now },
    settled: { type: Boolean, default: false, index: true },
    settledAt: { type: Date },
  },
  { timestamps: true }
);

udhaarSchema.index({ user: 1, settled: 1, date: -1 });

export default mongoose.models.Udhaar || mongoose.model('Udhaar', udhaarSchema);
