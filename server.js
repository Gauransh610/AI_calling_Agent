import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const publicDir = resolve(__dirname, 'public');
const dataDir = resolve(__dirname, 'data');
const dbPath = resolve(dataDir, 'neuracall.sqlite');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const sessions = new Map();

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

seedDemoData();

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
  const demoUser = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@neuracall.dev');
  const demoStats = demoUser ? getStats(demoUser.id) : null;
  console.log(JSON.stringify({ ok: Boolean(demoUser), database: dbPath, stats: demoStats }, null, 2));
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
        error: 'Could not reach Ollama. Make sure "ollama serve" is running and the model is pulled.'
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
    { role: 'user', content: userMessage }
  ];

  const response = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama3.1:8b', messages, stream: false })
  });

  if (!response.ok) {
    throw new Error(`Ollama responded with ${response.status}`);
  }

  const data = await response.json();
  return cleanText(data?.message?.content) || "Sorry, could you repeat that?";
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

  return {
    totalCalls: total,
    successRate: total ? Math.round((completed / total) * 100) : 0,
    avgDurationMinutes: Number(((Number(aggregate.avg_duration || 0)) / 60).toFixed(1)),
    storageUsedMb: Number(((getSerializedCallBytes(userId) / 1024 / 1024) || 0).toFixed(2)),
    currentModel: 'Llama 3.1 8B'
  };
}

function getSerializedCallBytes(userId) {
  const rows = db.prepare('SELECT transcript, summary FROM calls WHERE user_id = ?').all(userId);
  return rows.reduce((bytes, row) => bytes + Buffer.byteLength(`${row.transcript || ''}${row.summary || ''}`), 0);
}

function seedDemoData() {
  const demoEmail = 'demo@neuracall.dev';
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(demoEmail);
  let userId = existing?.id;

  if (!userId) {
    const passwordData = hashPassword('demo1234');
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, password_salt)
      VALUES (?, ?, ?, ?)
    `).run('Alex Rivera', demoEmail, passwordData.hash, passwordData.salt);
    userId = result.lastInsertRowid;
  }

  const count = db.prepare('SELECT COUNT(*) AS count FROM calls WHERE user_id = ?').get(userId).count;
  if (count > 0) return;

  const seedCalls = [
    {
      contact: 'Linda Chen',
      phone: '+1 555 0129',
      status: 'completed',
      duration: 434,
      minutesAgo: 31,
      transcript: [
        { speaker: 'agent', text: 'Hello Linda, this is Alex’s AI assistant. Do you have a moment?' },
        { speaker: 'contact', text: 'Yes, this is a good time.' },
        { speaker: 'agent', text: 'Great. I am confirming your product demo for next Tuesday at 10.' }
      ],
      summary: 'Confirmed the product demo for next Tuesday at 10.'
    },
    {
      contact: 'Michael Torres',
      phone: '+1 555 0190',
      status: 'completed',
      duration: 770,
      minutesAgo: 1500,
      transcript: [
        { speaker: 'agent', text: 'Following up on the support ticket.' },
        { speaker: 'contact', text: 'The issue is fixed now, thank you.' }
      ],
      summary: 'Confirmed support issue was resolved.'
    },
    {
      contact: 'Rachel Kim',
      phone: '+1 555 0162',
      status: 'voicemail',
      duration: 202,
      minutesAgo: 1780,
      transcript: [
        { speaker: 'agent', text: 'Leaving a reminder about tomorrow’s appointment.' }
      ],
      summary: 'Left appointment reminder voicemail.'
    }
  ];

  const insert = db.prepare(`
    INSERT INTO calls (user_id, contact, phone, status, duration_seconds, model, transcript, summary, started_at, ended_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const call of seedCalls) {
    const endedAt = new Date(Date.now() - call.minutesAgo * 60_000);
    const startedAt = new Date(endedAt.getTime() - call.duration * 1000);
    insert.run(
      userId,
      call.contact,
      call.phone,
      call.status,
      call.duration,
      'llama3.1:8b',
      JSON.stringify(call.transcript),
      call.summary,
      startedAt.toISOString(),
      endedAt.toISOString()
    );
  }
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
