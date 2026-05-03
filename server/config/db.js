const mysql = require('mysql2/promise');
require('dotenv').config();

if (!process.env.DB_USER || !process.env.DB_PASSWORD) {
  throw new Error("Database credentials not set in .env");
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,       // MUST use env
  user: process.env.DB_USER,       // MUST use env
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test connection on module load (non-blocking — never crashes startup)
pool.getConnection()
  .then(conn => { console.log('Database connected successfully'); conn.release(); })
  .catch(err => console.error('Database connection failed:', err.message));

module.exports = pool;
