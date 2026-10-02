# Campus Coin — Google Play listing (copy-paste)

All the text and settings for the Play Console store listing. Assets (icon,
feature graphic, screenshots) are in `Downloads/campuscoin-store-assets/`.

---

## App details

- **App name:** `Campus Coin`
- **Default language:** English (United States) — en-US
- **App or game:** App
- **Free or paid:** Free
- **Category:** Finance
- **Tags:** budgeting, personal finance
- **Contact email:** hamzaharoonk07@gmail.com
- **Privacy policy URL:** `https://campuscoinpk.vercel.app/privacy`
- **Website (optional):** `https://campuscoinpk.vercel.app`

## Short description (max 80 chars)

```
Student budget tracker — log spending by voice, receipt photo or bank SMS.
```

## Full description (max 4000 chars)

```
Campus Coin is a money tracker built for students, not for people with a salary
and a bank feed. Allowance that lands when it lands, a bit of tutoring money, a
scholarship instalment — Campus Coin assumes nothing and puts it all in one place
so you can see what's left, not just what went.

SAY IT, SAVED, DONE
Adding a spend is one line. Type or speak "chai with friends 150" or "bus 60" and
Campus Coin finds the amount and files it under the right category by itself. It
understands everyday Roman Urdu numbers too ("do sau", "2 hazaar").

SNAP A RECEIPT
Take a photo and it reads the total, the shop and the date, then suggests the
category — all on your own device. The photo stays with the entry.

PASTE A BANK SMS
Paste an SMS from HBL, UBL, JazzCash, Easypaisa, SadaPay or NayaPay and Campus
Coin reads the amount, whether it was money in or out, the merchant and the
wallet. Nothing is read automatically — only what you paste.

UDHAAR TRACKER
Keep track of who owes whom, netted per person, settle with a tap, and send a
gentle WhatsApp reminder when you need to.

BUDGETS THAT FILL IN REAL TIME
Set a cap for food, transport or subscriptions and watch each bar fill. You hear
about it once when you get close and once if you go over — never on every spend.

REPORTS, INSIGHTS AND TIPS
See where it went by category, day and week, with six months of income against
spending. Every chart has a table of the same numbers, and reports save as PDF.
Saving tips are ranked by what each would actually save you, from your own
history, and a monthly summary explains your month in plain words.

ASK COIN
A built-in assistant answers from your own numbers — "how much on food?",
"can I afford 2,500?" — and learns from your corrections.

PRIVATE BY DESIGN
No bank link and no card. Your transactions are entered by you and seen only by
you. Passwords are hashed, traffic is encrypted, and your data is never sold.

Campus Coin holds no real money, connects to no bank, and its suggestions are
prompts to look closer, not financial advice.
```

---

## Data Safety form answers

**Does your app collect or share any of the required user data types?** → **Yes**

**Is all collected data encrypted in transit?** → **Yes**
**Do you provide a way for users to request that their data is deleted?** → **Yes** (by email; stated in the privacy policy)

Data types to declare (all: collected, NOT shared, processed on-device where noted):

| Data type | Collected | Purpose | Required? |
|---|---|---|---|
| Name | Yes | Account management, App functionality | Required |
| Email address | Yes | Account management | Required |
| Photos (profile + receipt) | Yes | App functionality | Optional |
| Financial info → *Other financial info* (the expense/income entries you add) | Yes | App functionality | Required |
| App activity / app interactions | Yes | Analytics, App functionality | Optional |
| Crash logs / diagnostics | Yes | App functionality (stability) | Optional |

- **Sharing:** None of the above is shared with third parties (processors like the
  cloud host and database act on our behalf, which Play does not count as "sharing").
- Do NOT declare "Payment info" — there is no payment processing.

## Content rating
Fill the questionnaire honestly — it's a finance utility with no violence, no
user-generated public content, no gambling. Expected result: **Everyone**.

## Target audience
Select **18+** (or 13+) — university/college students. Not directed at children.

---

## Release — Closed testing (required first)

1. **Testing → Closed testing → Create track** (e.g. "Alpha").
2. Upload `Campus Coin.aab`.
3. Add **12+ tester emails** (Google accounts) and share the opt-in URL.
4. Testers install and KEEP it opted-in for **14 continuous days**.
5. After 14 days, **Apply for production** unlocks → fill the remaining forms and submit for review.

### IMPORTANT — Play App Signing fingerprint
When you upload the .aab, Play uses its own signing key. After upload, go to
**Setup → App integrity → App signing** and copy the **SHA-256 certificate
fingerprint** of the *App signing key*. Send it to me — I'll add it to
assetlinks.json alongside the current one, so the installed app (signed by Google)
also verifies the domain and launches with no URL bar.
