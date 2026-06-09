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
// NOTE: Do NOT include /api here — endpoint paths already include it.
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : 'https://sprint30.onrender.com';

const TOKEN_KEY = 'sprint30_token';
const EMAIL_KEY = 'sprint30_email';
const PROGRESS_KEY = 'sprint30_progress';   // localStorage fallback for progress

// ── 30-Day Roadmap Data ────────────────────────
// Each track has 30 tasks. The frontend ships with
// a built-in curriculum; the backend can override it.
const TRACKS = {
  'Full-Stack': [
    'HTML5 Semantic Elements & Accessibility',
    'CSS Flexbox Deep Dive',
    'CSS Grid Mastery',
    'JavaScript ES6+ Fundamentals',
    'DOM Manipulation & Events',
    'Async JavaScript — Promises & Async/Await',
    'Fetch API & REST Principles',
    'Node.js Core Concepts',
    'Express.js Routing & Middleware',
    'MySQL Schema Design & Queries',
    'Database Joins & Indexing',
    'JWT Authentication Flow',
    'Password Hashing with Bcrypt',
    'CORS & Security Headers',
    'Environment Variables & Config',
    'Error Handling Patterns',
    'Input Validation & Sanitization',
    'File Uploads & Multer',
    'React Component Architecture',
    'React State & Props',
    'React Hooks — useState & useEffect',
    'React Router & Navigation',
    'API Integration in React',
    'Responsive Design Patterns',
    'Testing with Jest & RTL',
    'CI/CD Pipeline Basics',
    'Docker Fundamentals',
    'Deploying to Render',
    'Performance Optimization',
    'Capstone Project — Full-Stack App',
  ],
  'Frontend': [
    'HTML5 Semantic Markup',
    'CSS Selectors & Specificity',
    'CSS Custom Properties (Variables)',
    'Flexbox Layout Patterns',
    'CSS Grid — Real-world Layouts',
    'CSS Animations & Transitions',
    'Responsive Design & Media Queries',
    'JavaScript Fundamentals Review',
    'DOM Traversal & Manipulation',
    'Event Delegation & Bubbling',
    'ES6 Modules & Bundling Concepts',
    'Fetch API & Handling Responses',
    'LocalStorage & SessionStorage',
    'Form Validation Patterns',
    'Accessibility (a11y) Best Practices',
    'React — JSX & Component Basics',
    'React — Props, State & Lifecycle',
    'React — Hooks Deep Dive',
    'React — Context API & Global State',
    'React Router v6',
    'Styled Components / CSS Modules',
    'State Management with Zustand',
    'Data Fetching with React Query',
    'Building a Design System',
    'Performance — Code Splitting & Lazy Loading',
    'Web Vitals & Lighthouse',
    'Progressive Web Apps (PWA)',
    'Testing — Vitest & RTL',
    'Storybook for Component Docs',
    'Capstone — Portfolio Dashboard',
  ],
  'Backend': [
    'Node.js Runtime & Event Loop',
    'NPM & Package Management',
    'Express.js — Hello World Server',
    'Routing & Route Parameters',
    'Middleware Chain & Custom Middleware',
    'Request Parsing — Body, Query, Params',
    'MySQL — Installation & CLI',
    'Schema Design & Normalization',
    'CRUD Operations with mysql2',
    'Prepared Statements & SQL Injection',
    'Connection Pooling',
    'Transactions & ACID',
    'Authentication — JWT Theory',
    'Implementing Signup & Login',
    'Password Hashing & Salting',
    'Protected Routes & Middleware',
    'Role-Based Access Control',
    'File Uploads & Cloud Storage',
    'Rate Limiting & Throttling',
    'Error Handling & Logging (Winston)',
    'Environment Config & dotenv',
    'API Versioning Strategies',
    'WebSockets with Socket.io',
    'Background Jobs & Queues',
    'Caching with Redis',
    'Automated Testing — Mocha & Chai',
    'API Documentation — Swagger',
    'Docker & Containerization',
    'CI/CD with GitHub Actions',
    'Capstone — Production-Ready API',
  ],
};

