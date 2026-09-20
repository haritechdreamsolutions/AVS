import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { pool } from './database/pg_pool.js';
import { runAutoMigrations } from './database/auto_migrate.js';
import routes from './routes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// TRUST PROXY
// ============================================================
// Required when running behind Render's HTTPS reverse proxy.
app.set('trust proxy', 1);

// ============================================================
// CORS CONFIGURATION
// ============================================================

const allowedOrigins = [
  'https://avsdistributor.netlify.app',
  'http://localhost:5173',
  'http://localhost:4000',
  'http://localhost:3000',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.netlify.app') || origin.includes('localhost'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', 'https://avsdistributor.netlify.app');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS, PATCH'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, Origin'
  );

  res.setHeader('Vary', 'Origin');

  // Handle browser CORS preflight requests.
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
});

// ============================================================
// BODY PARSER
// ============================================================

app.use(express.json());

// ============================================================
// SESSION STORE & CONFIGURATION
// ============================================================

const PgStore = pgSession(session);

const sessionStore = new PgStore({
  pool,
  tableName: 'session',
  createTableIfMissing: true,
});

const isProd = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

app.use(
  session({
    name: 'avs_session',
    secret: process.env.SESSION_SECRET || 'avs_agencies_secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

// ============================================================
// API ROUTES
// ============================================================

// Primary production API path.
app.use('/api', routes);

// Keep root routes for compatibility.
app.use('/', routes);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get(['/health', '/api/health'], async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT 1 as alive');

    if (dbRes && dbRes.rows) {
      return res.status(200).json({
        status: 'ok',
        time: new Date().toISOString(),
        database: 'connected',
        driver: 'pg',
      });
    }

    throw new Error('Database check returned unexpected result');
  } catch (err) {
    return res.status(503).json({
      status: 'degraded',
      time: new Date().toISOString(),
      database: 'disconnected',
      error: err.message,
    });
  }
});

// ============================================================
// SERVER START WITH AUTO-MIGRATIONS
// ============================================================

const host = '0.0.0.0';

async function startServer() {
  try {
    await runAutoMigrations();
  } catch (err) {
    console.error('[server] Auto-migration error on startup:', err);
  }

  app.listen(PORT, host, () => {
    console.log(`[server] AVS AGENCIES backend running on port ${PORT}`);
    console.log('[server] Allowed CORS origins:', allowedOrigins);
  });
}

startServer();
