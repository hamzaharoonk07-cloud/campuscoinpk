import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'campus-coin-dev-secret-change-me';

// The token carries the account's session version (`v`), so raising the
// version on the account ends every session that was signed in before it.
export const signToken = (user) =>
  // Long-lived so the installed app keeps you signed in until you sign out (or
  // change password / "sign out everywhere", which bump tokenVersion). The
  // WebView persists the token, so there's no repeated login.
  jwt.sign({ id: user._id, role: user.role, v: user.tokenVersion || 0 }, JWT_SECRET, { expiresIn: '365d' });

async function userFromRequest(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  let payload;
  try {
    payload = jwt.verify(header.slice(7), JWT_SECRET);
  } catch {
    return null;
  }
  const user = await User.findById(payload.id);
  // A disabled account keeps its token but loses access immediately.
  if (!user || user.disabled) return null;
  // A token from before the last password change or "sign out everywhere".
  if ((payload.v || 0) !== (user.tokenVersion || 0)) return null;
  return user;
}

export async function protect(req, res, next) {
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ message: 'Please log in to continue' });
  req.user = user;
  next();
}

export const allow =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : res.status(403).json({ message: 'You do not have access to this feature' });

/** Wraps an async route so a rejected promise reaches the central error handler. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