const TRACK_NAMES = Object.keys(TRACKS);

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
// Progress Persistence (localStorage fallback)
// =============================================
// The backend may not yet have roadmap endpoints,
// so we persist progress locally per user.
const Progress = {
  _key() {
    const payload = decodeToken(Auth.getToken());
    const uid = payload?.id || 'anon';
    return `${PROGRESS_KEY}_${uid}`;
  },
  load() {
    return safeParse(localStorage.getItem(this._key()), {});
  },
  save(data) {
    localStorage.setItem(this._key(), JSON.stringify(data));
  },
  toggle(track, dayIndex) {
    const data = this.load();
    if (!data[track]) data[track] = [];
    const idx = data[track].indexOf(dayIndex);
    if (idx === -1) {
      data[track].push(dayIndex);
    } else {
      data[track].splice(idx, 1);
    }
    this.save(data);
    return data;
  },
  isCompleted(track, dayIndex) {
    const data = this.load();
    return (data[track] || []).includes(dayIndex);
  },
  getStats() {
    const data = this.load();
    let completed = 0;
    let total = 0;
    for (const track of TRACK_NAMES) {
      total += TRACKS[track].length;
      completed += (data[track] || []).length;
    }
    return { completed, total, remaining: total - completed };
  },
  getTrackStats(track) {
    const data = this.load();
    const completed = (data[track] || []).length;
    const total = TRACKS[track].length;
    return { completed, total };
  }
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
    const error = new Error(data.message || 'Request failed');
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

// We wrap DOM references in a getter pattern so they
// resolve at access time, not at script parse time.
// This prevents null-ref crashes if the DOM isn't ready yet.
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
let pendingOtpEmail = '';   // tracks which email is being verified

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
  // Clear messages
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
  // Tab switching
  if (DOM.tabLogin) DOM.tabLogin.addEventListener('click', () => setAuthMode('login'));
  if (DOM.tabSignup) DOM.tabSignup.addEventListener('click', () => setAuthMode('signup'));

  // ── Login ──
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
        // If backend says account needs verification, show OTP view
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

  // ── Signup ──
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

        // Transition to OTP verification view
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
  // Focus the input after transition
  setTimeout(() => { if (DOM.otpInput) DOM.otpInput.focus(); }, 300);
}

