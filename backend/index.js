import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { pool } from './database/pg_pool.js';
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
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Only allow known frontend origins.
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
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

  // Tell browsers/proxies that CORS response can vary by Origin.
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
// SESSION STORE
// ============================================================

const PgStore = pgSession(session);

const sessionStore = new PgStore({
  pool,
  tableName: 'session',
  createTableIfMissing: true,
});

// ============================================================
// SESSION CONFIGURATION
// ============================================================

app.use(
  session({
    key: 'avs_session',

    secret:
      process.env.SESSION_SECRET ||
      'avs_agencies_secret',

    store: sessionStore,

    resave: false,

    saveUninitialized: false,

    cookie: {
      // Render production uses HTTPS.
      secure: process.env.NODE_ENV === 'production',

      // Required for cross-site Netlify → Render requests.
      sameSite:
        process.env.NODE_ENV === 'production'
          ? 'none'
          : 'lax',

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

    throw new Error(
      'Database check returned unexpected result'
    );
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
// SERVER
// ============================================================

const host = '0.0.0.0';

app.listen(PORT, host, () => {
  console.log(
    `[server] AVS AGENCIES backend running on port ${PORT}`
  );

  console.log(
    '[server] Allowed CORS origins:',
    allowedOrigins
  );
});
