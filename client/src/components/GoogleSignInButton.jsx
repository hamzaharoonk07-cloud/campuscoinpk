import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth, useToast } from '../context/AppContext.jsx';

/* ---------------------------------------------------------------------------
   "Sign in with Google" - Google's own Identity Services script, not a
   hand-rolled OAuth redirect: it draws Google's button, handles the popup,
   and hands back a signed ID token the server verifies before trusting
   anything about who sent it (routes/auth.js, POST /auth/google).

   Renders nothing when the server has no GOOGLE_CLIENT_ID configured -
   checked once, not assumed - so the button never appears half-working.
--------------------------------------------------------------------------- */

let scriptPromise = null;
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export default function GoogleSignInButton() {
  const { loginWithGoogle } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const ref = useRef(null);
  const [clientId, setClientId] = useState(null);

  useEffect(() => {
    api
      .get('/auth/google-status')
      .then((d) => d.configured && setClientId(d.clientId))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!clientId || !ref.current) return undefined;
    let cancelled = false;

    loadGoogleScript().then(() => {
      if (cancelled || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try {
            await loginWithGoogle(credential);
            navigate('/dashboard', { replace: true });
          } catch (err) {
            toast.error('Could not sign in with Google', err.message);
          }
        },
      });
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (!clientId) return null;
  return (
    <>
      <div className="auth-or">
        <span>or</span>
      </div>
      <div className="google-signin-card">
        <div className="google-signin" ref={ref} />
      </div>
    </>
  );
}
