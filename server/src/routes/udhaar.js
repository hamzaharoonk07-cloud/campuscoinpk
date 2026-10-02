import express from 'express';
import Udhaar from '../models/Udhaar.js';
import { protect, wrap } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

/** Signed value of one entry from the student's side: positive = owed to them. */
const signed = (entry) => (entry.direction === 'owed_to_me' ? entry.amount : -entry.amount);

/**
 * Every open udhaar, grouped by person with a net figure each, plus the two
 * headline totals. Settled rows are returned separately so the page can show a
 * "cleared" history without them muddying the balances.
 */
router.get(
  '/',
  wrap(async (req, res) => {
    const entries = await Udhaar.find({ user: req.user._id }).sort({ date: -1 });
    const open = entries.filter((e) => !e.settled);
    const settled = entries.filter((e) => e.settled);

    // Fold each person's open rows into one net balance, keyed by a normalised
    // name so "Ali" and "ali" are the same person.
    const byPerson = new Map();
    for (const entry of open) {
      const key = entry.person.trim().toLowerCase();
      const group = byPerson.get(key) || { person: entry.person, phone: '', net: 0, entries: [] };
      group.net += signed(entry);
      group.phone = group.phone || entry.phone;
      group.entries.push(entry);
      byPerson.set(key, group);
    }

    const people = [...byPerson.values()]
      // People who net to zero are square - leave them out of the open list.
      .filter((g) => Math.abs(g.net) >= 0.01)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

    const owedToMe = people.reduce((sum, g) => (g.net > 0 ? sum + g.net : sum), 0);
    const iOwe = people.reduce((sum, g) => (g.net < 0 ? sum - g.net : sum), 0);

    res.json({ people, settled, summary: { owedToMe, iOwe, net: owedToMe - iOwe } });
  })
);

router.post(
  '/',
  wrap(async (req, res) => {
    const { person, phone, amount, direction, note, date } = req.body;
    if (!person || !String(person).trim()) return res.status(400).json({ message: 'Whose udhaar is this?' });
    if (!(Number(amount) > 0)) return res.status(400).json({ message: 'Enter an amount greater than zero' });
    if (!['owed_to_me', 'i_owe'].includes(direction)) return res.status(400).json({ message: 'Choose who owes whom' });

    const entry = await Udhaar.create({
      user: req.user._id,
      person: String(person).trim(),
      phone: String(phone || '').trim(),
      amount: Number(amount),
      direction,
      note: String(note || '').trim(),
      date: date ? new Date(date) : new Date(),
    });
    res.status(201).json({ entry });
  })
);

/**
 * Chai Split — one bill, paid by the student, divided among friends. Writes
 * one 'owed_to_me' udhaar row per friend for their share; reuses the same
 * model and the same per-person totals above rather than a parallel feature,
 * since splitting a bill is just several debts created at once.
 */
router.post(
  '/split',
  wrap(async (req, res) => {
    const { totalAmount, people, note, date } = req.body;
    const total = Number(totalAmount);
    if (!(total > 0)) return res.status(400).json({ message: 'Enter the bill total' });

    const names = (Array.isArray(people) ? people : [])
      .map((p) => ({ name: String(p?.name || '').trim(), phone: String(p?.phone || '').trim() }))
      .filter((p) => p.name);
    if (!names.length) return res.status(400).json({ message: 'Add at least one friend to split with' });

    // The student's own share stays off the ledger - udhaar only tracks what
    // other people owe, not what someone already paid for themselves - so the
    // bill splits across everyone at the table, friends included.
    const diners = names.length + 1;
    const share = Math.round((total / diners) * 100) / 100;
    const when = date ? new Date(date) : new Date();
    const billNote = note ? `Bill split: ${note}` : `Bill split, ${diners} people`;

    const entries = await Udhaar.insertMany(
      names.map((p) => ({
        user: req.user._id,
        person: p.name,
        phone: p.phone,
        amount: share,
        direction: 'owed_to_me',
        note: billNote,
        date: when,
      }))
    );
    res.status(201).json({ entries, share, diners });
  })
);

/** Marks one udhaar as paid back. Kept, not deleted, so the history stays. */
router.patch(
  '/:id/settle',
  wrap(async (req, res) => {
    const entry = await Udhaar.findOne({ _id: req.params.id, user: req.user._id });
    if (!entry) return res.status(404).json({ message: 'That udhaar was not found' });
    entry.settled = !entry.settled;
    entry.settledAt = entry.settled ? new Date() : undefined;
    await entry.save();
    res.json({ entry });
  })
);

router.delete(
  '/:id',
  wrap(async (req, res) => {
    const entry = await Udhaar.findOne({ _id: req.params.id, user: req.user._id });
    if (!entry) return res.status(404).json({ message: 'That udhaar was not found' });
    await entry.deleteOne();
    res.json({ message: 'Udhaar removed' });
  })
);

export default router;
