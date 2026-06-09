// =============================================
// JWT Verification Middleware
// =============================================
const jwt = require('jsonwebtoken');

/**
 * Intercepts incoming requests and validates the JWT.
 *
 * Expected header format:
 *   Authorization: Bearer <token>
 *
 * On success  → attaches `req.user = { id }` and calls next().
 * On failure  → returns 401 Unauthorized.
 */
const verifyToken = (req, res, next) => {
  try {
    // ── extract header ──
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    // Support "Bearer <token>" format
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token is malformed.',
      });
    }

    // ── verify & decode ──
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the decoded payload so downstream handlers can use req.user.id
    req.user = decoded;

    next();
  } catch (err) {
    // jwt.verify throws on expiry, bad signature, etc.
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
    });
  }
};

module.exports = verifyToken;
