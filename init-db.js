require('dotenv').config();
const mysql = require('mysql2/promise');

async function initializeDatabase() {
    console.log("⏳ Connecting to Aiven MySQL database...");

    if (!process.env.DATABASE_URL) {
        console.error("❌ Error: DATABASE_URL is missing in your .env file!");
        process.exit(1);
    }

    try {
        // Create connection using the Aiven link from your .env
        const connection = await mysql.createConnection(process.env.DATABASE_URL);
        console.log("✅ Successfully connected to Aiven!");

        // The SQL command to build your users table
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                email           VARCHAR(255) NOT NULL UNIQUE,
                password_hash   VARCHAR(255) NOT NULL,
                is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
                otp_code        VARCHAR(6) NULL,
                otp_expires_at  DATETIME NULL,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reset_token     VARCHAR(255) NULL
            );
        `;

        console.log("⏳ Creating 'users' table if it doesn't exist...");
        await connection.query(createTableQuery);
        console.log("✅ 'users' table is ready!");

        // ── Migration: add OTP columns to existing tables ──
        // These are safe to run multiple times — they silently skip if columns exist.
        const migrations = [
            {
                name: 'is_verified',
                sql: `ALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT TRUE;`,
            },
            {
                name: 'otp_code',
                sql: `ALTER TABLE users ADD COLUMN otp_code VARCHAR(6) NULL;`,
            },
            {
                name: 'otp_expires_at',
                sql: `ALTER TABLE users ADD COLUMN otp_expires_at DATETIME NULL;`,
            },
        ];

        for (const migration of migrations) {
            try {
                await connection.query(migration.sql);
                console.log(`  ✅ Added column: ${migration.name}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`  ⏭️  Column '${migration.name}' already exists — skipping.`);
                } else {
                    throw err;
                }
            }
        }

        // Mark all existing users as verified so they aren't locked out
        await connection.query(`UPDATE users SET is_verified = TRUE WHERE is_verified = FALSE AND otp_code IS NULL;`);
        console.log("✅ Existing users marked as verified.");

        // Close the connection safely
        await connection.end();
        console.log("🎉 Database initialization complete!");

    } catch (error) {
        console.error("❌ Database initialization failed:");
        console.error(error.message);
    }
}

initializeDatabase();