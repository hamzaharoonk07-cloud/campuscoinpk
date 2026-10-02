import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import Icon, { BrandMark } from './Icon.jsx';
import CoinBot from './CoinBot.jsx';
import Chat from './Chat.jsx';
import WelcomeBack from './WelcomeBack.jsx';
import FeatureGuide from './FeatureGuide.jsx';
import Notifications from './Notifications.jsx';
import Avatar from './Avatar.jsx';
import { api } from '../lib/api.js';
import { useAuth, useTheme } from '../context/AppContext.jsx';

// Every destination has a 3D object (client/public/art) for the rail, the
// phone tab bar and its page header, and a line saying what the page is for.
const STUDENT_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'grid', art: 'house', about: 'Your month at a glance' },
  { to: '/transactions', label: 'Transactions', icon: 'ledger', art: 'receipt', about: 'Everything that came in and went out' },
  { to: '/udhaar', label: 'Udhaar', icon: 'user', art: 'busts_in_silhouette', about: 'Who owes whom, and gentle reminders' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar', art: 'spiral_calendar', about: 'Your money, day by day' },
  { to: '/budgets', label: 'Budgets', icon: 'target', art: 'bullseye', about: 'A cap for each category, filling in real time' },
  { to: '/reports', label: 'Reports', icon: 'chart', art: 'bar_chart', about: 'Where it went, by category, day and week' },
  { to: '/insights', label: 'Insights', icon: 'spark', art: 'sparkles', about: 'Your month, in plain words' },
  { to: '/tips', label: 'Saving tips', icon: 'bulb', art: 'light_bulb', about: 'Ranked by what they would save you' },
  { to: '/categories', label: 'Categories', icon: 'tag', art: 'label', about: 'How your money is sorted' },
];

const SECONDARY_NAV = [
  { to: '/settings', label: 'Settings', icon: 'sliders', art: 'gear', about: 'Profile, photo and display' },
];

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: 'chart', art: 'bar_chart', about: 'How Campus Coin is being used' },
  { to: '/admin/students', label: 'Students', icon: 'user', art: 'busts_in_silhouette', about: 'Every student account' },
  { to: '/admin/categories', label: 'Default categories', icon: 'tag', art: 'card_index_dividers', about: 'The categories every student starts with' },
  { to: '/admin/announcements', label: 'Announcements', icon: 'bell', art: 'megaphone', about: 'Notices and tip templates for everyone' },
];

const ALL_NAV = [...STUDENT_NAV, ...SECONDARY_NAV, ...ADMIN_NAV];
const pageFor = (path) =>
  ALL_NAV.filter((item) => path === item.to || path.startsWith(`${item.to}/`)).sort((a, b) => b.to.length - a.to.length)[0];

/** Searches every transaction from the top bar. */
function RailSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const field = useRef(null);

  // Pressing "/" anywhere outside a text field jumps to the search box.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== '/' || /input|textarea|select/i.test(event.target.tagName)) return;
      event.preventDefault();
      field.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const submit = (event) => {
    event.preventDefault();
    navigate(q.trim() ? `/transactions?q=${encodeURIComponent(q.trim())}` : '/transactions');
  };
  return (
    <form className="top-search" role="search" onSubmit={submit}>
      <Icon name="search" size={16} />
      <input
        ref={field}
        type="search"
        placeholder="Search"
        aria-label="Search transactions"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <kbd>/</kbd>
    </form>
  );
}

/** Where the rail's highlight last sat, so the next page can slide it from there. */
let lastRailSpot = null;

/** The five destinations that earn a place in the phone tab bar. */
const TAB_NAV = STUDENT_NAV.slice(0, 4);

/**
 * The phone's bottom bar: four pages and a "More" button that opens a sheet
 * with every page, so nothing in the menu is out of reach on a phone.
 */
