import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// Configurable MySQL Pool settings
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'avs_distribution_db',
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool = null;

try {
  pool = mysql.createPool(poolConfig);
  console.log(`🔌 MySQL Driver configured for ${poolConfig.user}@${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`);
} catch (err) {
  console.warn("⚠️ MySQL pool creation deferred: ", err.message);
}

export const query = async (sql, params = []) => {
  if (!pool) {
    throw new Error("MySQL database pool is not connected.");
  }
  const [rows] = await pool.query(sql, params);
  return rows;
};

export const executeProcedure = async (procedureName, params = []) => {
  if (!pool) {
    throw new Error("MySQL database pool is not connected.");
  }
  const placeholders = params.map(() => '?').join(',');
  const sql = `CALL ${procedureName}(${placeholders})`;
  const [rows] = await pool.query(sql, params);
  return rows;
};

export default { pool, query, executeProcedure };
