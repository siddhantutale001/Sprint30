// =============================================
// Sprint30 — Frontend Client  (Vanilla JS)
// =============================================
// Self-contained module: auth flow, JWT handling,
// OTP verification, 30-day roadmap grid, checkbox
// sync, toasts.
// =============================================

'use strict';

// ── Configuration ──────────────────────────────
// Automatically switches between localhost and your live backend server.
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : 'https://sprint30.onrender.com';

const TOKEN_KEY = 'sprint30_token';
const EMAIL_KEY = 'sprint30_email';

const TRACK_NAMES = ['Full-Stack', 'Frontend', 'Backend'];

// =============================================
// Utility Helpers
// =============================================

/** Safe JSON parse with fallback */
function safeParse(str, fallback = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}

/** Decode JWT payload (no verification — that's the server's job) */
function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

/** Check if token is expired */
function isTokenExpired(token) {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return true;
  return Date.now() >= payload.exp * 1000;
}

// =============================================
// Token & Storage
// =============================================
const Auth = {
  getToken() { return localStorage.getItem(TOKEN_KEY); },
  getEmail() { return localStorage.getItem(EMAIL_KEY) || 'User'; },
  setSession(token, email) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EMAIL_KEY, email);
  },
  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
  },
  isLoggedIn() {
    const token = this.getToken();
    return token && !isTokenExpired(token);
  },
};

// =============================================
// API Client
// =============================================
async function apiRequest(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  const token = Auth.getToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || data.error || 'Request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

const api = {
  post: (endpoint, body) =>
    apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  get: (endpoint) =>
    apiRequest(endpoint, { method: 'GET' }),
  patch: (endpoint, body) =>
    apiRequest(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
};

// =============================================
// Toast Notifications
// =============================================
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

// =============================================
// DOM References (lazy-safe)
// =============================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DOM = {};

function initDOMRefs() {
  DOM.app = $('#app');
  DOM.authView = $('#auth-view');
  DOM.otpView = $('#otp-view');
  DOM.dashView = $('#dashboard-view');
  // Auth
  DOM.tabLogin = $('#tab-login');
  DOM.tabSignup = $('#tab-signup');
  DOM.loginForm = $('#login-form');
  DOM.signupForm = $('#signup-form');
  DOM.loginBtn = $('#login-btn');
  DOM.signupBtn = $('#signup-btn');
  DOM.loginMsg = $('#login-message');
  DOM.signupMsg = $('#signup-message');
  // OTP
  DOM.otpForm = $('#otp-form');
  DOM.otpInput = $('#otp-input');
  DOM.otpVerifyBtn = $('#otp-verify-btn');
  DOM.otpMsg = $('#otp-message');
  DOM.otpEmailDisplay = $('#otp-email-display');
  DOM.otpResendBtn = $('#otp-resend-btn');
  DOM.otpBackBtn = $('#otp-back-btn');
  // Dashboard
  DOM.logoutBtn = $('#logout-btn');
  DOM.userAvatar = $('#user-avatar');
  DOM.userEmailDisplay = $('#user-email-display');
  DOM.statCompleted = $('#stat-completed');
  DOM.statProgress = $('#stat-progress');
  DOM.statRemaining = $('#stat-remaining');
  DOM.progressPct = $('#progress-pct-label');
  DOM.progressFill = $('#progress-fill');
  DOM.trackSelector = $('#track-selector');
  DOM.trackBadge = $('#track-badge');
  DOM.dayGridContainer = $('#day-grid-container');
}

// =============================================
// View Routing
// =============================================
let currentTrack = TRACK_NAMES[0];
let pendingOtpEmail = '';

function showView(view) {
  if (DOM.authView) DOM.authView.classList.toggle('hidden', view !== 'auth');
  if (DOM.otpView) DOM.otpView.classList.toggle('hidden', view !== 'otp');
  if (DOM.dashView) DOM.dashView.classList.toggle('hidden', view !== 'dashboard');
}

function initApp() {
  initDOMRefs();
  bindAuthEvents();
  bindOtpEvents();
  bindDashboardEvents();

  if (Auth.isLoggedIn()) {
    showView('dashboard');
    initDashboard();
  } else {
    Auth.clearSession(); // clean up expired tokens
    showView('auth');
  }
}

// =============================================
// Auth — Tab Switching
// =============================================
function setAuthMode(mode) {
  const isLogin = mode === 'login';
  if (DOM.tabLogin) DOM.tabLogin.classList.toggle('active', isLogin);
  if (DOM.tabSignup) DOM.tabSignup.classList.toggle('active', !isLogin);
  if (DOM.tabLogin) DOM.tabLogin.setAttribute('aria-selected', isLogin);
  if (DOM.tabSignup) DOM.tabSignup.setAttribute('aria-selected', !isLogin);
  if (DOM.loginForm) DOM.loginForm.classList.toggle('hidden', !isLogin);
  if (DOM.signupForm) DOM.signupForm.classList.toggle('hidden', isLogin);
  if (DOM.loginMsg) hideMessage(DOM.loginMsg);
  if (DOM.signupMsg) hideMessage(DOM.signupMsg);
}

// =============================================
// Auth — Message Helpers
// =============================================
function showMessage(el, text, type = 'error') {
  if (!el) return;
  el.textContent = text;
  el.className = `auth-message ${type}`;
  el.classList.remove('hidden');
}

function hideMessage(el) {
  if (!el) return;
  el.classList.add('hidden');
}

function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = '<div class="spinner"></div><span>Please wait…</span>';
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalHtml || btn.innerHTML;
  }
}

