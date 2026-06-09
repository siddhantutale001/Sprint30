// =============================================
// Express Server  —  Entry Point
// =============================================
require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const { testConnection } = require('./config/database');
const authRoutes          = require('./routes/authRoutes');
const verifyToken         = require('./middleware/verifyToken');

const app  = express();
// Render assigns a dynamic port via process.env.PORT.
// Fall back to 5000 for local development only.
const PORT = process.env.PORT || 5000;

// ── CORS — restrict to your Vercel frontend ───
// In production, FRONTEND_URL = "https://your-app.vercel.app"
// In local dev, FRONTEND_URL = "http://localhost:3000" (or 5173 for Vite)
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin "${origin}" is not allowed.`));
  },
  credentials: true,             // allow cookies / Authorization headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body Parsers ───────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Public Routes ──────────────────────────────
app.use('/api/auth', authRoutes);

// ── Protected Routes (example) ─────────────────
app.get('/api/protected', verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'You have access to this protected route.',
    data: { userId: req.user.id },
  });
});

// ── Health Check ───────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ── Start Server ───────────────────────────────
async function start() {
  await testConnection();       // fail fast if MySQL is unreachable

  app.listen(PORT, () => {
    console.log(`🚀  Server running on port ${PORT}`);
    console.log(`    Allowed origins → ${allowedOrigins.join(', ')}`);
    console.log(`    Auth  →  POST /api/auth/signup`);
    console.log(`    Auth  →  POST /api/auth/login`);
    console.log(`    Test  →  GET  /api/protected  (requires Bearer token)`);
  });
}

start();
