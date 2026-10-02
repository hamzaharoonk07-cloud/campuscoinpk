# Campus Coin Android app

A thin native wrapper (Capacitor) around the live site at campuscoinpk.vercel.app,
plus one real native piece: `SmsReceiver.java`, which catches every incoming SMS
and forwards it straight to the existing `/api/webhook/sms` endpoint - the same
one MacroDroid already posts to - with no MacroDroid, no third-party app, and no
need to open Campus Coin at all.

## What's native vs. what's the website

- The whole UI (login, dashboard, everything) is the real website, loaded in a
  WebView (`capacitor.config.json`'s `server.url`). Nothing was rebuilt twice.
- `android/app/src/main/java/com/campuscoin/mobile/`:
  - `SmsReceiver.java` - a BroadcastReceiver for incoming SMS. Reads the
    message, and if forwarding is turned on, POSTs `{key, text}` to the
    webhook URL on a background thread. Does nothing if not configured/enabled.
  - `SmsForwarderPlugin.java` - the bridge the website's Settings page talks to
    (`client/src/lib/smsForwarder.js`): request the SMS permission, save the
    webhook URL/key, turn forwarding on/off.
  - `MainActivity.java` - registers that plugin, otherwise untouched.
- Settings → "Log transactions from bank SMS automatically" shows a one-tap
  "Turn on" button *only inside this app* (hidden on the regular website,
  via `Capacitor.isNativePlatform()`). It generates a fresh webhook key,
  hands it to the native plugin, asks for the SMS permission, and switches it on.

## Building it (needs Android Studio - not done on this machine, no JDK/SDK found)

1. Install **Android Studio** (bundles the JDK, Android SDK and Gradle you need -
   this is the only real prerequisite).
2. Open `client/android` as a project in Android Studio (File → Open).
3. Let Gradle sync finish (first time takes a few minutes).
4. Plug in an Android phone (USB debugging on) or use an emulator, then
   **Run ▶**. Android Studio installs and launches the app.
5. To test the SMS feature for real: Settings → bottom panel → "Turn on",
   grant the SMS permission when asked, then send/receive a bank-style SMS
   (or any SMS, to see it reach the server) and check Transactions.
6. To hand someone an installable file instead of running from Android
   Studio: Build → Generate Signed Bundle / APK → APK, debug build is fine
   for testing; a release build needs a signing key (Android Studio can
   generate one) before Google Play would accept it.

## After changing any React code

The app loads the *live website*, not a bundled copy, so an ordinary
`push`/deploy to Vercel is all a code change needs - no Android rebuild, no
new APK, nothing to resubmit. A rebuild in Android Studio is only needed
again if the native Java files themselves change.

## If you want to publish it to the Play Store

That's a separate step this doesn't cover yet (a $25 one-time Google Play
developer account, a signed release build, store listing, privacy policy
covering the SMS permission specifically - Google reviews apps that read SMS
more closely). Say so when you're ready and I'll walk through it.
