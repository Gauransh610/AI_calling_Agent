import 'dotenv/config';
import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import nodemailer from 'nodemailer';
import { UAParser } from 'ua-parser-js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const publicDir = resolve(__dirname, 'public');
const dataDir = resolve(__dirname, 'data');
const dbPath = resolve(dataDir, 'neuracall.sqlite');
const visitLogPath = resolve(dataDir, 'visits.json');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '0.0.0.0';
const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const sessions = new Map();
let visitWriteQueue = Promise.resolve();

await mkdir(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    contact TEXT NOT NULL,
    phone TEXT,
    status TEXT NOT NULL CHECK (status IN ('completed', 'voicemail', 'missed', 'failed')),
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    model TEXT NOT NULL DEFAULT 'llama3.1:8b',
    transcript TEXT NOT NULL DEFAULT '[]',
    summary TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const appServer = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }

    serveStatic(url.pathname, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

if (process.env.NEURACALL_SELF_TEST === '1') {
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  console.log(JSON.stringify({ ok: true, database: dbPath, userCount }, null, 2));
} else {
  appServer.listen(port, host, () => {
    console.log(`neuraCall React app running at http://${host}:${port}`);
    console.log(`SQLite database: ${dbPath}`);
  });
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, database: dbPath });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/visits') {
    const body = await readJson(req);
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 1000);
    const userAgentInfo = new UAParser(userAgent).getResult();
    const visit = {
      timestamp: new Date().toISOString(),
      ip: getClientIp(req),
      userAgent,
      device: userAgentInfo.device.type || 'desktop',
      browser: userAgentInfo.browser.name || 'Unknown',
      os: userAgentInfo.os.name || 'Unknown',
      page: cleanVisitPage(body.page),
      referrer: cleanVisitReferrer(body.referrer)
    };

    try {
      await appendVisit(visit);
      sendJson(res, 201, { ok: true });
    } catch (error) {
      console.error('Visit tracking failed:', error.message);
      sendJson(res, 500, { error: 'Could not record visit.' });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/signup') {
    const body = await readJson(req);
    const name = cleanText(body.name);
    const email = cleanEmail(body.email);
    const password = String(body.password || '');

    if (!name || !email || password.length < 6) {
      sendJson(res, 400, { error: 'Name, valid email, and 6+ character password are required.' });
      return;
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      sendJson(res, 409, { error: 'An account with this email already exists.' });
      return;
    }

    const passwordData = hashPassword(password);
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, password_salt)
      VALUES (?, ?, ?, ?)
    `).run(name, email, passwordData.hash, passwordData.salt);

    const user = getUserById(result.lastInsertRowid);
    const token = createSession(user.id);
    sendJson(res, 201, { token, user });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await readJson(req);
    const email = cleanEmail(body.email);
    const password = String(body.password || '');
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!row || !verifyPassword(password, row.password_hash, row.password_salt)) {
      sendJson(res, 401, { error: 'Invalid email or password.' });
      return;
    }

    const user = publicUser(row);
    const token = createSession(user.id);
    void sendLoginEmail(user);
    sendJson(res, 200, { token, user });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const token = getBearerToken(req);
    if (token) sessions.delete(token);
    sendJson(res, 200, { ok: true });
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) return;

  if (req.method === 'GET' && url.pathname === '/api/me') {
    sendJson(res, 200, { user: auth.user });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/calls') {
    const rows = db.prepare(`
      SELECT * FROM calls
      WHERE user_id = ?
      ORDER BY datetime(started_at) DESC, id DESC
    `).all(auth.user.id);

    sendJson(res, 200, { calls: rows.map(publicCall) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/calls') {
    const body = await readJson(req);
    const contact = cleanText(body.contact) || 'Unknown Contact';
    const phone = cleanText(body.phone);
    const status = ['completed', 'voicemail', 'missed', 'failed'].includes(body.status) ? body.status : 'completed';
    const durationSeconds = Math.max(0, Number.parseInt(body.durationSeconds || 0, 10));
    const transcript = Array.isArray(body.transcript) ? body.transcript.map(normalizeTranscriptMessage) : [];
    const summary = cleanText(body.summary) || summarizeTranscript(contact, transcript);
    const startedAt = isIsoDate(body.startedAt) ? body.startedAt : new Date(Date.now() - durationSeconds * 1000).toISOString();
    const endedAt = isIsoDate(body.endedAt) ? body.endedAt : new Date().toISOString();
    const model = cleanText(body.model) || 'llama3.1:8b';

    const result = db.prepare(`
      INSERT INTO calls (user_id, contact, phone, status, duration_seconds, model, transcript, summary, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(auth.user.id, contact, phone, status, durationSeconds, model, JSON.stringify(transcript), summary, startedAt, endedAt);

    const call = db.prepare('SELECT * FROM calls WHERE id = ?').get(result.lastInsertRowid);
    sendJson(res, 201, { call: publicCall(call), stats: getStats(auth.user.id) });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/stats') {
    sendJson(res, 200, { stats: getStats(auth.user.id) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/agent/reply') {
    const body = await readJson(req);
    const contact = cleanText(body.contact) || 'the caller';
    const userMessage = cleanText(body.message);
    const history = Array.isArray(body.history) ? body.history.slice(-12) : [];

    if (!userMessage) {
      sendJson(res, 400, { error: 'message is required.' });
      return;
    }

    try {
      const reply = await getOllamaReply(contact, history, userMessage);
      sendJson(res, 200, { reply });
    } catch (error) {
      console.error('Ollama error:', error.message);
      sendJson(res, 502, {
        error: 'The AI service is unavailable. Configure OLLAMA_BASE_URL to an Ollama server reachable by the backend and ensure OLLAMA_MODEL is available.'
      });
    }
    return;
  }

  sendJson(res, 404, { error: 'API route not found.' });
}

async function getOllamaReply(contact, history, userMessage) {
  const messages = [
    {
      role: 'system',
      content: `You are neuraCall, a friendly AI phone assistant currently on a live call with ${contact}. Keep replies short and conversational, like real spoken dialogue - 1 to 3 sentences max. Never mention that you are an AI language model; just stay in character as the calling agent.`
    },
    ...history.map((entry) => ({
      role: entry.speaker === 'contact' ? 'user' : 'assistant',
      content: entry.text
    })),
    {
      role: 'user',
      content: userMessage
    }
  ];

  const headers = {
    'Content-Type': 'application/json'
  };


  if (process.env.OLLAMA_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
  }

  console.log('Ollama request:', {
    baseUrl: ollamaBaseUrl,
    model: ollamaModel,
    hasApiKey: Boolean(process.env.OLLAMA_API_KEY)
  });

  const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: ollamaModel,
      messages,
      stream: false
    })
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Ollama responded with ${response.status}: ${responseText}`
    );
  }

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Invalid JSON response from Ollama: ${responseText}`
    );
  }

  return (
    cleanText(data?.message?.content) ||
    'Sorry, could you repeat that?'
  );
}

