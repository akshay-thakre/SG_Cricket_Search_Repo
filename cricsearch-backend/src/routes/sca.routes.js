/**
 * @module sca.routes
 * @description Express router for Singapore Cricket Association (SCA) endpoints.
 */

const express = require('express');
const { searchPlayers } = require('../services/sca/sca.service');
const { fetchPlayerStats } = require('../services/sca/sca.profile');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// MOCK_MODE — local dev/testing without live SCA network access
// Set MOCK_MODE=true in cricsearch-backend/.env to enable
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_MODE = process.env.MOCK_MODE === 'true';

const MOCK_SEARCH_RESULT = {
  source: 'sca',
  query: {},
  totalResults: 3,
  players: [
    {
      id: '1077340',
      name: 'Kintul Mistry',
      profileUrl: 'https://scores.cricketsingapore.com/SingaporeCricketAssoc/viewPlayer.do?playerId=1077340&clubId=7683',
      playerRole: 'All Rounder',
      teamName: 'IIT ALUMNI',
      verified: true,
    },
    {
      id: '1013948',
      name: 'Mist3331 Kintul Mistry',
      profileUrl: 'https://scores.cricketsingapore.com/SingaporeCricketAssoc/viewPlayer.do?playerId=1013948&clubId=7683',
      playerRole: 'All Rounder',
      teamName: 'IIT ALUMNI ASSOCIATION SINGAPORE IIT Alumni',
      verified: false,
    },
    {
      id: '1013949',
      name: 'Mist3331mistry Kintul',
      profileUrl: 'https://scores.cricketsingapore.com/SingaporeCricketAssoc/viewPlayer.do?playerId=1013949&clubId=7683',
      playerRole: 'All Rounder',
      teamName: 'Cognizant',
      verified: false,
    },
  ],
  meta: {
    method: 'mock',
    upstreamUrl: 'mock',
    responseStatus: 200,
    blocked: false,
    empty: false,
    message: '[MOCK] Found 3 player(s).',
    scrapedAt: new Date().toISOString(),
  },
};

const MOCK_STATS = {
  '1077340': {
    playerId: '1077340',
    playerName: 'Kintul Mistry',
    teamName: 'IIT ALUMNI',
    playerRole: 'All Rounder',
    batting: {
      matches: 55, innings: 50, notOuts: 7, runs: 1514, highestScore: '89*',
      average: 35.21, strikeRate: 88.45, centuries: 0, fifties: 9, fours: 162, sixes: 38,
    },
    bowling: {
      matches: 55, overs: 120, maidens: 14, runs: 892, wickets: 67,
      average: 13.31, economy: 7.43, strikeRate: 10.75, bestBowling: '4/18',
    },
    competitions: [],
    profileFetched: true,
  },
  '1013948': {
    playerId: '1013948',
    playerName: 'Mist3331 Kintul Mistry',
    teamName: 'IIT ALUMNI ASSOCIATION SINGAPORE IIT Alumni',
    playerRole: 'All Rounder',
    batting: {
      matches: 26, innings: 24, notOuts: 4, runs: 522, highestScore: '67',
      average: 26.10, strikeRate: 82.34, centuries: 0, fifties: 3, fours: 58, sixes: 14,
    },
    bowling: {
      matches: 26, overs: 48, maidens: 5, runs: 362, wickets: 23,
      average: 15.74, economy: 7.54, strikeRate: 12.52, bestBowling: '3/28',
    },
    competitions: [],
    profileFetched: true,
  },
  '1013949': {
    playerId: '1013949',
    playerName: 'Mist3331mistry Kintul',
    teamName: 'Cognizant',
    playerRole: 'All Rounder',
    batting: null,
    bowling: null,
    competitions: [],
    profileFetched: true,
  },
};

/**
 * All recognised search field names.
 * @type {string[]}
 */
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

/**
 * Hardcoded list of SCA clubs extracted from the <select> dropdown
 * on the live search page.
 * @type {string[]}
 */
