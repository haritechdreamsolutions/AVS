import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './database/pg_pool.js';
import { verifySchema } from './database/migrate.js';
import { csrf } from './security.js';
import routes from './routes.js';

export const app = express();
const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 5000);
const frontend = process.env.FRONTEND_URL || 'http://localhost:4000';
const frontendUrl = new URL(frontend);
const sessionSecret = process.env.SESSION_SECRET || (production ? '' : randomBytes(48).toString('hex'));
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
if (production && (sessionSecret.length < 32 || /REPLACE|CHANGE_ME/i.test(sessionSecret))) throw new Error('A unique SESSION_SECRET of at least 32 characters is required');
if (production && (!process.env.FRONTEND_URL || frontendUrl.protocol !== 'https:' || frontendUrl.username || frontendUrl.password)) throw new Error('Production FRONTEND_URL must be an HTTPS origin');
if (frontend.replace(/\/$/, '') !== frontendUrl.origin) throw new Error('FRONTEND_URL must contain only an origin');

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 'loopback' : false);
const allowedOrigins = new Set(production ? [frontendUrl.origin] : [frontendUrl.origin, 'http://localhost:4000', 'http://127.0.0.1:4000', 'http://localhost:' + port, 'http://127.0.0.1:' + port]);
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (production) {
    res.set('Strict-Transport-Security', 'max-age=31536000');
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; frame-src 'self' blob:");
  }
  const origin = req.get('Origin');
  res.vary('Origin');
  if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ success: false, message: 'Origin is not allowed.' });
  if (origin) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  const sendJson = res.json.bind(res);
  const sendStatus = res.sendStatus.bind(res);
  res.sendStatus = status => {
    if (status >= 400 && /^\/api(?:\/|$)/.test(req.originalUrl)) {
      const message = { 401: 'Please log in.', 403: 'Forbidden.', 404: 'API endpoint not found.', 429: 'Too many requests. Retry later.' }[status] || 'Request failed.';
      return res.status(status).json({ success: false, message });
    }
    return sendStatus(status);
  };
  res.json = body => {
    if (res.statusCode >= 500) return sendJson({ success: false, message: 'Service temporarily unavailable.' });
    if (res.statusCode >= 400 && typeof body?.message === 'string' && /violates .*constraint|duplicate key|relation .*does not exist|column .*does not exist|syntax error|password authentication failed/i.test(body.message)) {
      return sendJson({ success: false, message: 'Request conflicts with stored data. Check the entered details.' });
    }
    return sendJson(body);
  };
  next();
});
const PgStore = pgSession(session);
const sessionStore = new PgStore({ pool, tableName: 'session', createTableIfMissing: false });
app.use(session({
  name: 'avs_session', secret: sessionSecret, store: sessionStore,
  resave: false, saveUninitialized: false,
  cookie: { secure: production, sameSite: 'lax', httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));
app.get(['/health', '/api/health'], async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch { res.status(503).json({ success: false, message: 'Service temporarily unavailable.' }); }
});
app.use('/api', csrf, routes);
app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'API endpoint not found.' }));
app.use(['/system', '/admin'], (req, res) => res.status(404).json({ success: false, message: 'Not found.' }));
const frontendDirectory = fileURLToPath(new URL('../frontend/dist/', import.meta.url));
app.use(express.static(frontendDirectory, { index: false }));
app.get('*', (req, res, next) => {
  if (path.extname(req.path) || !req.accepts('html')) return next();
  res.sendFile(path.join(frontendDirectory, 'index.html'), error => { if (error) next(error); });
});
app.use((req, res) => res.status(404).json({ success: false, message: 'Not found.' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.type === 'entity.parse.failed' ? 400 : error.type === 'entity.too.large' ? 413 : 500;
  res.status(status).json({ success: false, message: status === 400 ? 'Invalid JSON request.' : status === 413 ? 'Request is too large.' : 'Service temporarily unavailable.' });
});

if (process.env.AVS_NO_LISTEN !== '1') {
  try {
    if (production) await verifySchema();
    const server = app.listen(port, process.env.HOST || '127.0.0.1', () => console.log('[server] Listening on port ' + port));
    let stopping = false;
    const shutdown = () => {
      if (stopping) return;
      stopping = true;
      const deadline = setTimeout(() => process.exit(1), 30000);
      deadline.unref();
      server.close(async () => {
        try { await pool.end(); clearTimeout(deadline); process.exit(0); }
        catch { process.exit(1); }
      });
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch {
    console.error('[server] Startup validation failed; check reviewed migrations, database permissions and configuration.');
    await pool.end();
    process.exitCode = 1;
  }
}
