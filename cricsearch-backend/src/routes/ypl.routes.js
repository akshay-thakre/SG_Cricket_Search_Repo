'use strict';

/**
 * @module ypl.routes
 * @description Express routes for YPL (Sportygo) batting statistics.
 * Data is served from static JSON files under cricsearch-backend/data/sportygo/ypl/batting/
 *
 * GET /api/ypl/batting?year=2026&team=211          → team-211.json (or sample fallback)
 * GET /api/ypl/batting?year=2026&team=120          → team-120.json (or sample fallback)
 * GET /api/ypl/batting?year=2026&team=consolidated → consolidated.json (or sample fallback)
 * GET /api/ypl/years                               → list available years
 * GET /api/ypl/health                              → health check
 */

const express = require('express');
const {
  loadTeamData,
  loadConsolidatedData,
  listAvailableYears,
} = require('../services/battingAggregationService');

const router = express.Router();

const CURRENT_YEAR = new Date().getFullYear().toString();
const VALID_TEAM_IDS = ['211', '120'];

// ── GET /api/ypl/batting ─────────────────────────────────────────────────────
router.get('/api/ypl/batting', (req, res) => {
  const year = String(req.query.year || CURRENT_YEAR);
  const team = String(req.query.team || '211').toLowerCase();

  if (!/^\d{4}$/.test(year)) {
    return res.status(400).json({ error: 'year must be a 4-digit number' });
  }

  if (team === 'consolidated') {
    const { data, usingSample } = loadConsolidatedData(year);
    if (!data) {
      return res.status(404).json({
        error: `No YPL consolidated data found for year ${year}.`,
        hint: 'Run: npm run import:ypl:batting  to generate data files.',
      });
    }
    return res.json({ ...data, usingSample });
  }

  if (!VALID_TEAM_IDS.includes(team)) {
    return res.status(400).json({
      error: `Invalid team. Must be one of: ${VALID_TEAM_IDS.join(', ')}, consolidated`,
    });
  }

  const { data, usingSample } = loadTeamData(year, team);
  if (!data) {
    return res.status(404).json({
      error: `No YPL Team ${team} data found for year ${year}.`,
      hint: 'Run: npm run import:ypl:batting  to generate data files.',
    });
  }

  return res.json({ ...data, usingSample });
});

// ── GET /api/ypl/years ───────────────────────────────────────────────────────
router.get('/api/ypl/years', (_req, res) => {
  const years = listAvailableYears();
  res.json({ years, currentYear: CURRENT_YEAR });
});

// ── GET /api/ypl/health ──────────────────────────────────────────────────────
router.get('/api/ypl/health', (_req, res) => {
  const years = listAvailableYears();
  res.json({
    status: 'ok',
    source: 'sportygo-ypl',
    displayName: 'YPL',
    method: 'static-json',
    availableYears: years,
    teams: VALID_TEAM_IDS,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
