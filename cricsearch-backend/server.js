const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const scaRoutes     = require('./src/routes/sca.routes');
const sportygoRoutes = require('./src/routes/sportygo.routes');
const yplRoutes     = require('./src/routes/ypl.routes');

const app = express();
const PORT = process.env.PORT || 5000;
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Security headers (helmet) ─────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // API-only server; no HTML served
    crossOriginEmbedderPolicy: false,
  })
);

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

// ── Rate limiting ─────────────────────────────────────────────────────────────
// General limiter: 120 requests per minute per IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Strict limiter for scraping endpoints to prevent upstream IP bans
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many search requests, please slow down.' },
});

app.use(generalLimiter);

// ── Body parsing ──────────────────────────────────────────────────────────────
// Explicit 16 kb limit — search payloads are small; large bodies are rejected
app.use(express.json({ limit: '16kb' }));

// ── Routes ────────────────────────────────────────────────────────────────────
// Apply strict rate limiting to live-scraping search endpoints
app.use('/api/sca/players/search', searchLimiter);
app.use('/api/sportygo/players/search', searchLimiter);
app.use(scaRoutes);
app.use(sportygoRoutes);
app.use(yplRoutes);

// ── Global health check ───────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'CricSearch SG backend API is running',
    platforms: {
      sca:     { status: 'active' },
      sportygo: { status: 'active' },
      ypl:     { status: 'active', displayName: 'YPL' },
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
  res.status(500).json({
    error: 'Internal server error',
    // Omit internal details in production to prevent information leakage
    ...(IS_PROD ? {} : { message: err.message }),
  });
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
  console.log('  POST /api/sportygo/players/search');
  console.log('  GET  /api/sportygo/players/:id/stats?clubId=XXX');
  console.log('  GET  /api/sportygo/health');
  console.log('  GET  /api/ypl/batting?year=YYYY&team=211|120|consolidated');
  console.log('  GET  /api/ypl/years');
  console.log('  GET  /api/ypl/health');
  console.log(`🏟️  Sportygo: Active (axios+cheerio, clubId=${process.env.SPORTYGO_CLUB_ID || '4263'})`);
  console.log(`🏏  YPL: Active (static JSON, Sportygo/YPL league)`);
  console.log('========================================');
});

module.exports = app;
