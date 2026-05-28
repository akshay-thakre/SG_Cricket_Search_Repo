const express = require('express');
const cors = require('cors');
require('dotenv').config();

const scaRoutes = require('./src/routes/sca.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// ── CORS ──────────────────────────────────────────────────────────────────────
// In production, set ALLOWED_ORIGIN to a comma-separated list of allowed origins
// e.g. ALLOWED_ORIGIN=https://cricsearch-frontend.onrender.com
// If ALLOWED_ORIGIN is not set, all origins are allowed (fine for public APIs).
const allowedOrigins = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(',').map((s) => s.trim())
  : null;

app.use(
  cors({
    origin: allowedOrigins
      ? (origin, callback) => {
          // Allow requests with no Origin header (curl, mobile apps, etc.)
          if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
          return callback(new Error(`CORS: origin ${origin} is not allowed`));
        }
      : true, // true = reflect any origin (allow all)
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use(scaRoutes);

// ── Global health check ───────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'CricSearch SG backend API is running',
    env: process.env.NODE_ENV || 'development',
    platforms: {
      sca: { status: 'active', method: 'cheerio' },
      sportygo: { status: 'blocked', method: 'requires-playwright', note: 'Returns 403 - anti-bot protection' },
    },
    timestamp: new Date().toISOString(),
  });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('========================================');
  console.log('🏏 CricSearch SG Backend API');
  console.log('========================================');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 SCA: Active (Cheerio scraping)`);
  console.log(`🔒 CORS: ${allowedOrigins ? allowedOrigins.join(', ') : 'all origins allowed'}`);
  console.log('');
  console.log('Endpoints:');
  console.log('  GET  /api/health');
  console.log('  POST /api/sca/players/search');
  console.log('  GET  /api/sca/players/:id/stats');
  console.log('  GET  /api/sca/health');
  console.log('  GET  /api/sca/clubs');
  console.log('========================================');
});

module.exports = app;
