import mongoose from 'mongoose';

// One total spending cap for the whole month, across every category - sits
// beside the per-category Budget model rather than inside it (category
// there is required, and "no category" would mean something different:
// uncategorised spending, not "everything combined").
const overallBudgetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    month: { type: Date, required: true },
    limitAmount: { type: Number, required: true, min: [0, 'A budget cannot be negative'] },
  },
  { timestamps: true }
);

overallBudgetSchema.index({ user: 1, month: 1 }, { unique: true });

export default mongoose.models.OverallBudget || mongoose.model('OverallBudget', overallBudgetSchema);
