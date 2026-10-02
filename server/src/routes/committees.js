import express from 'express';
import Committee from '../models/Committee.js';
import { protect, wrap } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

/** Shapes one committee for the client: the round's receiver and the pot's
 *  progress computed, not stored, so they can never drift out of sync with
 *  members/currentRound/paidThisRound. */
function present(doc) {
  const c = doc.toObject();
  const total = c.members.length * c.amountPerMember;
  const done = c.currentRound > c.members.length;
  return {
    ...c,
    receiver: done ? null : c.members[c.currentRound - 1]?.name || null,
    collected: c.paidThisRound.length * c.amountPerMember,
    total,
    done,
  };
}

router.get(
  '/',
  wrap(async (req, res) => {
    const committees = await Committee.find({ user: req.user._id, archived: false }).sort({ createdAt: -1 });
    res.json({ committees: committees.map(present) });
  })
);

router.post(
  '/',
  wrap(async (req, res) => {
    const { name, amountPerMember, frequency, members } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'Give this committee a name' });
    if (!(Number(amountPerMember) > 0)) return res.status(400).json({ message: 'Enter an amount greater than zero' });
    const list = (Array.isArray(members) ? members : [])
      .map((m) => ({ name: String(m?.name || '').trim(), phone: String(m?.phone || '').trim() }))
      .filter((m) => m.name);
    if (list.length < 2) return res.status(400).json({ message: 'Add at least two members' });

    const committee = await Committee.create({
      user: req.user._id,
      name: String(name).trim(),
      amountPerMember: Number(amountPerMember),
      frequency: ['weekly', 'monthly'].includes(frequency) ? frequency : 'monthly',
      members: list,
    });
    res.status(201).json({ committee: present(committee) });
  })
);

/** Toggles whether one member has paid their contribution this round. */
router.patch(
  '/:id/paid',
  wrap(async (req, res) => {
    const committee = await Committee.findOne({ _id: req.params.id, user: req.user._id });
    if (!committee) return res.status(404).json({ message: 'That committee was not found' });
    const name = String(req.body.memberName || '');
    if (!committee.members.some((m) => m.name === name)) return res.status(400).json({ message: 'That member is not in this committee' });

    const at = committee.paidThisRound.indexOf(name);
    if (at >= 0) committee.paidThisRound.splice(at, 1);
    else committee.paidThisRound.push(name);

    await committee.save();
    res.json({ committee: present(committee) });
  })
);

/**
 * Closes the current round - whoever is due receives the pot, the round's
 * total goes into history, and the round moves on. Allowed even if not
 * everyone has paid yet: a real committee sometimes covers a short member
 * and sorts it out later, and the app tracking who still owes what for a
 * closed round is more useful than refusing to let it close at all.
 */
router.post(
  '/:id/advance',
  wrap(async (req, res) => {
    const committee = await Committee.findOne({ _id: req.params.id, user: req.user._id });
    if (!committee) return res.status(404).json({ message: 'That committee was not found' });
    if (committee.currentRound > committee.members.length) {
      return res.status(400).json({ message: 'Every member has already had their round' });
    }

    const receiver = committee.members[committee.currentRound - 1]?.name || '';
    committee.history.push({
      round: committee.currentRound,
      receiver,
      total: committee.paidThisRound.length * committee.amountPerMember,
    });
    committee.currentRound += 1;
    committee.paidThisRound = [];
    await committee.save();
    res.json({ committee: present(committee) });
  })
);

router.delete(
  '/:id',
  wrap(async (req, res) => {
    const committee = await Committee.findOne({ _id: req.params.id, user: req.user._id });
    if (!committee) return res.status(404).json({ message: 'That committee was not found' });
    await committee.deleteOne();
    res.json({ message: 'Committee removed' });
  })
);

export default router;
