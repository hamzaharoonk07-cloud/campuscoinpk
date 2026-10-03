// Web Push subscription management. The browser creates a PushSubscription with
// our VAPID public key, then hands it here to store against the account; one row
// per device. Unsubscribe removes just the device that asked.

import express from 'express';
import User from '../models/User.js';
import { protect, wrap } from '../middleware/auth.js';
import { vapidPublicKey, pushConfigured, sendToUser } from '../services/push.js';

const router = express.Router();

/** The public VAPID key the client needs before it can subscribe. Public info. */
router.get('/vapid', (req, res) => {
  res.json({ publicKey: vapidPublicKey(), enabled: pushConfigured });
});

router.use(protect);

/** Store (or refresh) this device's subscription for the signed-in student. */
router.post(
  '/subscribe',
  wrap(async (req, res) => {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: 'That is not a valid push subscription' });
    }
    // Replace any earlier row for the same endpoint so re-subscribing on one
    // device never piles up duplicates.
    await User.updateOne({ _id: req.user._id }, { $pull: { pushSubscriptions: { endpoint } } });
    await User.updateOne(
      { _id: req.user._id },
      { $push: { pushSubscriptions: { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } } } }
    );
    res.status(201).json({ ok: true });
  })
);

/** Remove this device's subscription (the student turned notifications off). */
router.post(
  '/unsubscribe',
  wrap(async (req, res) => {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ message: 'No endpoint to remove' });
    await User.updateOne({ _id: req.user._id }, { $pull: { pushSubscriptions: { endpoint } } });
    res.json({ ok: true });
  })
);

/** Send a test push to confirm the whole chain works, right after subscribing. */
router.post(
  '/test',
  wrap(async (req, res) => {
    const sent = await sendToUser(req.user._id, {
      title: 'Notifications are on 🎉',
      body: 'This is how Campus Coin will nudge you about budgets and daily logging.',
      link: '/dashboard',
      tag: 'push-test',
    });
    res.json({ ok: true, sent });
  })
);

export default router;
