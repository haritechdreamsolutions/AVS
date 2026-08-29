import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { pool } from './database/pg_pool.js';
import routes from './routes.js';

const app = express();
const PORT = process.env.PORT || 5000;

const PgStore = pgSession(session);
const sessionStore = new PgStore({
  pool,
  tableName: 'session',
  createTableIfMissing: true,
});

app.use(cors({
  origin: function (origin, callback) { callback(null, true); },
  credentials: true,
}));
app.use(express.json());

app.use(session({
  key: 'avs_session',
  secret: process.env.SESSION_SECRET || 'avs_agencies_secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
  },
}));

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), db: 'postgresql' });
});

const host = '0.0.0.0';
app.listen(PORT, host, () => {
  console.log('[server] AVS AGENCIES backend running on port ' + PORT);
});
