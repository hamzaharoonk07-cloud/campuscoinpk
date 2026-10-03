// Web Push (Push API + VAPID). The in-app bell is still the source of truth for
// alerts; this is the extra layer that pops a system notification on the phone
// or desktop even when Campus Coin is closed - a TWA/installed PWA can receive
// these the same way a native app receives a push.
//
// A send never throws into the caller: a budget save must not fail because a
// student's old browser subscription has expired. Dead subscriptions (the push
// service answers 404/410 Gone) are pruned from the account as we find them.

import webpush from 'web-push';
import User from '../models/User.js';

const PUBLIC = process.env.VAPID_PUBLIC || '';
const PRIVATE = process.env.VAPID_PRIVATE || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@campuscoin.app';

export const pushConfigured = Boolean(PUBLIC && PRIVATE);

if (pushConfigured) {
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
} else {
  // Not fatal - the app runs fine without push; it just won't send any.
  console.warn('[push] VAPID keys not set; web push is disabled.');
}

/** The public key the browser needs to create a subscription. */
export const vapidPublicKey = () => PUBLIC;

/**
 * Sends one notification to every device a student has subscribed. `payload` is
 * what the service worker's `push` handler reads: { title, body, link, tag }.
 * Returns the number of devices it actually reached. Prunes expired endpoints.
 */
export async function sendToUser(userId, payload) {
  if (!pushConfigured) return 0;

  const user = await User.findById(userId).select('+pushSubscriptions preferences');
  if (!user || !user.pushSubscriptions?.length) return 0;
  // Respect the same switch the in-app budget alerts obey.
  if (user.preferences && user.preferences.alertsEnabled === false) return 0;

  const data = JSON.stringify(payload);
  const dead = [];
  let sent = 0;

  await Promise.all(
    user.pushSubscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, data);
        sent += 1;
      } catch (err) {
        // 404/410 mean the browser threw the subscription away; drop ours too.
        if (err.statusCode === 404 || err.statusCode === 410) dead.push(sub.endpoint);
      }
    })
  );

  if (dead.length) {
    await User.updateOne(
      { _id: user._id },
      { $pull: { pushSubscriptions: { endpoint: { $in: dead } } } }
    ).catch(() => {});
  }

  return sent;
}

/**
 * The daily "log your spending" nudge, fired by the Vercel cron. One gentle push
 * per student who has at least one live subscription and hasn't muted alerts.
 * Returns how many students were reached.
 */
export async function sendDailyReminders() {
  if (!pushConfigured) return 0;

  const users = await User.find({
    'pushSubscriptions.0': { $exists: true },
    'preferences.alertsEnabled': { $ne: false },
  })
    .select('_id name')
    .lean();

  let reached = 0;
  for (const u of users) {
    const first = (u.name || 'there').split(' ')[0];
    const sent = await sendToUser(u._id, {
      title: 'Logged today yet?',
      body: `A quick tap keeps your month honest, ${first}. Add what you spent today.`,
      link: '/dashboard',
      tag: 'daily-reminder',
    });
    if (sent) reached += 1;
  }
  return reached;
}