function serveStatic(pathname, res) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const resolved = normalize(resolve(publicDir, `.${safePath}`));

  if (!resolved.startsWith(publicDir) || !existsSync(resolved)) {
    sendFile(res, join(publicDir, 'index.html'));
    return;
  }

  sendFile(res, resolved);
}

function sendFile(res, filePath) {
  let content;
  try {
    content = readFileSync(filePath);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Frontend build not found. Run: cd frontend && npm install && npm run build');
    return;
  }

  const ext = extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  res.end(content);
}

function requireAuth(req, res) {
  const token = getBearerToken(req);
  const session = token ? sessions.get(token) : null;

  if (!session) {
    sendJson(res, 401, { error: 'Please log in first.' });
    return null;
  }

  const user = getUserById(session.userId);
  if (!user) {
    sessions.delete(token);
    sendJson(res, 401, { error: 'Session expired.' });
    return null;
  }

  return { token, user };
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

function createSession(userId) {
  const token = randomUUID();
  sessions.set(token, { userId, createdAt: Date.now() });
  return token;
}

function getUserById(id) {
  const row = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(id);
  return row ? publicUser(row) : null;
}

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at
  };
}

function publicCall(row) {
  return {
    id: row.id,
    contact: row.contact,
    phone: row.phone,
    status: row.status,
    durationSeconds: row.duration_seconds,
    model: row.model,
    transcript: safeJson(row.transcript, []),
    summary: row.summary,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at
  };
}

