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
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reset_token VARCHAR(255) NULL
            );
        `;

        console.log("⏳ Creating 'users' table if it doesn't exist...");
        await connection.query(createTableQuery);
        console.log("✅ 'users' table is ready!");

        // Close the connection safely
        await connection.end();
        console.log("🎉 Database initialization complete! You can delete this file now.");

    } catch (error) {
        console.error("❌ Database initialization failed:");
        console.error(error.message);
    }
}

initializeDatabase();