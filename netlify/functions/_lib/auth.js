// _lib/auth.js
// Autenticação compartilhada: hash de senha (scrypt nativo do Node) + sessões via Netlify Blobs.
// Mesmo padrão usado no Trem Forge.

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const USERS_STORE = 'elaris-users';
const SESSIONS_STORE = 'elaris-sessions';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias

function usersStore() {
  return getStore(USERS_STORE);
}
function sessionsStore() {
  return getStore(SESSIONS_STORE);
}

// ---------- Senhas ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

// ---------- Usuários ----------
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function getUserByEmail(email) {
  const store = usersStore();
  const key = normalizeEmail(email);
  const raw = await store.get(key, { type: 'json' });
  return raw || null;
}

async function createUser({ name, email, password, orgName }) {
  const store = usersStore();
  const key = normalizeEmail(email);
  const existing = await store.get(key, { type: 'json' });
  if (existing) {
    const err = new Error('E-mail já cadastrado.');
    err.statusCode = 409;
    throw err;
  }
  const user = {
    id: crypto.randomUUID(),
    name: name || '',
    email: key,
    orgName: orgName || '',
    passwordHash: hashPassword(password),
    plan: 'free',
    planStatus: 'active',
    planProvider: null,
    planCurrency: 'BRL',
    coinsBalance: 0,
    createdAt: new Date().toISOString(),
  };
  await store.setJSON(key, user);
  await store.setJSON(`id:${user.id}`, user);
  return user;
}

async function saveUser(user) {
  const store = usersStore();
  await store.setJSON(user.email, user);
  await store.setJSON(`id:${user.id}`, user);
}

// ---------- Sessões ----------
function newSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

async function createSession(userId) {
  const store = sessionsStore();
  const sessionId = newSessionId();
  const session = {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  await store.setJSON(sessionId, session);
  return sessionId;
}

async function getSession(sessionId) {
  if (!sessionId) return null;
  const store = sessionsStore();
  const session = await store.get(sessionId, { type: 'json' });
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    await store.delete(sessionId);
    return null;
  }
  return session;
}

async function destroySession(sessionId) {
  if (!sessionId) return;
  const store = sessionsStore();
  await store.delete(sessionId);
}

// ---------- Cookies ----------
function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const [k, ...v] = part.trim().split('=');
    if (k) out[k] = decodeURIComponent(v.join('='));
  });
  return out;
}

function sessionCookie(sessionId, { clear = false } = {}) {
  const maxAge = clear ? 0 : Math.floor(SESSION_TTL_MS / 1000);
  const value = clear ? '' : sessionId;
  return `elaris_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

// Retorna o usuário logado a partir do cookie da requisição, ou null.
async function getUserFromEvent(event) {
  const cookies = parseCookies(event.headers && event.headers.cookie);
  const sessionId = cookies['elaris_session'];
  const session = await getSession(sessionId);
  if (!session) return null;
  const store = usersStore();
  const byId = await store.get(`id:${session.userId}`, { type: 'json' });
  return byId || null;
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

module.exports = {
  hashPassword,
  verifyPassword,
  normalizeEmail,
  getUserByEmail,
  createUser,
  saveUser,
  createSession,
  getSession,
  destroySession,
  parseCookies,
  sessionCookie,
  getUserFromEvent,
  publicUser,
  usersStore,
  sessionsStore,
};