function getStats(userId) {
  const aggregate = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
      AVG(duration_seconds) AS avg_duration
    FROM calls
    WHERE user_id = ?
  `).get(userId);

  const total = Number(aggregate.total || 0);
  const completed = Number(aggregate.completed || 0);
  const storageUsedBytes = getSerializedCallBytes(userId);

  return {
    totalCalls: total,
    successRate: total ? Math.round((completed / total) * 100) : 0,
    avgDurationMinutes: Number(((Number(aggregate.avg_duration || 0)) / 60).toFixed(1)),
    storageUsedBytes,
    storageUsedMb: storageUsedBytes / 1024 / 1024,
    currentModel: 'Llama 3.1 8B'
  };
}

function getSerializedCallBytes(userId) {
  const rows = db.prepare('SELECT * FROM calls WHERE user_id = ?').all(userId);
  return rows.reduce((bytes, row) => bytes + Buffer.byteLength(JSON.stringify(publicCall(row))), 0);
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 120_000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, expectedHash, salt) {
  const actualHash = pbkdf2Sync(password, salt, 120_000, 32, 'sha256');
  const expected = Buffer.from(expectedHash, 'hex');
  return actualHash.length === expected.length && timingSafeEqual(actualHash, expected);
}

function cleanEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-nf-client-connection-ip'] || req.headers['x-forwarded-for'];
  const address = String(forwardedFor || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  return address.replace(/^::ffff:/, '').slice(0, 100);
}

function cleanVisitPage(value) {
  const page = String(value || '/').slice(0, 2048);
  if (!page.startsWith('/') || page.startsWith('//')) return '/';

  try {
    return new URL(page, 'http://localhost').pathname.slice(0, 300) || '/';
  } catch {
    return '/';
  }
}

function cleanVisitReferrer(value) {
  const referrer = String(value || '').trim().slice(0, 2048);
  if (!referrer || referrer === 'direct') return 'direct';
  if (referrer.startsWith('/')) return cleanVisitPage(referrer);

  try {
    const url = new URL(referrer);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return `${url.origin}${url.pathname}`.slice(0, 500);
    }
  } catch {
    return 'direct';
  }

  return 'direct';
}

function appendVisit(visit) {
  const write = visitWriteQueue.catch(() => {}).then(async () => {
    let visits = [];
    try {
      const content = await readFile(visitLogPath, 'utf8');
      visits = JSON.parse(content);
      if (!Array.isArray(visits)) throw new Error('Visit log must contain a JSON array.');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    visits.push(visit);
    await writeFile(visitLogPath, `${JSON.stringify(visits, null, 2)}\n`, { mode: 0o600 });
  });
  visitWriteQueue = write;
  return write;
}

async function sendLoginEmail(user) {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD } = process.env;
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASSWORD) {
    console.info('Login email skipped: configure EMAIL_HOST, EMAIL_PORT, EMAIL_USER, and EMAIL_PASSWORD.');
    return;
  }

  const port = Number(EMAIL_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('Login email delivery failed: EMAIL_PORT must be a valid port number.');
    return;
  }

  const name = user.name || 'there';
  const escapedName = escapeHtml(name);
  const text = `Hi ${name},\n\nThank you for logging in to our website!\n\nYour login was successful. You can now continue using your account and access all available features.\n\nIf you did not perform this login, please secure your account and contact us immediately.\n\nThanks,\nThe neuraCall Team`;
  const html = `<div style="max-width:560px;margin:0 auto;padding:36px 24px;font-family:Arial,sans-serif;color:#17202a;line-height:1.6"><h1 style="font-size:24px;margin:0 0 24px">Hi ${escapedName},</h1><p>Thank you for logging in to our website!</p><p>Your login was successful. You can now continue using your account and access all available features.</p><p>If you did not perform this login, please secure your account and contact us immediately.</p><p style="margin-top:28px">Thanks,<br><strong>The neuraCall Team</strong></p></div>`;
  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port,
    secure: port === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD }
  });

  try {
    await transporter.sendMail({
      from: { name: 'neuraCall', address: EMAIL_USER },
      to: user.email,
      subject: 'Thank You for Logging In!',
      text,
      html
    });
  } catch (error) {
    console.error('Login email delivery failed:', error.code || error.message);
  } finally {
    transporter.close();
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function normalizeTranscriptMessage(message) {
  return {
    speaker: message?.speaker === 'contact' || message?.speaker === 'user' ? 'contact' : 'agent',
    text: cleanText(message?.text).slice(0, 1200),
    at: isIsoDate(message?.at) ? message.at : new Date().toISOString()
  };
}

function summarizeTranscript(contact, transcript) {
  const lastMessage = transcript.at(-1)?.text || 'No transcript captured.';
  return `Saved call with ${contact}. Last message: ${lastMessage}`;
}

function isIsoDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error('Request body too large');
  }

  if (!body) return {};
  return JSON.parse(body);
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}
