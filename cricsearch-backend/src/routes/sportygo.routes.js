/**
 * @module sportygo.routes
 * @description Express router for Sportygo (cricclubs.com/sportygo) endpoints.
 */

const express = require('express');
const { searchPlayers } = require('../services/sportygo/sportygo.service');
const { fetchSportygoPlayerStats } = require('../services/sportygo/sportygo.profile');
const selectors = require('../services/sportygo/sportygo.selectors');

const router = express.Router();

const SEARCH_FIELDS = [
  'firstName',
  'lastName',
  'teamName',
  'playerCCId',
  'emailId',
  'gender',
  'internalClub',
  'battingStyle',
  'bowlingStyle',
  'playerStatus',
];

const MAX_FIELD_LENGTH = 100;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sportygo/players/search
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/sportygo/players/search', async (req, res) => {
  try {
    const params = {};
    for (const field of SEARCH_FIELDS) {
      if (req.body[field] !== undefined && req.body[field] !== null) {
        const value = String(req.body[field]).trim();
        if (value.length > MAX_FIELD_LENGTH) {
          return res.status(400).json({
            error: `Field '${field}' exceeds maximum allowed length of ${MAX_FIELD_LENGTH} characters.`,
          });
        }
        params[field] = value;
      }
    }

    const hasValue = SEARCH_FIELDS.some((f) => params[f] && params[f].length > 0);
    if (!hasValue) {
      return res.status(400).json({
        error: 'At least one search field must be provided.',
        fields: SEARCH_FIELDS,
      });
    }

    const result = await searchPlayers(params);
    return res.json(result);
  } catch (err) {
    console.error('[Sportygo:search] Error:', err.message);
    return res.status(502).json({
      error: 'Failed to fetch results from Sportygo.',
      source: 'sportygo',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sportygo/players/:id/stats?clubId=XXX
// ─────────────────────────────────────────────────────────────────────────────
router.get('/api/sportygo/players/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const { clubId } = req.query;

    if (!id || !/^\d+$/.test(id)) {
      return res.status(400).json({ error: 'Invalid player ID. Must be numeric.' });
    }

    const resolvedClubId = clubId || process.env.SPORTYGO_CLUB_ID || selectors.CLUB_ID;
    if (!resolvedClubId || !/^\d+$/.test(resolvedClubId)) {
      return res.status(400).json({
        error: 'Invalid clubId. Provide clubId query param or set SPORTYGO_CLUB_ID env var.',
      });
    }

    const stats = await fetchSportygoPlayerStats(id, resolvedClubId);
    return res.json(stats);
  } catch (err) {
    console.error('[Sportygo:stats] Error:', err.message);
    return res.status(502).json({
      error: 'Failed to fetch player statistics from Sportygo.',
      source: 'sportygo',
      profileFetched: false,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sportygo/health
// ─────────────────────────────────────────────────────────────────────────────
router.get('/api/sportygo/health', (_req, res) => {
  res.json({
    status: 'ok',
    source: 'sportygo',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