// =============================================
// Auth — Event Bindings
// =============================================
function bindAuthEvents() {
  if (DOM.tabLogin) DOM.tabLogin.addEventListener('click', () => setAuthMode('login'));
  if (DOM.tabSignup) DOM.tabSignup.addEventListener('click', () => setAuthMode('signup'));

  if (DOM.loginForm) {
    DOM.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideMessage(DOM.loginMsg);

      const email = $('#login-email').value.trim();
      const password = $('#login-password').value;

      if (!email || !password) {
        showMessage(DOM.loginMsg, 'Please fill in all fields.');
        return;
      }

      setLoading(DOM.loginBtn, true);

      try {
        const res = await api.post('/api/auth/login', { email, password });
        Auth.setSession(res.data.token, email);
        showToast('Welcome back! 🎉', 'success');
        showView('dashboard');
        initDashboard();
      } catch (err) {
        if (err.data && err.data.requiresVerification) {
          pendingOtpEmail = email;
          showOtpView(email);
          showToast('Please verify your email first.', 'info');
        } else {
          showMessage(DOM.loginMsg, err.message || 'Login failed. Please try again.');
        }
      } finally {
        setLoading(DOM.loginBtn, false);
      }
    });
  }

  if (DOM.signupForm) {
    DOM.signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideMessage(DOM.signupMsg);

      const email = $('#signup-email').value.trim();
      const password = $('#signup-password').value;
      const confirm = $('#signup-confirm').value;

      if (!email || !password || !confirm) {
        showMessage(DOM.signupMsg, 'Please fill in all fields.');
        return;
      }

      if (password.length < 6) {
        showMessage(DOM.signupMsg, 'Password must be at least 6 characters.');
        return;
      }

      if (password !== confirm) {
        showMessage(DOM.signupMsg, 'Passwords do not match.');
        return;
      }

      setLoading(DOM.signupBtn, true);

      try {
        await api.post('/api/auth/signup', { email, password });
        pendingOtpEmail = email;
        showOtpView(email);
        showToast('Account created! Check your email for the verification code. 📧', 'success');
      } catch (err) {
        showMessage(DOM.signupMsg, err.message || 'Signup failed. Please try again.');
      } finally {
        setLoading(DOM.signupBtn, false);
      }
    });
  }
}

// =============================================
// OTP Verification — View & Events
// =============================================
function showOtpView(email) {
  if (DOM.otpEmailDisplay) DOM.otpEmailDisplay.textContent = email;
  if (DOM.otpInput) DOM.otpInput.value = '';
  hideMessage(DOM.otpMsg);
  showView('otp');
  setTimeout(() => { if (DOM.otpInput) DOM.otpInput.focus(); }, 300);
}

