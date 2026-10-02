import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Committee (kameti/BC/ROSCA) — brief: "Committee (ROSCA) tracker".
//
// A fixed group puts in the same amount every round; one member takes the
// whole pot that round, in a set order, until everyone has had their turn
// once. Payout order is the members array's own order - no separate field
// to drift out of sync with it. One document per committee, run by the
// student who created it; who is "in" it is names and phone numbers, same
// as Udhaar, since the other members are not necessarily Campus Coin
// accounts themselves.
// ---------------------------------------------------------------------------

const committeeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: [true, 'Give this committee a name'], trim: true, maxlength: 60 },
    amountPerMember: { type: Number, required: true, min: [0.01, 'The per-member amount must be greater than zero'] },
    frequency: { type: String, enum: ['weekly', 'monthly'], default: 'monthly' },
    members: [
      {
        name: { type: String, required: true, trim: true, maxlength: 60 },
        phone: { type: String, trim: true, maxlength: 20, default: '' },
      },
    ],
    // 1-based; members[currentRound - 1] is this round's receiver. Reaching
    // members.length + 1 means every member has been paid once - done.
    currentRound: { type: Number, default: 1 },
    // Names of members who have paid their contribution this round - reset
    // to [] whenever the round advances.
    paidThisRound: { type: [String], default: [] },
    // One row per closed round, kept so the committee's own history survives
    // past its last round rather than only ever showing the current one.
    history: [
      {
        round: Number,
        receiver: String,
        total: Number,
        completedAt: { type: Date, default: Date.now },
      },
    ],
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

committeeSchema.index({ user: 1, archived: 1 });

export default mongoose.models.Committee || mongoose.model('Committee', committeeSchema);
