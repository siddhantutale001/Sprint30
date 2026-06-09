// =============================================
// Database Connection Pool  (mysql2 + Promises)
// =============================================
// Production (Aiven):  uses DATABASE_URL  — a single connection string
// Local dev:           falls back to individual DB_* env variables
// =============================================
const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Build pool configuration.
 *
 * Aiven (and most managed MySQL hosts) provide a single connection URI:
 *   mysql://user:password@host:port/database?ssl-mode=REQUIRED
 *
 * When DATABASE_URL is set we use it directly. Otherwise we fall back
 * to the individual DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 * variables so local development still works without changes.
 */
function buildPoolConfig() {
  const common = {
    waitForConnections: true,   // queue callers when no connection is free
    connectionLimit: 10,     // max simultaneous connections
    queueLimit: 0,      // unlimited queue (0 = no limit)
  };

  if (process.env.DATABASE_URL) {
    // ── Production path (Aiven connection string) ──
    return {
      uri: process.env.DATABASE_URL,
      ...common,
      // Aiven requires TLS — reject unauthorised certs in production
      ssl: { rejectUnauthorized: true },
    };
  }

  // ── Local development path ──
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ...common,
  };
}

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // This is the magic line that stops Node from panicking
  }
});

/**
 * Quick connectivity check — call once at startup.
 * Acquires and immediately releases a connection to verify the pool
 * can actually reach MySQL.
 */
async function testConnection() {
  let connection;
  try {
    connection = await pool.getConnection();

    if (process.env.DATABASE_URL) {
      console.log('✅  MySQL connected successfully  →  Aiven (DATABASE_URL)');
    } else {
      console.log('✅  MySQL connected successfully  →  %s@%s:%s/%s',
        process.env.DB_USER,
        process.env.DB_HOST,
        process.env.DB_PORT,
        process.env.DB_NAME,
      );
    }
  } catch (err) {
    console.error('❌  MySQL connection failed:', err.message);
    process.exit(1);   // hard-stop if we can't reach the database
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { pool, testConnection };
