import { registerPlugin, Capacitor } from '@capacitor/core';

/* ---------------------------------------------------------------------------
   The JS side of the native SMS forwarder (android/.../SmsForwarderPlugin.java).

   Only real inside the Android app build (Capacitor) - on the ordinary
   website there is no native layer to talk to, so every call here is a
   no-op there. Settings.jsx checks `isNative()` before showing this at all.
--------------------------------------------------------------------------- */

const SmsForwarder = registerPlugin('SmsForwarder');

export const isNative = () => Capacitor.isNativePlatform();

export async function smsStatus() {
  if (!isNative()) return { granted: false, enabled: false, configured: false };
  return SmsForwarder.status();
}

export async function smsRequestPermission() {
  return SmsForwarder.requestPermission();
}

export async function smsConfigure(url, key) {
  return SmsForwarder.configure({ url, key });
}

export async function smsSetEnabled(enabled) {
  return SmsForwarder.setEnabled({ enabled });
}
