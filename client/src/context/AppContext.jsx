import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from '../lib/api.js';

const AuthContext = createContext(null);
const ToastContext = createContext(null);
const ThemeContext = createContext(null);

/* ---------------------------------------------------------------------------
   Theme and accessibility
   The choice lives in localStorage so the right theme paints immediately on the
   next visit, and on the user record so it follows them to another device.
--------------------------------------------------------------------------- */

const THEME_KEY = 'campuscoin.theme';
const SCALE_KEY = 'campuscoin.fontScale';

const read = (key, fallback) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

/** True when this device has been given an explicit light/dark choice. */
export const hasLocalTheme = () => ['light', 'dark'].includes(read(THEME_KEY, 'system'));

/** "system" means follow the device; anything else is taken as given. */
const resolveTheme = (theme) =>
  theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;

export function ThemeProvider({ children }) {
  // Light unless this device has been told otherwise.
  const [theme, setThemeState] = useState(() => read(THEME_KEY, 'light'));
  const [fontScale, setScaleState] = useState(() => Number(read(SCALE_KEY, '1')) || 1);

  useEffect(() => {
    const apply = () => document.documentElement.setAttribute('data-theme', resolveTheme(theme));
    apply();
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
    // When following the device, follow it live too.
    if (theme !== 'system') return undefined;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(fontScale));
    try {
      localStorage.setItem(SCALE_KEY, String(fontScale));
    } catch {
      /* ignore */
    }
  }, [fontScale]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: setThemeState,
      fontScale,
      setFontScale: setScaleState,
      // The toggle only ever moves between the two real themes; "system" is a
      // starting point, not a third state to cycle through.
      // Returns the theme it moved to, so the caller can save it to the account.
      toggle: () => {
        const next = resolveTheme(theme) === 'dark' ? 'light' : 'dark';
        setThemeState(next);
        return next;
      },
    }),
    [theme, fontScale]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/* ---------------------------------------------------------------------------
   Toasts
--------------------------------------------------------------------------- */

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (title, { body = '', tone = 'info', ms = 4500, action = null } = {}) => {
      const id = Math.random().toString(36).slice(2);
      // An action (e.g. Undo) is given a little longer to be noticed and tapped.
      const life = ms ?? (action ? 6000 : 4500);
      setToasts((list) => [...list, { id, title, body, tone, action }]);
      if (life) setTimeout(() => dismiss(id), life);
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      push,
      success: (title, body) => push(title, { body, tone: 'good' }),
      error: (title, body) => push(title, { body, tone: 'bad' }),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast is-${toast.tone}`} onClick={() => dismiss(toast.id)}>
            <div className="toast-text">
              <strong>{toast.title}</strong>
              {toast.body ? <span>{toast.body}</span> : null}
            </div>
            {toast.action ? (
              <button
                type="button"
                className="toast-action"
                onClick={(event) => {
                  event.stopPropagation();
                  toast.action.onClick();
                  dismiss(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ---------------------------------------------------------------------------
   Authentication
--------------------------------------------------------------------------- */

/** Leaves a note for the next page to greet the student; read once, then cleared. */
function greetNext(note) {
  try {
    sessionStorage.setItem('campuscoin.welcome', JSON.stringify(note));
  } catch {
    /* private mode: no welcome, nothing else changes */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));
  const { setTheme, setFontScale } = useTheme();

  const adopt = useCallback(
    (account) => {
      setUser(account);
      // Only seed the theme from the account when this device has not been given
      // an explicit choice - otherwise signing in would undo the theme toggle.
      if (account?.preferences?.theme && !hasLocalTheme()) setTheme(account.preferences.theme);
      if (account?.preferences?.fontScale) setFontScale(account.preferences.fontScale);
    },
    [setTheme, setFontScale]
  );

  useEffect(() => {
    if (!getToken()) return;
    api
      .get('/auth/me')
      .then(({ user: account }) => adopt(account))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, [adopt]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin: user?.role === 'admin',
      currency: user?.currency || 'PKR',
      async login(email, password, { admin = false } = {}) {
        const data = await api.post(admin ? '/auth/admin/login' : '/auth/login', { email, password });
        // The password was right, but this account also wants a code from
        // its inbox - no token yet, the caller (Login.jsx) asks for it next.
        if (data.twoFactorRequired) return { twoFactorRequired: true, userId: data.userId };
        setToken(data.token);
        adopt(data.user);
        // The next page shows a short welcome (components/WelcomeBack.jsx).
        if (!admin) greetNext({ kind: 'back', since: data.previousLoginAt });
        return data.user;
      },
      async verifyTwoFactor(userId, code) {
        const data = await api.post('/auth/login/verify-2fa', { userId, code });
        setToken(data.token);
        adopt(data.user);
        greetNext({ kind: 'back' });
        return data.user;
      },
      async register(payload) {
        const data = await api.post('/auth/register', payload);
        setToken(data.token);
        adopt(data.user);
        greetNext({ kind: 'new' });
        return data.user;
      },
      async loginWithGoogle(credential) {
        const data = await api.post('/auth/google', { credential });
        setToken(data.token);
        adopt(data.user);
        greetNext({ kind: 'back' });
        return data.user;
      },
      async updateProfile(payload) {
        const data = await api.patch('/auth/me', payload);
        setUser(data.user);
        return data.user;
      },
      logout() {
        setToken(null);
        setUser(null);
      },
      setUser,
    }),
    [user, loading, adopt]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
