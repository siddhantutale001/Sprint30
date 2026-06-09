// =============================================
// Auth Controller  —  Signup & Login
// =============================================
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const { pool } = require('../config/database');

const SALT_ROUNDS = 10;

// ----- helpers -----

/**
 * Generate a signed JWT for a given user id.
 * Token lifetime is controlled by JWT_EXPIRES_IN in .env (default: 1 h).
 */
function signToken(userId) {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' },
  );
}

// =============================================
// POST /api/auth/signup
// =============================================
/**
 * 1. Validate that email & password are present.
 * 2. Check the DB for a duplicate email.
 * 3. Hash the password (bcrypt, 10 salt rounds).
 * 4. Insert the new user — never store the raw password.
 * 5. Return a 201 with the new user id (no sensitive data).
 */
const signup = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── input validation ──
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    // ── duplicate check ──
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email],
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // ── hash password ──
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // ── insert user (raw password is NEVER stored) ──
    const [result] = await pool.execute(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      [email, passwordHash],
    );

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: { userId: result.insertId },
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

// =============================================
// POST /api/auth/login
// =============================================
/**
 * 1. Validate that email & password are present.
 * 2. Retrieve the user row by email.
 * 3. Compare the supplied password against the stored hash.
 * 4. On success, return a signed JWT containing the user id.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── input validation ──
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    // ── find user ──
    const [rows] = await pool.execute(
      'SELECT id, email, password_hash FROM users WHERE email = ?',
      [email],
    );

    if (rows.length === 0) {
      // Use a generic message — don't reveal whether the email exists.
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const user = rows[0];

    // ── verify password ──
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // ── issue token ──
    const token = signToken(user.id);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: { token },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

module.exports = { signup, login };
