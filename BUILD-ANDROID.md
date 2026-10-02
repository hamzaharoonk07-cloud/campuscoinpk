# Publishing Campus Coin to Google Play

Campus Coin is a PWA. We ship it to Play as a **TWA** (Trusted Web Activity) — a
thin Android app that runs `https://campuscoinpk.vercel.app` fullscreen with the
Campus Coin icon and no browser bar. `twa-manifest.json` (repo root) holds the
build config; `client/public/icon-512.png` is the app icon.

There are two ways to produce the signed `.aab`. Pick ONE.

---

## Route A — PWABuilder (easiest, nothing to install)

1. Go to **https://www.pwabuilder.com** and enter
   `https://campuscoinpk.vercel.app`.
2. Click **Package for stores → Android → Generate**.
   - Package ID: `com.campuscoin.app`
   - App name: `Campus Coin`
   - Leave "Signing key" on **"Create new"** (PWABuilder makes and keeps it).
3. Download the zip. It contains:
   - `app-release-signed.aab`  ← upload this to Play
   - `assetlinks.json`         ← its SHA-256 proves the app owns the domain
   - `signing.keystore` + passwords  ← **back these up safely, you need the same
     key for every future update**
4. Send me the `assetlinks.json` (or just the SHA-256 fingerprint in it) and I'll
   host it at `https://campuscoinpk.vercel.app/.well-known/assetlinks.json` so the
   app launches without the URL bar.

## Route B — Bubblewrap in your own terminal (more control)

Bubblewrap is already installed. In **PowerShell** (not this automated shell):

```powershell
cd "$env:USERPROFILE\Downloads\campuscoinpk"
bubblewrap build        # uses the twa-manifest.json already in this folder
```

The first run will offer to **download a JDK 17 and the Android SDK** — say **Yes**
to both. It will then ask you to **create a signing key**: give a password you
will remember and keep the generated `android.keystore` safe (same key for all
future updates). Output: `app-release-signed.aab`.

Then run `bubblewrap fingerprint list` to get the SHA-256 and send it to me for
the assetlinks file.

> If `bubblewrap build` can't find Java, install Temurin **JDK 17** and set
> `JAVA_HOME` to it, then retry. Bubblewrap needs 17 specifically.

---

## After you have the .aab — Play Console (your part)

1. Create a **Play Console account** — https://play.google.com/console — $25 one
   time, with ID verification.
2. **Create app** → Campus Coin → App (not game) → Free.
3. Upload the `.aab` under **Testing → Closed testing** (see below).
4. Fill the **store listing** (I'll give you the text + graphics), **Data safety**,
   **content rating**, and a **privacy policy URL**.

### The 14-day test (required for new personal accounts)
Google makes new personal developer accounts run a **closed test with ≥12 testers
who stay opted-in for 14 continuous days** before you can apply for production.
- In **Closed testing**, create a track, add **12+ tester emails** (classmates/
  friends with Google accounts), and share the opt-in link.
- They install and keep the app for 14 days.
- After that, **Apply for production** unlocks.

Plan ~2–3 weeks start to finish, mostly the 14-day wait.