const SCA_CLUBS = [
  'Andhra Cricket Club',
  'ANZA CC',
  'August International',
  'Auto Deskers',
  'Avadh Cricket Club',
  'Avensys Consulting',
  'Bengal Cricket Club',
  'Capgemini',
  'Central Skylines',
  'Ceylon Sports Club',
  'Challengers Cricket Club',
  'Challengers United Cricket Club-UWCC',
  'Champions Cricket Club',
  'Citi',
  'Cracking Willows Cricket Club',
  'DBS Bank',
  'Deutsche Bank',
  'Eastern Tridents',
  'Eleven Rocks Cricket Club',
  'Falcons Cricket Club',
  'Golden Cricket Club',
  'Hawks Cricket Club',
  'Himalayan Cricket Club',
  'Horizon Cricket Club',
  'IBM',
  'IIT Alumini Association Singapore',
  'Indi Cricket Club',
  'Indian Association',
  'Island Cricket Club',
  'Kairali Cricket Club',
  'Kaybee',
  'KPMG',
  'Lanka Lions',
  'Luxoft',
  'Marina Cricket Club',
  'Mariners Cricket Club',
  'MDIS',
  'Metro South Dockers',
  'Millenium United Cricket Club',
  'Nanyang Technological University',
  'Northern Stomers',
  'NUS',
  'OCBC',
  'Oracle Corporation',
  'P&G',
  'PAY PAL Cricket Club',
  'Pera Knight Riders',
  'Phoenix CC',
  'Sengkang Cricket Club',
  'Singapore Airlines Sports Club',
  'Singapore Cricket Club',
  'Singapore Pakistani Association CC',
  'Singapore Police force',
  'Singapore Recreation Club',
  'Singapore Swimming Club',
  'Singtel Recreation Club',
  'South East Zone',
  'Spartans',
  'Standard Chartered Bank',
  'Strikers Cricket Club',
  'Team Spirit CC',
  'TEST - Training',
  'Thanjai Cricket Club',
  'Thirties Never Tire Cricket Club',
  'Tionale',
  'Tuskers Eagles',
  'United Indians Cricket Club',
  'Visa',
  'Wanderers Cricket Club',
  'Warriors Cricket Club',
  'West Coast Warriors',
];

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sca/players/search — Main player search
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/sca/players/search', async (req, res) => {
  try {
    // Pick only recognised fields from the request body
    const params = {};
    for (const field of SEARCH_FIELDS) {
      if (req.body[field] !== undefined && req.body[field] !== null) {
        params[field] = String(req.body[field]).trim();
      }
    }

    // Validate: at least one search field must have a value
    const hasValue = SEARCH_FIELDS.some((f) => params[f] && params[f].length > 0);
    if (!hasValue) {
      return res.status(400).json({
        error: 'At least one search field must be provided.',
        fields: SEARCH_FIELDS,
      });
    }

    if (MOCK_MODE) {
      console.log('[SCA:search] MOCK_MODE — returning pre-built player list');
      return res.json({ ...MOCK_SEARCH_RESULT, query: params });
    }

    const result = await searchPlayers(params);
    return res.json(result);
  } catch (err) {
    console.error('[SCA:search] Error:', err.message);
    return res.status(502).json({
      error: 'Failed to fetch results from SCA.',
      message: err.message,
      source: 'sca',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sca/players/:id/stats — Fetch detailed player stats from profile page
// ─────────────────────────────────────────────────────────────────────────────
router.get('/api/sca/players/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !/^\d+$/.test(id)) {
      return res.status(400).json({ error: 'Invalid player ID. Must be numeric.' });
    }

    if (MOCK_MODE) {
      console.log(`[SCA:stats] MOCK_MODE — returning pre-built stats for player ${id}`);
      const mockData = MOCK_STATS[id] || {
        playerId: id, playerName: null, teamName: null, playerRole: null,
        batting: null, bowling: null, competitions: [], profileFetched: true,
      };
      return res.json(mockData);
    }

    const stats = await fetchPlayerStats(id);
    return res.json(stats);
  } catch (err) {
    console.error('[SCA:stats] Error:', err.message);
    return res.status(502).json({
      error: 'Failed to fetch player statistics.',
      message: err.message,
      source: 'sca',
      profileFetched: false,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sca/health — SCA-specific health check
// ─────────────────────────────────────────────────────────────────────────────
router.get('/api/sca/health', (_req, res) => {
  res.json({
    status: 'ok',
    source: 'sca',
    method: 'cheerio',
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sca/clubs — List of available SCA clubs
// ─────────────────────────────────────────────────────────────────────────────
router.get('/api/sca/clubs', (_req, res) => {
  res.json({
    source: 'sca',
    totalClubs: SCA_CLUBS.length,
    clubs: SCA_CLUBS,
  });
});

module.exports = router;
