// =============================================
// Auth Controller  —  Signup, Login, OTP Verify
// =============================================
const bcrypt     = require('bcrypt');
const jwt        = require('jsonwebtoken');
const { Resend } = require('resend');
const { pool }   = require('../config/database');

const SALT_ROUNDS = 10;
const OTP_EXPIRY_MINUTES = 10;

const resend = new Resend(process.env.RESEND_API_KEY);

// ── Helpers ───────────────────────────────────

/** Generate a signed JWT for a given user id. */
function signToken(userId) {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' },
  );
}

/** Generate a random 6-digit OTP code. */
function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Send the OTP email. */
async function sendOTPEmail(email, otp) {
  await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: email,
    subject: 'Your OTP Verification Code',
    html: `<p>Your OTP is: <strong>${otp}</strong></p><p>Expires in 10 minutes.</p>`
  });
}

// =============================================
// POST /api/auth/signup
// =============================================
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
      'SELECT id, is_verified FROM users WHERE email = ?',
      [email],
    );

    if (existing.length > 0) {
      // If unverified, allow re-signup: delete old row and proceed
      if (!existing[0].is_verified) {
        await pool.execute('DELETE FROM users WHERE id = ?', [existing[0].id]);
      } else {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists.',
        });
      }
    }

    // ── hash password ──
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // ── generate OTP ──
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // ── insert user (unverified) ──
    const [result] = await pool.execute(
      'INSERT INTO users (email, password_hash, is_verified, otp_code, otp_expires_at) VALUES (?, ?, FALSE, ?, ?)',
      [email, passwordHash, otp, expiresAt],
    );

    // ── send OTP email ──
    try {
      await sendOTPEmail(email, otp);
    } catch (mailError) {
      console.error("Resend Error:", mailError);
      
      // Cleanup: we remove the user so they can try signing up again immediately
      // rather than being stuck with an unverified account where the email failed.
      await pool.execute('DELETE FROM users WHERE id = ?', [result.insertId]);

      return res.status(500).json({ 
        success: false, 
        message: "Failed to send verification email. Please check server logs." 
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Account created! Please check your email for a verification code.',
      data: { userId: result.insertId, requiresVerification: true },
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
// POST /api/auth/verify-otp
// =============================================
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP code are required.',
      });
    }

    // ── find user ──
    const [rows] = await pool.execute(
      'SELECT id, otp_code, otp_expires_at, is_verified FROM users WHERE email = ?',
      [email],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email.',
      });
    }

    const user = rows[0];

    if (user.is_verified) {
      return res.status(400).json({
        success: false,
        message: 'This account is already verified.',
      });
    }

    // ── check OTP ──
    if (!user.otp_code || user.otp_code !== otp.trim()) {
      return res.status(401).json({
        success: false,
        message: 'Invalid verification code.',
      });
    }

    // ── check expiry ──
    if (new Date() > new Date(user.otp_expires_at)) {
      return res.status(410).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.',
      });
    }

    // ── mark verified & clear OTP ──
    await pool.execute(
      'UPDATE users SET is_verified = TRUE, otp_code = NULL, otp_expires_at = NULL WHERE id = ?',
      [user.id],
    );

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully! You can now log in.',
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

// =============================================
// POST /api/auth/resend-otp
// =============================================
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.',
      });
    }

    // ── find user ──
    const [rows] = await pool.execute(
      'SELECT id, is_verified FROM users WHERE email = ?',
      [email],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email.',
      });
    }

    if (rows[0].is_verified) {
      return res.status(400).json({
        success: false,
        message: 'This account is already verified.',
      });
    }

    // ── generate new OTP ──
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await pool.execute(
      'UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE id = ?',
      [otp, expiresAt, rows[0].id],
    );

    // ── send OTP email ──
    try {
      await sendOTPEmail(email, otp);
    } catch (mailError) {
      console.error("Resend Error:", mailError);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to send verification email. Please check server logs." 
      });
    }

    return res.status(200).json({
      success: true,
      message: 'A new verification code has been sent to your email.',
    });
  } catch (err) {
    console.error('Resend OTP error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

// =============================================
// POST /api/auth/login
// =============================================
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
      'SELECT id, email, password_hash, is_verified FROM users WHERE email = ?',
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

    // ── check verification status ──
    if (!user.is_verified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in. Check your inbox for the verification code.',
        requiresVerification: true,
      });
    }

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

module.exports = { signup, login, verifyOtp, resendOtp };
