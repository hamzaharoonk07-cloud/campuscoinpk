/* SMS sending, behind one function so the OTP route does not care who delivers.

   Configured entirely by environment variables, so no provider is hard-coded and
   none is required to run the app:

   - Twilio:  SMS_PROVIDER=twilio, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
              TWILIO_FROM (a Twilio number or messaging-service SID in TWILIO_FROM)
   - none:    leave SMS_PROVIDER unset — sendSms returns { sent:false }, and the
              OTP route only reveals the code when PHONE_OTP_TEST_MODE=1 (for your
              own testing before a provider is wired; never leave that on in
              production).

   Returns { sent: boolean, error?: string }. Never throws. */

export function smsConfigured() {
  return process.env.SMS_PROVIDER === 'twilio'
    && Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

export async function sendSms(to, body) {
  if (!smsConfigured()) return { sent: false, error: 'no_provider' };
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const form = new URLSearchParams({ To: to, From: process.env.TWILIO_FROM, Body: body });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { authorization: `Basic ${auth}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { sent: false, error: `twilio_${res.status}: ${detail.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: String(err?.message || err) };
  }
}
