import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import Avatar from './Avatar.jsx';
import { ArtIcon, artUrl } from './Illustrations.jsx';
import CoinBot from './CoinBot.jsx';
import { api } from '../lib/api.js';
import { slotColor } from '../lib/format.js';
import { useAuth } from '../context/AppContext.jsx';

// The conversation lives in sessionStorage, not the database: it survives moving
// between pages (the floating bubble and the full page share it) and disappears
// when the tab closes. Nothing a student types here is stored on the server.
const HISTORY_KEY = 'campuscoin.chat';

const loadHistory = () => {
  try {
    return JSON.parse(sessionStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
};

const saveHistory = (messages) => {
  try {
    // The last 40 are plenty to scroll back through; older ones are dropped.
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-40)));
  } catch {
    /* private mode - the chat still works, it just will not survive navigation */
  }
};

/** The picture for a suggested question, from the words in it. */
const chipArt = (text) => {
  const t = text.toLowerCase();
  if (/budget|within|cap/.test(t)) return 'bullseye';
  if (/tip|save|saving/.test(t)) return 'light-bulb';
  if (/where|go|categor/.test(t)) return 'bar-chart';
  if (/food|eat/.test(t)) return 'hamburger';
  if (/afford|can i/.test(t)) return 'money-bag';
  return 'chart-increasing';
};

/** One assistant reply: the sentence, then any figures and a link to go deeper. */
function Answer({ message }) {
  return (
    <>
      <p>{message.text}</p>
      {message.rows?.length ? (
        <dl className="chat-rows">
          {message.rows.map((row) => (
            <div key={row.label} className={row.tone ? `is-${row.tone}` : undefined}>
              <dt>
                {row.slot ? <i className="swatch" style={{ background: slotColor(row.slot) }} /> : null}
                {row.label}
              </dt>
              <dd className="num">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {message.link ? (
        <Link className="chat-link" to={message.link.to}>
          {message.link.label}
          <Icon name="right" size={14} />
        </Link>
      ) : null}
      {message.source === 'claude' ? <span className="chat-source">Worded from your own figures</span> : null}
    </>
  );
}

/**
 * The chat itself. `compact` is the floating panel; the full page passes
 * nothing. Both read and write the same history.
 */
export default function Chat({ compact = false, question = null, onAsked }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState(loadHistory);
  const [opening, setOpening] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    api
      .get('/ai/chat')
      .then(setOpening)
      .catch(() => setOpening({ greeting: 'Ask me anything about your spending.', chips: [] }));
  }, []);

  useEffect(() => saveHistory(messages), [messages]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, opening]);

  const chips = opening?.chips || [];

  const ask = async (text) => {
    const question = text.trim();
    if (!question || busy) return;
    setDraft('');
    setMessages((list) => [...list, { from: 'me', text: question }]);
    setBusy(true);
    try {
      const reply = await api.post('/ai/chat', { message: question });
      setMessages((list) => [
        ...list,
        { from: 'bot', text: reply.reply, rows: reply.rows, link: reply.link, source: reply.source },
      ]);
    } catch (err) {
      setMessages((list) => [...list, { from: 'bot', text: `Something went wrong: ${err.message}` }]);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  };

  // A question handed in from outside (the dashboard's assistant card). The
  // ref stops React's development double-run from asking it twice.
  const asked = useRef(null);
  useEffect(() => {
    if (!question || asked.current === question) return;
    asked.current = question;
    ask(question);
    onAsked?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ask only when a new question arrives
  }, [question]);

  const clear = () => setMessages([]);

  return (
    <div className={`chat${compact ? ' is-compact' : ''}`}>
      <div className="chat-log" ref={scroller} aria-live="polite">
        {opening ? (
          <>
            <div className="chat-msg is-bot">
              <span className="chat-avatar is-bot" aria-hidden="true">
                <CoinBot size={30} bubble={false} />
              </span>
              <div className="chat-bubble">
                <p>{opening.greeting}</p>
              </div>
            </div>
            {opening.tip ? (
              <div className="chat-msg is-bot">
                <span className="chat-avatar is-bot" aria-hidden="true">
                  <ArtIcon name="light_bulb" size={24} />
                </span>
                <div className="chat-bubble is-tip">
                  <strong>Tip of the day</strong>
                  <p>{opening.tip.body}</p>
                  <span className="chat-impact">Worth up to {opening.tip.impact} a month</span>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="chat-msg is-bot">
            <span className="chat-avatar is-bot" aria-hidden="true">
              <CoinBot size={30} bubble={false} />
            </span>
            <div className="chat-bubble">
              <span className="chat-typing" aria-label="Loading">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        )}

        {opening && messages.length === 0 && chips.length ? (
          <div className="chat-start">
            <span className="chat-start-label">Try asking</span>
            <div className="chat-start-grid">
              {chips.slice(0, 4).map((chip) => (
                <button key={chip} type="button" onClick={() => ask(chip)} disabled={busy}>
                  <img src={artUrl(chipArt(chip))} alt="" width="28" height="28" />
                  <span>{chip}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message, i) => (
          // eslint-disable-next-line react/no-array-index-key -- messages are append-only
          <div key={i} className={`chat-msg ${message.from === 'me' ? 'is-me' : 'is-bot'}`}>
            {message.from === 'me' ? (
              <Avatar user={user} size={30} className="chat-me" />
            ) : (
              <span className="chat-avatar is-bot" aria-hidden="true">
                <CoinBot size={30} bubble={false} />
              </span>
            )}
            <div className="chat-bubble">{message.from === 'me' ? <p>{message.text}</p> : <Answer message={message} />}</div>
          </div>
        ))}

        {busy ? (
          <div className="chat-msg is-bot">
            <span className="chat-avatar is-bot" aria-hidden="true">
              <CoinBot size={30} bubble={false} talking />
            </span>
            <div className="chat-bubble">
              <span className="chat-typing" aria-label="Thinking">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {chips.length && messages.length ? (
        <div className="chat-chips" role="group" aria-label="Suggested questions">
          {chips.map((chip) => (
            <button key={chip} type="button" className="chip" onClick={() => ask(chip)} disabled={busy}>
              {chip}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="chat-compose"
        onSubmit={(event) => {
          event.preventDefault();
          ask(draft);
        }}
      >
        <label className="sr-only" htmlFor={compact ? 'chat-input-mini' : 'chat-input'}>
          Ask about your money
        </label>
        <input
          id={compact ? 'chat-input-mini' : 'chat-input'}
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about your money..."
          autoComplete="off"
          maxLength={500}
        />
        {messages.length ? (
          <button type="button" className="icon-btn" onClick={clear} aria-label="Clear the conversation" title="Clear">
            <Icon name="trash" size={16} />
          </button>
        ) : null}
        <button type="submit" className="chat-send" disabled={!draft.trim() || busy} aria-label="Send">
          <Icon name="send" size={17} />
        </button>
      </form>
    </div>
  );
}
