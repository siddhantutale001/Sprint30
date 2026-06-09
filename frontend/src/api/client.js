// =============================================
// Centralized API Client  —  Frontend
// =============================================
// Drop this file into your React project:  src/api/client.js
//
// Usage:
//   import api from './api/client';
//   const res = await api.post('/auth/login', { email, password });
//   console.log(res.data);
// =============================================

/**
 * Base URL resolution:
 *
 * ┌─────────────┬────────────────────────────────────────────────┐
 * │ Environment │ Value                                          │
 * ├─────────────┼────────────────────────────────────────────────┤
 * │ Vite        │ import.meta.env.VITE_API_URL                   │
 * │ CRA         │ process.env.REACT_APP_API_URL                  │
 * │ Fallback    │ http://localhost:5000/api  (local dev)          │
 * └─────────────┴────────────────────────────────────────────────┘
 *
 * On Vercel, set the env var in Project Settings → Environment Variables:
 *   VITE_API_URL = https://your-backend.onrender.com/api
 */

// ── Detect the correct env variable ──
function getBaseURL() {
  // Vite exposes env vars via import.meta.env
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Create React App exposes env vars via process.env
  if (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // Local development fallback
  return 'http://localhost:5000/api';
}

const BASE_URL = getBaseURL();

// ── Lightweight fetch wrapper (no axios dependency) ──
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // Automatically attach the JWT if it exists in localStorage
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || 'API request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ── Convenience methods ──
const api = {
  get:    (endpoint, opts)       => request(endpoint, { method: 'GET', ...opts }),
  post:   (endpoint, body, opts) => request(endpoint, { method: 'POST',   body: JSON.stringify(body), ...opts }),
  put:    (endpoint, body, opts) => request(endpoint, { method: 'PUT',    body: JSON.stringify(body), ...opts }),
  patch:  (endpoint, body, opts) => request(endpoint, { method: 'PATCH',  body: JSON.stringify(body), ...opts }),
  delete: (endpoint, opts)       => request(endpoint, { method: 'DELETE', ...opts }),
};

export default api;
