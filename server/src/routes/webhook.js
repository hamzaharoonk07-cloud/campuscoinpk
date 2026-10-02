import crypto from 'crypto';
import express from 'express';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import { wrap } from '../middleware/auth.js';
import { parseSms } from '../services/smsParser.js';
import { learn } from '../services/categorizer.js';

/* ---------------------------------------------------------------------------
   Webhook automation (brief: "Automation app + webhook" - MacroDroid, Tasker,
   iOS Shortcuts forwarding a bank SMS as it arrives).

   This caller is a phone-side rule, not a signed-in browser, so it carries
   the account's webhook key instead of a session token - checked by hashing
   whatever is sent and comparing it to the stored hash, the same way a
   password is checked, never by storing or comparing the raw key.

   Unlike QuickPhrase's interactive parse, there is nobody at the screen to
   finish an uncertain draft, so this always saves something: a confident
   category match is used, and anything else falls back to Miscellaneous (or
   Other Income) rather than being silently dropped - a transaction in the
   wrong category is one edit away from fixed; one that was never logged at
   all is gone.
--------------------------------------------------------------------------- */

const router = express.Router();

async function userForKey(key) {
  if (!key || typeof key !== 'string') return null;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return User.findOne({ webhookKeyHash: hash }).select('+webhookKeyHash');
}

router.post(
  '/sms',
  wrap(async (req, res) => {
    const key = req.body.key || req.query.key || req.headers['x-webhook-key'];
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ message: 'No message text was sent' });

    const user = await userForKey(key);
    if (!user || user.disabled) return res.status(401).json({ message: 'Unknown or revoked webhook key' });

    const draft = await parseSms({ userId: user._id, text });
    if (draft.amount === null) {
      // 200, not an error - a forwarder sees plenty of non-transaction SMS
      // (OTPs, promos) and should keep running rather than treat this as a
      // failure worth retrying or alerting on.
      return res.json({ saved: false, reason: 'No amount found in that message' });
    }

    let categoryId = draft.category?._id;
    if (!categoryId) {
      const fallbackName = draft.type === 'income' ? 'Other Income' : 'Miscellaneous';
      const fallback = await Category.findOne({ owner: null, type: draft.type, name: fallbackName });
      categoryId = fallback?._id;
    }
    if (!categoryId) return res.json({ saved: false, reason: 'No category available to file this under' });

    const transaction = await Transaction.create({
      user: user._id,
      category: categoryId,
      type: draft.type,
      amount: draft.amount,
      description: draft.description || '',
      date: new Date(),
      method: draft.method || undefined,
      aiSuggestedCategory: draft.category?._id || null,
      source: 'sms',
    });

    if (draft.description) await learn({ userId: user._id, description: draft.description, categoryId });

    res.status(201).json({ saved: true, transaction: { amount: transaction.amount, type: transaction.type, description: transaction.description } });
  })
);

export default router;