function bindOtpEvents() {
  // ── Verify OTP ──
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
        // Go back to login
        showView('auth');
        setAuthMode('login');
        // Pre-fill email for convenience
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

  // ── Resend OTP ──
  if (DOM.otpResendBtn) {
    DOM.otpResendBtn.addEventListener('click', async () => {
      if (!pendingOtpEmail) return;

      DOM.otpResendBtn.disabled = true;
      DOM.otpResendBtn.textContent = 'Sending…';

      try {
        await api.post('/api/auth/resend-otp', { email: pendingOtpEmail });
        showToast('New verification code sent! 📧', 'success');
        showMessage(DOM.otpMsg, 'A new code has been sent to your email.', 'success');

        // Cooldown: disable resend for 30 seconds
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

  // ── Back to Signup ──
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
  // Set user info
  const email = Auth.getEmail();
  if (DOM.userEmailDisplay) DOM.userEmailDisplay.textContent = email;
  if (DOM.userAvatar) DOM.userAvatar.textContent = email.charAt(0).toUpperCase();

  // Build track selector
  renderTrackSelector();

  // Render current track
  renderDayGrid(currentTrack);

  // Update stats
  updateStats();
}

// =============================================
// Dashboard — Event Bindings
// =============================================
function bindDashboardEvents() {
  // ── Logout ──
  if (DOM.logoutBtn) {
    DOM.logoutBtn.addEventListener('click', () => {
      Auth.clearSession();
      showToast('Logged out successfully', 'info');
      showView('auth');
      // Reset forms
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

  // "All" button
  const allBtn = document.createElement('button');
  allBtn.className = 'track-btn' + (currentTrack === '__all__' ? ' active' : '');
  allBtn.textContent = '🌐 All Tracks';
  allBtn.addEventListener('click', () => {
    currentTrack = '__all__';
    updateTrackButtons();
    renderDayGrid(currentTrack);
    updateStats();
  });
  DOM.trackSelector.appendChild(allBtn);

  // Individual track buttons
  const icons = { 'Full-Stack': '⚡', 'Frontend': '🎨', 'Backend': '⚙️' };
  TRACK_NAMES.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'track-btn' + (currentTrack === name ? ' active' : '');
    btn.textContent = `${icons[name] || '📘'} ${name}`;
    btn.addEventListener('click', () => {
      currentTrack = name;
      updateTrackButtons();
      renderDayGrid(name);
      updateStats();
    });
    DOM.trackSelector.appendChild(btn);
  });
}

function updateTrackButtons() {
  if (!DOM.trackSelector) return;
  const buttons = DOM.trackSelector.querySelectorAll('.track-btn');
  buttons.forEach((btn, i) => {
    const isAll = i === 0;
    const matchTrack = isAll ? '__all__' : TRACK_NAMES[i - 1];
    btn.classList.toggle('active', currentTrack === matchTrack);
  });

  if (DOM.trackBadge) {
    DOM.trackBadge.textContent = currentTrack === '__all__' ? 'All Tracks' : currentTrack;
  }
}

// =============================================
// Dashboard — Day Grid Rendering
// =============================================
function renderDayGrid(track) {
  const container = DOM.dayGridContainer;
  if (!container) return;

  // Show skeleton briefly
  container.innerHTML = buildSkeletonHTML();

  // Simulate async load feel
  requestAnimationFrame(() => {
    setTimeout(() => {
      if (track === '__all__') {
        renderAllTracks(container);
      } else {
        renderSingleTrack(container, track);
      }
    }, 150);
  });
}

function renderSingleTrack(container, track) {
  const tasks = TRACKS[track];
  if (!tasks) {
    container.innerHTML = buildEmptyState('Track not found');
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'day-grid';

  tasks.forEach((task, index) => {
    grid.appendChild(createDayCard(track, index, task));
  });

  container.innerHTML = '';
  container.appendChild(grid);
}

function renderAllTracks(container) {
  container.innerHTML = '';

  TRACK_NAMES.forEach(track => {
    const header = document.createElement('div');
    header.className = 'section-header';
    header.style.marginTop = '24px';
    header.innerHTML = `
      <h3>${track}</h3>
      <span class="section-badge">${Progress.getTrackStats(track).completed}/${TRACKS[track].length}</span>
    `;

    const grid = document.createElement('div');
    grid.className = 'day-grid';
    grid.style.marginBottom = '16px';

    TRACKS[track].forEach((task, index) => {
      grid.appendChild(createDayCard(track, index, task));
    });

    container.appendChild(header);
    container.appendChild(grid);
  });
}

function createDayCard(track, index, task) {
  const card = document.createElement('div');
  const isCompleted = Progress.isCompleted(track, index);
  card.className = `day-card${isCompleted ? ' completed' : ''}`;

  card.innerHTML = `
    <label class="day-check">
      <input type="checkbox" ${isCompleted ? 'checked' : ''} aria-label="Mark day ${index + 1} complete" />
      <span class="checkmark">
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      </span>
    </label>
    <div class="day-info">
      <div class="day-number">Day ${index + 1}</div>
      <div class="day-title">${escapeHtml(task)}</div>
      <span class="day-tag">${track}</span>
    </div>
  `;

  // Checkbox toggle
  const checkbox = card.querySelector('input[type="checkbox"]');
  checkbox.addEventListener('change', () => {
    const checked = checkbox.checked;
    card.classList.toggle('completed', checked);
    Progress.toggle(track, index);
    updateStats();

    // Sync to backend (fire and forget)
    syncProgressToBackend(track, index, checked);

    if (checked) {
      showToast(`Day ${index + 1} completed! 🎯`, 'success', 2000);
      celebrateCompletion(card);
    }

    // Check for track completion
    const stats = Progress.getTrackStats(track);
    if (stats.completed === stats.total && checked) {
      setTimeout(() => {
        showToast(`🏆 ${track} track complete! Incredible!`, 'success', 5000);
        launchConfetti();
      }, 500);
    }
  });

  return card;
}

// =============================================
// Dashboard — Stats Update
// =============================================
function updateStats() {
  const stats = Progress.getStats();
  const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  // Animate counter
  if (DOM.statCompleted) animateCounter(DOM.statCompleted, stats.completed);
  if (DOM.statRemaining) animateCounter(DOM.statRemaining, stats.remaining);
  if (DOM.statProgress) DOM.statProgress.textContent = `${pct}%`;
  if (DOM.progressPct) DOM.progressPct.textContent = `${pct}%`;
  if (DOM.progressFill) DOM.progressFill.style.width = `${pct}%`;
}

function animateCounter(el, target) {
  if (!el) return;
  const current = parseInt(el.textContent) || 0;
  if (current === target) return;

  const diff = target - current;
  const steps = Math.min(Math.abs(diff), 15);
  const stepSize = diff / steps;
  let step = 0;

  const interval = setInterval(() => {
    step++;
    if (step >= steps) {
      el.textContent = target;
      clearInterval(interval);
    } else {
      el.textContent = Math.round(current + stepSize * step);
    }
  }, 30);
}

// =============================================
// Backend Sync (Fire & Forget)
// =============================================
// This calls a /api/progress endpoint if it exists.
// If the endpoint doesn't exist yet, it fails silently
// and progress is preserved in localStorage.
async function syncProgressToBackend(track, dayIndex, completed) {
  try {
    await api.post('/api/progress', { track, dayIndex, completed });
  } catch {
    // Backend endpoint may not exist yet — silently fall back to localStorage
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

    // Inject keyframes dynamically
    piece.style.setProperty('--drift', `${drift}px`);
    piece.style.setProperty('--rotation', `${rotation}deg`);

    burst.appendChild(piece);
  }

  // Inject confetti animation if not already present
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
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return str.replace(/[&<>"']/g, c => map[c]);
}

// =============================================
// Boot
// =============================================
document.addEventListener('DOMContentLoaded', initApp);
