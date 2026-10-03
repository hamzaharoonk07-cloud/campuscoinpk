import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider, ThemeProvider, ToastProvider } from './context/AppContext.jsx';
import './styles/app.css';
// After app.css, so motion rules win over same-specificity base rules.
import './styles/motion.css';
import './styles/pictures.css';
import './styles/frame.css';
// The design 9 look, last so it wins.
import './styles/design9.css';
import './styles/insights.css';
import './styles/account.css';
import './styles/live.css';
import './styles/calendar.css';
import './styles/story.css';
import { installPointerEffects } from './lib/pointerEffects.js';

installPointerEffects();

// Inside the native Kotlin app (WebView), tag the root so CSS can drop the
// heaviest effects (backdrop blur, continuous animations) that make a WebView
// lag. The website in a real browser keeps them.
try {
  if (/CampusCoinApp/.test(navigator.userAgent || '')) {
    document.documentElement.classList.add('is-app');
  }
} catch {
  /* ignore */
}

// Register the service worker so the app is installable (Chrome needs a SW with
// a fetch handler before it offers "Install app") and opens offline. Only in
// production builds, so Vite's dev server isn't shadowed by a stale cache.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* install just falls back to the manual add-to-home-screen hint */
    });
  });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
