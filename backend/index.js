import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { pool } from './database/pg_pool.js';
import routes from './routes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable trust proxy for Render / Cloud reverse proxy HTTPS session cookies
app.set('trust proxy', 1);

// Custom CORS Middleware to guarantee exact origin reflection for credentials: 'include'
app.use((req, res, next) => {
  const origin = req.headers.origin || 'https://avsdistributor.netlify.app';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  // Handle OPTIONS preflight immediately with 200 OK
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

const PgStore = pgSession(session);
const sessionStore = new PgStore({
  pool,
  tableName: 'session',
  createTableIfMissing: true,
});

app.use(session({
  key: 'avs_session',
  secret: process.env.SESSION_SECRET || 'avs_agencies_secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
  },
}));

// Mount API routes on both /api prefix AND root / for complete URL compatibility
app.use('/api', routes);
app.use('/', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), db: 'postgresql' });
});

const host = '0.0.0.0';
app.listen(PORT, host, () => {
  console.log('[server] AVS AGENCIES backend running on port ' + PORT);
});
