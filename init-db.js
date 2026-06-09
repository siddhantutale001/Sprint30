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

        // ── Create Roadmap Tables ──
        const createTasksTable = `
            CREATE TABLE IF NOT EXISTS tasks (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                track       VARCHAR(50) NOT NULL,
                day_number  INT NOT NULL,
                title       VARCHAR(255) NOT NULL,
                UNIQUE KEY uq_track_day (track, day_number)
            );
        `;
        const createUserProgressTable = `
            CREATE TABLE IF NOT EXISTS user_progress (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                user_id      INT NOT NULL,
                task_id      INT NOT NULL,
                completed    BOOLEAN DEFAULT FALSE,
                completed_at DATETIME NULL,
                UNIQUE KEY uq_user_task (user_id, task_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            );
        `;
        console.log("⏳ Creating roadmap tables...");
        await connection.query(createTasksTable);
        await connection.query(createUserProgressTable);
        console.log("✅ Roadmap tables are ready!");

        // ── Seed Roadmap Data ──
        const seedTasks = `
            INSERT IGNORE INTO tasks (track, day_number, title) VALUES
            ('Full-Stack', 1, 'HTML5 Semantic Elements'),
            ('Full-Stack', 2, 'CSS Flexbox & Grid'),
            ('Full-Stack', 3, 'JavaScript DOM Manipulation'),
            ('Full-Stack', 4, 'ES6+ Features'),
            ('Full-Stack', 5, 'Responsive Design'),
            ('Full-Stack', 6, 'Git & GitHub Basics'),
            ('Full-Stack', 7, 'Node.js Introduction'),
            ('Full-Stack', 8, 'Express.js Routing'),
            ('Full-Stack', 9, 'REST API Design'),
            ('Full-Stack', 10, 'PostgreSQL Basics'),
            ('Full-Stack', 11, 'SQL Queries & Joins'),
            ('Full-Stack', 12, 'Database Schema Design'),
            ('Full-Stack', 13, 'Authentication & JWT'),
            ('Full-Stack', 14, 'Password Hashing & Security'),
            ('Full-Stack', 15, 'Frontend-Backend Integration'),
            ('Full-Stack', 16, 'React.js Fundamentals'),
            ('Full-Stack', 17, 'React Hooks'),
            ('Full-Stack', 18, 'State Management'),
            ('Full-Stack', 19, 'API Integration in React'),
            ('Full-Stack', 20, 'Tailwind CSS'),
            ('Full-Stack', 21, 'Deployment with Vercel'),
            ('Full-Stack', 22, 'Deployment with Render'),
            ('Full-Stack', 23, 'Environment Variables & Secrets'),
            ('Full-Stack', 24, 'Error Handling & Logging'),
            ('Full-Stack', 25, 'Input Validation'),
            ('Full-Stack', 26, 'Testing Basics'),
            ('Full-Stack', 27, 'Performance Optimization'),
            ('Full-Stack', 28, 'WebSockets Introduction'),
            ('Full-Stack', 29, 'Build a Full CRUD App'),
            ('Full-Stack', 30, 'Ship & Present Your Project'),
            ('Frontend', 1, 'HTML5 Structure & Semantics'),
            ('Frontend', 2, 'CSS Box Model'),
            ('Frontend', 3, 'Flexbox Layout'),
            ('Frontend', 4, 'CSS Grid'),
            ('Frontend', 5, 'Responsive & Mobile-First Design'),
            ('Frontend', 6, 'CSS Variables & Theming'),
            ('Frontend', 7, 'JavaScript Basics'),
            ('Frontend', 8, 'DOM Manipulation'),
            ('Frontend', 9, 'Events & Listeners'),
            ('Frontend', 10, 'Fetch API & AJAX'),
            ('Frontend', 11, 'ES6 Arrow Functions & Destructuring'),
            ('Frontend', 12, 'Promises & Async/Await'),
            ('Frontend', 13, 'Local Storage & Session Storage'),
            ('Frontend', 14, 'Form Validation'),
            ('Frontend', 15, 'Animations & Transitions'),
            ('Frontend', 16, 'React Fundamentals'),
            ('Frontend', 17, 'JSX & Components'),
            ('Frontend', 18, 'Props & State'),
            ('Frontend', 19, 'useEffect Hook'),
            ('Frontend', 20, 'React Router'),
            ('Frontend', 21, 'Tailwind CSS Setup'),
            ('Frontend', 22, 'Component Libraries'),
            ('Frontend', 23, 'API Integration'),
            ('Frontend', 24, 'Error Boundaries'),
            ('Frontend', 25, 'Accessibility (a11y)'),
            ('Frontend', 26, 'SEO Basics'),
            ('Frontend', 27, 'Performance & Lighthouse'),
            ('Frontend', 28, 'Testing with Jest'),
            ('Frontend', 29, 'Build & Bundle with Vite'),
            ('Frontend', 30, 'Deploy & Present'),
            ('Backend', 1, 'Node.js Core Modules'),
            ('Backend', 2, 'NPM & package.json'),
            ('Backend', 3, 'Express.js Setup'),
            ('Backend', 4, 'Routing & Middleware'),
            ('Backend', 5, 'Request & Response Cycle'),
            ('Backend', 6, 'REST API Design Principles'),
            ('Backend', 7, 'PostgreSQL Setup'),
            ('Backend', 8, 'SQL CRUD Operations'),
            ('Backend', 9, 'Joins & Relationships'),
            ('Backend', 10, 'Database Pooling with pg'),
            ('Backend', 11, 'Environment Variables'),
            ('Backend', 12, 'Authentication with JWT'),
            ('Backend', 13, 'Password Hashing with bcrypt'),
            ('Backend', 14, 'Middleware & Auth Guards'),
            ('Backend', 15, 'Input Validation'),
            ('Backend', 16, 'Error Handling'),
            ('Backend', 17, 'File Uploads with Multer'),
            ('Backend', 18, 'Sending Emails'),
            ('Backend', 19, 'Cron Jobs & Scheduling'),
            ('Backend', 20, 'WebSockets with Socket.io'),
            ('Backend', 21, 'Rate Limiting'),
            ('Backend', 22, 'CORS Configuration'),
            ('Backend', 23, 'Logging with Morgan'),
            ('Backend', 24, 'Unit Testing with Jest'),
            ('Backend', 25, 'Integration Testing'),
            ('Backend', 26, 'API Documentation with Swagger'),
            ('Backend', 27, 'Caching with Redis'),
            ('Backend', 28, 'Docker Basics'),
            ('Backend', 29, 'CI/CD Pipeline'),
            ('Backend', 30, 'Ship a Production API');
        `;
        console.log("⏳ Seeding roadmap tasks...");
        await connection.query(seedTasks);
        console.log("✅ Roadmap tasks seeded!");

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