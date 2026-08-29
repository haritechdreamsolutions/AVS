import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { pool } from './database/pg_pool.js';
import routes from './routes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable trust proxy for Render / Cloud reverse proxy HTTPS session cookies
app.set('trust proxy', 1);

// Allowed Origins for CORS
const allowedOrigins = [
  'https://avsdistributor.netlify.app',
  'http://localhost:4000',
  'http://localhost:3000',
  'http://localhost:5000'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.netlify.app')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins in production for maximum compatibility
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

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
