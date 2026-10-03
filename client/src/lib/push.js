// Browser side of Web Push. Turns the Notification permission + a PushSubscription
// (signed with the server's VAPID key) into something the server can send to, and
// tears it down again when the student turns notifications off.
//
// Everything degrades quietly: a browser without the Push API, a denied
// permission, or a dev build with no service worker all just report "not on"
// rather than throwing.

import { api } from './api.js';

export const pushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/** VAPID keys arrive as URL-safe base64; the browser wants a Uint8Array. */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** Whether this browser already has a live subscription for the app. */
export async function pushStatus() {
  if (!pushSupported()) return { supported: false, subscribed: false, permission: 'unsupported' };
  const permission = Notification.permission;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return { supported: true, subscribed: Boolean(sub), permission };
  } catch {
    return { supported: true, subscribed: false, permission };
  }
}

/**
 * Asks permission (if needed), subscribes this device, and registers it with the
 * server. Returns true on success. Throws only with a message worth showing.
 */
export async function enablePush() {
  if (!pushSupported()) throw new Error('This browser does not support notifications.');

  // The service worker only registers in production builds, so there is nothing
  // to subscribe against in local dev - `serviceWorker.ready` would hang.
  const existing = await navigator.serviceWorker.getRegistration();
  if (!existing) throw new Error('Open the installed app to turn notifications on.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked. Turn them on for this app in your browser settings.'
        : 'Notification permission was not granted.'
    );
  }

  const { publicKey, enabled } = await api.get('/push/vapid');
  if (!enabled || !publicKey) throw new Error('Notifications are not available right now.');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = sub.toJSON();
  await api.post('/push/subscribe', { endpoint: json.endpoint, keys: json.keys });
  return true;
}

/** Unsubscribes this device and tells the server to forget it. */
export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}

/** Sends a one-off test push to confirm the whole chain is wired up. */
export const sendTestPush = () => api.post('/push/test', {});
