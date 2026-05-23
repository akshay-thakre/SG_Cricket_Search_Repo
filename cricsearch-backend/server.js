const express = require('express');
const cors = require('cors');
require('dotenv').config();

const scaRoutes = require('./src/routes/sca.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use(scaRoutes);

// Global health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'CricSearch SG backend API is running',
    platforms: {
      sca: { status: 'active', method: 'cheerio' },
      sportygo: { status: 'blocked', method: 'requires-playwright', note: 'Returns 403 - anti-bot protection' },
    },
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log('🏏 CricSearch SG Backend API');
  console.log('========================================');
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📡 SCA: Active (Cheerio scraping)`);
  console.log(`🚫 SPORTYGO: Blocked (403 - needs Playwright)`);
  console.log('');
  console.log('Available Endpoints:');
  console.log('  GET  /api/health');
  console.log('  POST /api/sca/players/search');
  console.log('  GET  /api/sca/health');
  console.log('  GET  /api/sca/clubs');
  console.log('========================================');
});

module.exports = app;