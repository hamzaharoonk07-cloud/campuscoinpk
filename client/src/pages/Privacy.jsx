import { Link } from 'react-router-dom';
import '../styles/legal.css';

/* The privacy policy. Required by Google Play (a public, linkable URL) and by the
   Data Safety form. Written in plain language; it describes what the app actually
   does - hand-entered data, no bank link, data stays the student's own. */
export default function Privacy() {
  return (
    <main className="legal">
      <div className="legal-wrap">
        <Link to="/" className="legal-back">← Campus Coin</Link>
        <h1>Privacy Policy</h1>
        <p className="legal-date">Last updated: 2 October 2026</p>

        <p>
          Campus Coin is a budget and expense tracker for students. This policy explains what we
          collect, why, and the choices you have. In short: your money data is entered by you, it is
          yours, we do not sell it, and there is no bank or card connection.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>Account details</strong> — your name, email address, and (optionally) a profile photo, so you can sign in and we can send password-reset emails.</li>
          <li><strong>Your financial entries</strong> — the income and expenses you add by hand, by phrase, by voice-to-text, by photographing a receipt, by pasting a bank SMS, or by importing a CSV. These are stored so the app can show your budgets, reports and tips.</li>
          <li><strong>Udhaar records</strong> — the informal who-owes-whom entries you choose to add.</li>
          <li><strong>Basic technical data</strong> — standard server logs (e.g. request times and errors) needed to run and secure the service.</li>
        </ul>

        <h2>What we do NOT do</h2>
        <ul>
          <li>No connection to your bank account or card. Nothing is pulled automatically.</li>
          <li>Bank SMS and receipts are only read when <em>you</em> paste or photograph them; the app does not read your messages on its own.</li>
          <li>We do not sell your data, and we do not use it for advertising.</li>
        </ul>

        <h2>How your data is used</h2>
        <p>
          Only to provide the app: to show your dashboard, budgets, reports, insights and saving tips,
          to categorise entries, and to send you account emails. An optional AI summary feature sends
          only already-computed figures (never your raw transaction list) to an AI provider to phrase
          them in plain words; it is off unless enabled.
        </p>

        <h2>Service providers</h2>
        <p>
          We use a small number of processors to run the app: a cloud host (Vercel), a managed database
          (MongoDB Atlas), and an email provider for password-reset and verification messages. They
          process data on our behalf under their own security terms.
        </p>

        <h2>Security</h2>
        <p>
          Passwords are hashed (never stored in readable form), sessions use signed tokens, and all
          traffic is over HTTPS. Only you can see your own transactions.
        </p>

        <h2>Your choices</h2>
        <p>
          You can edit or delete any entry at any time inside the app. To delete your account and all
          associated data, email us at the address below and we will remove it.
        </p>

        <h2>Children</h2>
        <p>Campus Coin is intended for university and college students and is not directed at children under 13.</p>

        <h2>Changes</h2>
        <p>If this policy changes, we will update the date above and post the new version at this URL.</p>

        <h2>Contact</h2>
        <p>Questions or data-deletion requests: <a href="mailto:hamzaharoonk07@gmail.com">hamzaharoonk07@gmail.com</a></p>
      </div>
    </main>
  );
}
