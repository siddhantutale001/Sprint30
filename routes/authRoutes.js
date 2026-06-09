// =============================================
// Auth Routes  —  /api/auth
// =============================================
const express = require('express');
const router  = express.Router();

const { signup, login } = require('../controllers/authController');

// Public routes — no token required
router.post('/signup', signup);
router.post('/login',  login);

module.exports = router;