function TabBar({ onSignOut }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const inMore = !TAB_NAV.some((item) => location.pathname === item.to);

  return (
    <>
      {open ? (
        <div className="more-sheet" role="dialog" aria-label="All pages">
          <button type="button" className="more-backdrop" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="more-panel">
            <span className="more-grip" aria-hidden="true" />
            <strong className="more-title">All pages</strong>
            <div className="more-grid">
              {[...STUDENT_NAV, ...SECONDARY_NAV].map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => `more-item${isActive ? ' is-on' : ''}`}>
                  <span className="more-icon">
                    <Icon name={item.icon} size={20} />
                  </span>
                  <span className="more-label">{item.label}</span>
                  <small>{item.about}</small>
                </NavLink>
              ))}
            </div>
            <button type="button" className="more-signout" onClick={onSignOut}>
              <Icon name="logout" size={17} />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
      <nav className="tabbar" aria-label="Sections">
        {TAB_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className={location.pathname === item.to ? 'active' : undefined}>
            <Icon name={item.icon} size={20} />
            {item.label.split(' ')[0]}
          </NavLink>
        ))}
        <button type="button" className={`tab-more${inMore || open ? ' active' : ''}`} onClick={() => setOpen((was) => !was)} aria-expanded={open}>
          <Icon name={open ? 'x' : 'more'} size={20} strokeWidth={open ? 1.75 : 3.2} />
          More
        </button>
      </nav>
    </>
  );
}

/**
 * The picture in the top bar opens a small menu with the account's name,
 * Settings and Sign out. It is there on every screen size - on a phone the
 * rail is hidden, and this is the way out.
 */
