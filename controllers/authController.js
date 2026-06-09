// =============================================
// Auth Controller  —  Signup, Login, OTP Verify
// =============================================
const bcrypt     = require('bcrypt');
const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { pool }   = require('../config/database');

const SALT_ROUNDS = 10;
const OTP_EXPIRY_MINUTES = 10;

// ── Nodemailer transporter ────────────────────
// Configured via env vars. Works with any SMTP provider
// (Gmail, Brevo, Mailtrap, etc.)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,   // true for 465, false for 587/STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transporter.sendMail({
    from: `"Sprint30" <${from}>`,
    to: email,
    subject: 'Sprint30 — Your Verification Code',
    html: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #111827; border-radius: 16px; color: #f1f5f9;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px;">🚀</div>
          <h1 style="font-size: 24px; font-weight: 800; background: linear-gradient(135deg, #6366f1, #22d3ee); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 12px 0 4px;">Sprint30</h1>
          <p style="color: #94a3b8; font-size: 14px;">Email Verification</p>
        </div>
        <div style="background: #1a2236; border: 1px solid rgba(148,163,184,0.12); border-radius: 12px; padding: 24px; text-align: center;">
          <p style="color: #94a3b8; font-size: 14px; margin-bottom: 16px;">Enter this code to verify your account:</p>
          <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #a5b4fc; padding: 16px; background: #0f172a; border-radius: 8px; display: inline-block;">${otp}</div>
          <p style="color: #64748b; font-size: 12px; margin-top: 16px;">This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
        </div>
        <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 24px;">If you didn't sign up for Sprint30, you can safely ignore this email.</p>
      </div>
    `,
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
    } catch (emailErr) {
      console.error('Failed to send OTP email:', emailErr.message);
      // Don't fail signup — user can request resend
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
    } catch (emailErr) {
      console.error('Failed to resend OTP email:', emailErr.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again.',
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
