import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';

/* ---------------------------------------------------------------------------
   "Install app" - installs Campus Coin as a PWA from the website.

   Chrome/Edge/Android fire `beforeinstallprompt` when the app is installable;
   we hold that event and fire it on click for the real one-tap install. Where
   the browser does not expose it (notably iOS Safari), the button falls back
   to a short line telling the student how to add it from their own menu.
   Hidden once the app is already running installed (standalone display mode).
--------------------------------------------------------------------------- */

export default function InstallButton({ className = 'lp-text-link', label = 'Install app' }) {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [hint, setHint] = useState('');

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setHint('');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    try {
      if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
        setInstalled(true);
      }
    } catch {
      /* matchMedia can be unavailable; the button simply stays shown */
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const click = async () => {
    if (deferred) {
      deferred.prompt();
      try {
        const { outcome } = await deferred.userChoice;
        if (outcome === 'accepted') setDeferred(null);
      } catch {
        /* the prompt can only be used once; ignore */
      }
      return;
    }
    // No native prompt (iOS Safari, or criteria not yet met) - tell them how.
    const ua = navigator.userAgent || '';
    const ios = /iphone|ipad|ipod/i.test(ua);
    setHint(
      ios
        ? 'In Safari, tap the Share button, then "Add to Home Screen".'
        : 'Open your browser menu and choose "Install app" or "Add to Home screen".'
    );
  };

  return (
    <>
      <button type="button" className={className} onClick={click}>
        <Icon name="download" size={16} />
        {label}
      </button>
      {hint ? (
        <span className="lp-install-hint" role="status">
          {hint}
        </span>
      ) : null}
    </>
  );
}
