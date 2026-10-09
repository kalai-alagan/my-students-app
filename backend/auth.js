/* Admin authentication — scrypt password hashing + HMAC-signed tokens.
   Uses only Node's built-in crypto, no extra dependencies. */
const crypto = require('crypto');
const { load, save, nextId } = require('./store');

const SECRET = process.env.APP_SECRET || 'edunest-dev-secret-change-me';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours
const DEFAULT_PASSWORD = 'admin123';

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const unb64 = (str) => Buffer.from(str, 'base64url');

function hashPassword(password, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, useSalt, 64).toString('hex');
  return { salt: useSalt, hash };
}

function verifyPassword(password, salt, hash) {
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(test, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function ensureAdmin() {
  const db = load();
  const admin = db.users.find(u => u.username === 'admin');
  if (!admin) {
    const { salt, hash } = hashPassword(DEFAULT_PASSWORD);
    db.users.push({ id: nextId(db.users), username: 'admin', salt, hash, role: 'Administrator' });
    save();
    return;
  }
  if (!admin.hash) {
    const { salt, hash } = hashPassword(DEFAULT_PASSWORD);
    admin.salt = salt;
    admin.hash = hash;
    save();
  }
}

function sign(payload) {
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(unb64(body));
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function issueToken(user) {
  return sign({ sub: user.id, username: user.username, role: user.role, exp: Date.now() + TOKEN_TTL_MS });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verify(token);
  if (!payload) return res.status(401).json({ error: 'Authentication required' });
  req.user = payload;
  next();
}

module.exports = { ensureAdmin, hashPassword, verifyPassword, issueToken, requireAuth, DEFAULT_PASSWORD };