function AccountMenu({ onSignOut }) {
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const holder = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!holder.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="has-menu" ref={holder}>
      <button
        type="button"
        className="account-btn"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Your account"
      >
        <Avatar user={user} size={34} />
      </button>
      {open ? (
        <div className="menu account-menu" role="menu">
          <div className="account-menu-head">
            <Avatar user={user} size={42} />
            <div style={{ minWidth: 0 }}>
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
          </div>
          {!isAdmin ? (
            <Link to="/settings" className="account-menu-item" role="menuitem">
              <Icon name="user" size={16} />
              Settings and photo
            </Link>
          ) : null}
          <button type="button" className="account-menu-item is-danger" role="menuitem" onClick={onSignOut}>
            <Icon name="logout" size={16} />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ThemeButton() {
  const { theme, toggle } = useTheme();
  const { updateProfile } = useAuth();
  const showing = theme === 'system' ? 'matching your device' : theme;

  // The choice is saved to the account as well as this device, so it carries
  // over to a phone or a lab machine without being set again.
  const flip = async (event) => {
    let next;
    const apply = () => {
      next = toggle();
      // Set straight away rather than waiting for the theme effect, so the
      // view transition below captures the new colours.
      document.documentElement.setAttribute('data-theme', next);
    };

    // Where supported, the new theme spreads out in a circle from the button.
    // The browser snapshots the page before and after, and motion.css clips
    // the new snapshot to a growing circle centred on the click.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !reduced) {
      const root = document.documentElement;
      root.style.setProperty('--vt-x', `${event.clientX}px`);
      root.style.setProperty('--vt-y', `${event.clientY}px`);
      await document.startViewTransition(() => flushSync(apply)).updateCallbackDone;
    } else {
      apply();
    }

    try {
      await updateProfile({ preferences: { theme: next } });
    } catch {
      /* the theme already changed locally; the saved copy can wait */
    }
  };

  return (
    <button type="button" className="icon-btn" onClick={flip} aria-label={`Switch theme (currently ${showing})`} title={`Theme: ${showing}`}>
      <Icon name={theme === 'light' ? 'moon' : 'sun'} />
    </button>
  );
}

/**
 * The chat bubble in the corner of every student page - the SRS's "AI ChatBot",
 * built in rather than embedded from tawk.to or Tidio so it can answer from the
 * student's own data. Anything on a page can open it by dispatching the
 * "campuscoin:open-chat" event (see openChat below).
 */
function ChatLauncher() {
  const [open, setOpen] = useState(false);
  // A question handed over from elsewhere on the page, asked as the chat opens.
  const [question, setQuestion] = useState(null);
  const location = useLocation();
  // A short "need help?" bubble, once per browser session, then never again.
  const [hint, setHint] = useState(false);
  // The button tucks away while the page scrolls, so it never sits on top of
  // what the student is reading, and comes back once scrolling stops.
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    let timer;
    const onScroll = () => {
      setTucked(true);
      clearTimeout(timer);
      timer = setTimeout(() => setTucked(false), 700);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    let seen = true;
    try {
      seen = sessionStorage.getItem('campuscoin.chatHint') === '1';
      sessionStorage.setItem('campuscoin.chatHint', '1');
    } catch {
      /* private mode: skip the hint */
    }
    if (seen) return undefined;
    const show = setTimeout(() => setHint(true), 2200);
    const hide = setTimeout(() => setHint(false), 9000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    const show = (event) => {
      setHint(false);
      setQuestion(event.detail?.question || null);
      setOpen(true);
    };
    window.addEventListener('campuscoin:open-chat', show);
    return () => window.removeEventListener('campuscoin:open-chat', show);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {open && (
        <div className="chat-popover" role="dialog" aria-label="Campus Coin assistant">
          <div className="chat-popover-head">
            <span className="chat-bot-face" aria-hidden="true">
              <CoinBot size={38} bubble={false} />
              <i className="chat-online" />
            </span>
            <div style={{ marginRight: 'auto' }}>
              <strong>Coin</strong>
              <span>
                <i className="chat-online-dot" /> Online · answers from your own money
              </span>
            </div>
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close the assistant">
              <Icon name="x" size={16} />
            </button>
          </div>
          <Chat compact question={question} onAsked={() => setQuestion(null)} />
        </div>
      )}
      {hint && !open ? (
        <button type="button" className="chat-hint" onClick={() => setOpen(true)}>
          <strong>Need help with your money?</strong>
          <span>Ask Coin anything, like "how much on food?"</span>
        </button>
      ) : null}
      <button
        type="button"
        className={`chat-fab${open ? ' is-open' : ''}${tucked && !open ? ' is-tucked' : ''}`}
        onClick={() => {
          setHint(false);
          setOpen((was) => !was);
        }}
        aria-expanded={open}
        aria-label={open ? 'Close the assistant' : 'Ask the assistant'}
      >
        {open ? <Icon name="x" size={22} /> : <CoinBot size={46} />}
      </button>
    </>
  );
}

export default function Layout({ title, subtitle, crumbs, actions, children }) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const nav = isAdmin ? ADMIN_NAV : STUDENT_NAV;
  const page = pageFor(location.pathname);
  const rail = useRef(null);
  const indicator = useRef(null);
  // Every page renders its own Layout, so the rail is rebuilt on each
  // navigation. The highlight still slides from the previous item because
  // its last position is kept outside React (lastRailSpot), placed there
  // instantly, then moved to the new active item.
  useLayoutEffect(() => {
    const bar = indicator.current;
    const active = rail.current?.querySelector('a.active');
    if (!bar) return;
    if (!active) {
      bar.style.opacity = '0';
      return;
    }
    const to = { top: active.offsetTop, height: active.offsetHeight };
    const place = (spot) => {
      bar.style.transform = `translateY(${spot.top}px)`;
      bar.style.height = `${spot.height}px`;
    };
    bar.style.opacity = '1';
    bar.style.transition = 'none';
    place(lastRailSpot || to);
    bar.getBoundingClientRect(); // commit the starting point before animating
    bar.style.transition = '';
    const frame = requestAnimationFrame(() => place(to));
    lastRailSpot = to;
    return () => cancelAnimationFrame(frame);
  }, [location.pathname]);

  const signOut = () => {
    logout();
    navigate(isAdmin ? '/admin/login' : '/login');
  };

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {/* A thin bar that sweeps across the top as each page opens. */}
      <span className="route-progress" aria-hidden="true" />

      {/* Soft blue lights drifting through the frame (styles/live.css). */}
      <div className="app-glow" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      <nav className="rail" aria-label="Main" ref={rail}>
        <span className="rail-indicator" ref={indicator} aria-hidden="true" />
        <Link to={isAdmin ? '/admin' : '/dashboard'} className="rail-brand" aria-label="Campus Coin home">
          <BrandMark size={40} />
          {/* Shown when the rail opens on hover (design9.css). */}
          <span className="rail-brand-name" aria-hidden="true">
            Campus Coin{isAdmin ? <small>Admin</small> : null}
          </span>
        </Link>

        {nav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/admin'} className="rail-btn" aria-label={item.label}>
            <Icon name={item.icon} size={20} />
            <span className="rail-tip">{item.label}</span>
          </NavLink>
        ))}

        <div className="rail-spacer" />

        {!isAdmin
          ? SECONDARY_NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className="rail-btn" aria-label={item.label}>
                <Icon name={item.icon} size={20} />
                <span className="rail-tip">{item.label}</span>
              </NavLink>
            ))
          : null}

        <button type="button" className="rail-btn rail-item" onClick={signOut} aria-label="Sign out">
          <Icon name="logout" size={20} />
          <span className="rail-tip">Sign out</span>
        </button>

      </nav>

      <div className="main">
        <header className="topbar">
          <div style={{ marginRight: 'auto', minWidth: 0 }}>
            {crumbs ? <div className="crumbs">{crumbs}</div> : null}
            <h1>{title}</h1>
            {subtitle || page ? <div className={`topbar-about${subtitle ? ' is-personal' : ''}`}>{subtitle || page.about}</div> : null}
          </div>
          {!isAdmin && <RailSearch />}
          {actions}
          {!isAdmin && <Notifications />}
          <ThemeButton />
          <AccountMenu onSignOut={signOut} />
        </header>

        <main id="main" className="page">
          {/* After an administrator reset, every page asks for a new password
              until the student has chosen one. */}
          {user?.mustChangePassword ? (
            <div className="must-change" role="alert">
              <Icon name="key" size={16} />
              <span>You are using a temporary password. Choose your own to keep your account safe.</span>
              <Link to="/settings#password" className="btn btn-sm btn-primary">
                Choose a password
              </Link>
            </div>
          ) : null}
          {children}
        </main>
      </div>

      {!isAdmin && <ChatLauncher />}
      {!isAdmin && <WelcomeBack />}
      {!isAdmin && <FeatureGuide />}

      {!isAdmin && (
        <TabBar onSignOut={signOut} />
      )}
    </div>
  );
}

/** Shared month stepper used by the dashboard, reports and budgets. */
export function MonthPicker({ value, onChange, label = 'Month' }) {
  const [year, month] = value.split('-').map(Number);
  const shown = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const move = (by) => {
    const next = new Date(Date.UTC(year, month - 1 + by, 1));
    onChange(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`);
  };

  const isFuture = new Date(Date.UTC(year, month - 1, 1)) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  return (
    <div className="row" role="group" aria-label={label}>
      <button type="button" className="icon-btn" onClick={() => move(-1)} aria-label="Previous month">
        <Icon name="left" />
      </button>
      <strong style={{ minWidth: '9.5rem', textAlign: 'center', fontSize: 'var(--step-0)' }}>{shown}</strong>
      <button type="button" className="icon-btn" onClick={() => move(1)} disabled={isFuture} aria-label="Next month">
        <Icon name="right" />
      </button>
    </div>
  );
}

/** Opens the chat bubble from anywhere on a page, optionally asking a question. */
export const openChat = (question) =>
  window.dispatchEvent(new CustomEvent('campuscoin:open-chat', { detail: { question: typeof question === 'string' ? question : null } }));