function bindOtpEvents() {
  if (DOM.otpForm) {
    DOM.otpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideMessage(DOM.otpMsg);

      const otp = DOM.otpInput ? DOM.otpInput.value.trim() : '';

      if (!otp || otp.length !== 6) {
        showMessage(DOM.otpMsg, 'Please enter the 6-digit code.');
        return;
      }

      setLoading(DOM.otpVerifyBtn, true);

      try {
        await api.post('/api/auth/verify-otp', { email: pendingOtpEmail, otp });
        showToast('Email verified successfully! 🎉 Please log in.', 'success');
        showView('auth');
        setAuthMode('login');
        const loginEmailInput = $('#login-email');
        if (loginEmailInput) loginEmailInput.value = pendingOtpEmail;
        pendingOtpEmail = '';
      } catch (err) {
        showMessage(DOM.otpMsg, err.message || 'Verification failed. Please try again.');
      } finally {
        setLoading(DOM.otpVerifyBtn, false);
      }
    });
  }

  if (DOM.otpResendBtn) {
    DOM.otpResendBtn.addEventListener('click', async () => {
      if (!pendingOtpEmail) return;

      DOM.otpResendBtn.disabled = true;
      DOM.otpResendBtn.textContent = 'Sending…';

      try {
        await api.post('/api/auth/resend-otp', { email: pendingOtpEmail });
        showToast('New verification code sent! 📧', 'success');
        showMessage(DOM.otpMsg, 'A new code has been sent to your email.', 'success');

        let countdown = 30;
        DOM.otpResendBtn.textContent = `Resend in ${countdown}s`;
        const timer = setInterval(() => {
          countdown--;
          if (countdown <= 0) {
            clearInterval(timer);
            DOM.otpResendBtn.disabled = false;
            DOM.otpResendBtn.textContent = 'Resend Code';
          } else {
            DOM.otpResendBtn.textContent = `Resend in ${countdown}s`;
          }
        }, 1000);
      } catch (err) {
        showMessage(DOM.otpMsg, err.message || 'Failed to resend code.');
        DOM.otpResendBtn.disabled = false;
        DOM.otpResendBtn.textContent = 'Resend Code';
      }
    });
  }

  if (DOM.otpBackBtn) {
    DOM.otpBackBtn.addEventListener('click', () => {
      pendingOtpEmail = '';
      showView('auth');
      setAuthMode('signup');
    });
  }
}

// =============================================
// Dashboard — Initialization
// =============================================
function initDashboard() {
  const email = Auth.getEmail();
  if (DOM.userEmailDisplay) DOM.userEmailDisplay.textContent = email;
  if (DOM.userAvatar) DOM.userAvatar.textContent = email.charAt(0).toUpperCase();

  renderTrackSelector();

  // Call renderRoadmap() immediately after the auth check passes on dashboard load
  renderRoadmap(currentTrack);
}

// =============================================
// Dashboard — Event Bindings
// =============================================
function bindDashboardEvents() {
  if (DOM.logoutBtn) {
    DOM.logoutBtn.addEventListener('click', () => {
      Auth.clearSession();
      showToast('Logged out successfully', 'info');
      showView('auth');
      if (DOM.loginForm) DOM.loginForm.reset();
      if (DOM.signupForm) DOM.signupForm.reset();
      setAuthMode('login');
    });
  }
}

// =============================================
// Dashboard — Track Selector
// =============================================
function renderTrackSelector() {
  if (!DOM.trackSelector) return;
  DOM.trackSelector.innerHTML = '';

  const icons = { 'Full-Stack': '⚡', 'Frontend': '🎨', 'Backend': '⚙️' };
  TRACK_NAMES.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'track-btn' + (currentTrack === name ? ' active' : '');
    btn.textContent = `${icons[name] || '📘'} ${name}`;
    btn.addEventListener('click', () => {
      currentTrack = name;
      updateTrackButtons();
      renderRoadmap(name);
    });
    DOM.trackSelector.appendChild(btn);
  });
}

function updateTrackButtons() {
  if (!DOM.trackSelector) return;
  const buttons = DOM.trackSelector.querySelectorAll('.track-btn');
  buttons.forEach((btn, i) => {
    btn.classList.toggle('active', currentTrack === TRACK_NAMES[i]);
  });

  if (DOM.trackBadge) {
    DOM.trackBadge.textContent = currentTrack;
  }
}

// =============================================
// API Roadmap Functions
// =============================================

async function fetchRoadmap(track = 'Full-Stack') {
  const res = await api.get(`/api/roadmap?track=${track}`);
  return res; // api wrapper already returns json body
}

async function toggleTask(taskId, cardEl) {
  try {
    const res = await api.patch('/api/roadmap/toggle', { task_id: taskId });
    const completed = res.completed;

    // Update UI based on response
    cardEl.classList.toggle('completed', completed);
    cardEl.querySelector('.checkbox').checked = completed;

    if (completed) {
      showToast('Task completed! 🎯', 'success', 2000);
      celebrateCompletion(cardEl);
    }

    await loadStats();
  } catch (err) {
    showToast('Failed to sync progress', 'error');
  }
}

async function renderRoadmap(track = 'Full-Stack') {
  const grid = DOM.dayGridContainer;
  if (!grid) return;

  grid.innerHTML = buildSkeletonHTML();

  try {
    const { tasks, stats } = await fetchRoadmap(track);
    grid.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'day-grid';

    tasks.forEach(task => {
      const card = document.createElement('div');
      // Adapting the user's logic to maintain existing CSS styles (day-card, day-check, etc)
      card.className = `day-card ${task.completed ? 'completed' : ''}`;
      card.innerHTML = `
        <label class="day-check">
          <input type="checkbox" class="checkbox" ${task.completed ? 'checked' : ''} aria-label="Mark task complete" />
          <span class="checkmark">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
        </label>
        <div class="day-info">
          <div class="day-number">Day ${task.day_number}</div>
          <div class="day-title">${escapeHtml(task.title)}</div>
          <span class="day-tag">${escapeHtml(task.track)}</span>
        </div>
      `;

      card.querySelector('.checkbox').addEventListener('change', () => {
        toggleTask(task.task_id, card);
      });

      wrapper.appendChild(card);
    });

    grid.appendChild(wrapper);
    updateStats(stats);
  } catch (err) {
    console.error('Failed to render roadmap:', err);
    grid.innerHTML = buildEmptyState('Failed to load roadmap tasks');
  }
}

function updateStats(stats) {
  const completedEl = document.querySelector('[data-stat="completed"]');
  const percentageEl = document.querySelector('[data-stat="percentage"]');
  const remainingEl = document.querySelector('[data-stat="remaining"]');

  if (completedEl) completedEl.textContent = stats.completed;
  if (percentageEl) percentageEl.textContent = stats.percentage + '%';
  if (remainingEl) remainingEl.textContent = stats.remaining;
}

async function loadStats() {
  try {
    const { stats } = await fetchRoadmap(currentTrack);
    updateStats(stats);
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// =============================================
// Micro-animations & Celebrations
// =============================================
function celebrateCompletion(card) {
  card.style.transition = 'transform .15s var(--ease-out)';
  card.style.transform = 'scale(1.03)';
  setTimeout(() => {
    card.style.transform = '';
  }, 200);
}

function launchConfetti() {
  const burst = document.createElement('div');
  burst.className = 'confetti-burst';
  document.body.appendChild(burst);

  const colors = ['#6366f1', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#a78bfa', '#f472b6'];
  const count = 80;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    const size = Math.random() * 8 + 4;
    const x = Math.random() * 100;
    const delay = Math.random() * .4;
    const rotation = Math.random() * 720 - 360;
    const drift = (Math.random() - 0.5) * 200;

    Object.assign(piece.style, {
      position: 'absolute',
      left: `${x}%`,
      top: '-10px',
      width: `${size}px`,
      height: `${size * (Math.random() > 0.5 ? 1 : 0.6)}px`,
      background: colors[Math.floor(Math.random() * colors.length)],
      borderRadius: Math.random() > 0.5 ? '50%' : '2px',
      animation: `confetti-fall ${1.8 + Math.random() * 1.2}s ${delay}s ease-in forwards`,
      transform: `translateX(0) rotate(0deg)`,
    });

    piece.style.setProperty('--drift', `${drift}px`);
    piece.style.setProperty('--rotation', `${rotation}deg`);
    burst.appendChild(piece);
  }

  if (!document.getElementById('confetti-style')) {
    const style = document.createElement('style');
    style.id = 'confetti-style';
    style.textContent = `
      @keyframes confetti-fall {
        0%   { opacity: 1; transform: translateY(0) translateX(0) rotate(0deg); }
        100% { opacity: 0; transform: translateY(100vh) translateX(var(--drift)) rotate(var(--rotation)); }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => burst.remove(), 4000);
}

// =============================================
// Skeleton & Empty State Builders
// =============================================
function buildSkeletonHTML() {
  let html = '<div class="skeleton-grid">';
  for (let i = 0; i < 9; i++) {
    html += '<div class="skeleton-card"></div>';
  }
  html += '</div>';
  return html;
}

function buildEmptyState(msg) {
  return `
    <div class="empty-state">
      <div class="empty-icon">📭</div>
      <h4>${escapeHtml(msg)}</h4>
      <p>Try selecting a different track or refresh the page.</p>
    </div>
  `;
}

// =============================================
// Security Helpers
// =============================================
function escapeHtml(str) {
  if (!str) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, c => map[c]);
}

// =============================================
// Boot
// =============================================
document.addEventListener('DOMContentLoaded', initApp);
