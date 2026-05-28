/**
 * @module sca.profile
 * @description Fetches and parses the SCA player profile page to extract
 * batting and bowling statistics. Uses a multi-strategy approach to handle
 * variations in the CricClubs HTML structure.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const selectors = require('./sca.selectors');

const TIMEOUT_MS = 15000;

const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function clean(text) {
  return (text || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

function toInt(val) {
  if (val == null || val === '' || val === '-' || val === 'N/A') return null;
  const n = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? null : n;
}

function toFloat(val) {
  if (val == null || val === '' || val === '-' || val === 'N/A') return null;
  const cleaned = String(val).replace(/[^0-9.]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

function normalizeKey(h) {
  return h.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

// ── Table parsing ─────────────────────────────────────────────────────────────

/**
 * Parse a <table> element into { headers, rows }.
 * Handles duplicate column headers by appending _1, _2 suffixes.
 */
function parseTable($, tableEl) {
  const $table = $(tableEl);
  const rawHeaders = [];

  $table.find('thead tr th, thead tr td').each((_, th) => {
    rawHeaders.push(normalizeKey(clean($(th).text())));
  });

  // Fallback: use first row as header
  if (rawHeaders.length === 0) {
    $table.find('tr').first().find('th, td').each((_, th) => {
      rawHeaders.push(normalizeKey(clean($(th).text())));
    });
  }

  if (rawHeaders.length === 0) return null;

  // Deduplicate headers to avoid key collisions (e.g. "M" = Matches AND "M" = Maidens)
  const headerCounts = {};
  const headers = rawHeaders.map((h) => {
    if (!h) return h;
    const count = headerCounts[h] || 0;
    headerCounts[h] = count + 1;
    return count === 0 ? h : `${h}_${count}`;
  });

  const $bodyRows =
    $table.find('tbody tr').length > 0
      ? $table.find('tbody tr')
      : $table.find('tr').slice(1);

  const rows = [];
  $bodyRows.each((_, tr) => {
    const cells = [];
    $(tr).find('td, th').each((_, td) => cells.push(clean($(td).text())));

    if (cells.some((c) => c && c !== '-')) {
      const row = {};
      headers.forEach((h, j) => {
        if (h) row[h] = cells[j] !== undefined ? cells[j] : '';
      });
      rows.push(row);
    }
  });

  return { headers, rows };
}

// ── Table type detection ──────────────────────────────────────────────────────

const BATTING_INDICATORS = new Set([
  'inn', 'inns', 'innings', 'hs', 'highestscore', '100s', '50s', '4s', '6s',
]);
const BOWLING_INDICATORS = new Set([
  'wkt', 'wkts', 'wickets', 'eco', 'economy', 'bbi', 'bbm', 'best', 'mdns', 'maidens',
]);

function isBattingTable(headers) {
  const base = new Set(headers.map((h) => h.replace(/_\d+$/, ''))); // strip suffix
  return [...BATTING_INDICATORS].some((k) => base.has(k));
}

function isBowlingTable(headers) {
  const base = new Set(headers.map((h) => h.replace(/_\d+$/, '')));
  return [...BOWLING_INDICATORS].some((k) => base.has(k));
}

// ── Stat extraction ───────────────────────────────────────────────────────────

function getField(row, ...keys) {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== '' && v !== '-' && v !== 'N/A') return v;
  }
  return null;
}

function extractBatting(tableData) {
  if (!tableData || tableData.rows.length === 0) return null;
  const r = tableData.rows[0];
  const g = (...k) => getField(r, ...k);

  const batting = {
    matches: toInt(g('m', 'mat', 'matches', 'mp')),
    innings: toInt(g('inn', 'inns', 'innings', 'i')),
    notOuts: toInt(g('no', 'notout', 'nots')),
    runs: toInt(g('runs', 'r', 'run')),
    highestScore: g('hs', 'highest', 'highestscore'),
    average: toFloat(g('avg', 'average', 'ave')),
    strikeRate: toFloat(g('sr', 'str', 'strikerate')),
    centuries: toInt(g('100s', '100', 'centuries')),
    fifties: toInt(g('50s', '50', 'fifties')),
    fours: toInt(g('4s', '4', 'fours')),
    sixes: toInt(g('6s', '6', 'sixes')),
  };

  if (batting.matches === null && batting.runs === null && batting.innings === null) return null;
  return batting;
}

function extractBowling(tableData) {
  if (!tableData || tableData.rows.length === 0) return null;
  const r = tableData.rows[0];
  const g = (...k) => getField(r, ...k);

  const bowling = {
    matches: toInt(g('m', 'mat', 'matches', 'mp')),
    overs: toFloat(g('o', 'overs', 'ov')),
    // 'mdns' handles "Mdns" header; 'm_1' handles duplicate 'M' (when table has M=Matches, M=Maidens)
    maidens: toInt(g('mdns', 'maiden', 'maidens', 'md', 'm_1')),
    runs: toInt(g('r', 'runs', 'run', 'runsconced')),
    wickets: toInt(g('wkt', 'wkts', 'wickets', 'w', 'wic')),
    average: toFloat(g('avg', 'average', 'ave')),
    economy: toFloat(g('eco', 'economy', 'econ', 'er')),
    strikeRate: toFloat(g('sr', 'strikerate', 'bsr')),
    bestBowling: g('best', 'bbi', 'bbm', 'bb'),
  };

  if (bowling.matches === null && bowling.wickets === null) return null;
  return bowling;
}

/**
 * Parse competition/season-wise stats from tables that have a "Competition" column.
 */
function extractCompetitions(tableData, statType) {
  if (!tableData || tableData.rows.length === 0) return [];
  const hasCompCol = tableData.headers.some((h) =>
    ['competition', 'comp', 'tournament', 'season', 'league', 'year', 'yr'].includes(h.replace(/_\d+$/, ''))
  );
  if (!hasCompCol) return [];

  return tableData.rows
    .map((r) => {
      const compName =
        getField(r, 'competition', 'comp', 'tournament', 'season', 'league', 'year', 'yr') || 'Unknown';
      if (statType === 'batting') {
        return {
          competition: compName,
          type: 'batting',
          matches: toInt(getField(r, 'm', 'mat', 'matches')),
          runs: toInt(getField(r, 'runs', 'r')),
          average: toFloat(getField(r, 'avg', 'average')),
          highestScore: getField(r, 'hs', 'highest'),
        };
      }
      return {
        competition: compName,
        type: 'bowling',
        matches: toInt(getField(r, 'm', 'mat', 'matches')),
        wickets: toInt(getField(r, 'wkt', 'wkts', 'wickets')),
        average: toFloat(getField(r, 'avg', 'average')),
        economy: toFloat(getField(r, 'eco', 'economy')),
      };
    })
    .filter((c) => c.competition !== 'Unknown' || c.matches !== null);
}

// ── Main profile parser ───────────────────────────────────────────────────────

/**
 * Parse an SCA player profile HTML page and extract stats.
 * Uses two strategies:
 *   1. Look for section headings ("Batting" / "Bowling") then the next table.
 *   2. Detect table type by column headers.
 *
 * @param {string} html
 * @param {string} playerId
 * @returns {object}
 */
function parsePlayerProfile(html, playerId) {
  const $ = cheerio.load(html);

  const result = {
    playerId,
    playerName: null,
    teamName: null,
    playerRole: null,
    batting: null,
    bowling: null,
    competitions: [],
    profileFetched: true,
  };

  // ── Player name ──────────────────────────────────────────────────
  const nameSelectors = [
    'h3',
    '.player-name',
    '.playername',
    'h2',
    '[class*="profile"] h3',
    '[class*="player"] h3',
  ];
  for (const sel of nameSelectors) {
    const text = clean($(sel).first().text());
    if (text && text.length > 1 && text.length < 80 && !/search|login|register/i.test(text)) {
      result.playerName = text;
      break;
    }
  }

  // ── Team / club ──────────────────────────────────────────────────
  for (const sel of ['h4', '.team-name', '.club-name', '[class*="team"] span']) {
    const text = clean($(sel).first().text());
    if (text && text.length > 1 && text.length < 80) {
      result.teamName = text;
      break;
    }
  }

  // ── Player role ──────────────────────────────────────────────────
  for (const sel of ['.player-role', '.role', '[class*="role"]']) {
    const text = clean($(sel).first().text());
    if (text && text.length > 1 && text.length < 40) {
      result.playerRole = text;
      break;
    }
  }

  // ── Strategy 1: section headings preceding tables ────────────────
  const headingSelector =
    'h3, h4, h5, .border-heading h5, [class*="section"] h5, [class*="heading"] h5';

  $(headingSelector).each((_, el) => {
    const text = clean($(el).text()).toLowerCase();

    if (!result.batting && (text === 'batting' || text.startsWith('batting '))) {
      let nextTable = $(el).nextAll('table').first();
      if (!nextTable.length) nextTable = $(el).parent().nextAll('table').first();
      if (!nextTable.length) nextTable = $(el).closest('div').find('table').first();

      if (nextTable.length) {
        const data = parseTable($, nextTable);
        result.batting = extractBatting(data);
        if (result.batting && data && data.rows.length > 1) {
          result.competitions.push(...extractCompetitions(data, 'batting'));
        }
      }
    }

    if (!result.bowling && (text === 'bowling' || text.startsWith('bowling '))) {
      let nextTable = $(el).nextAll('table').first();
      if (!nextTable.length) nextTable = $(el).parent().nextAll('table').first();
      if (!nextTable.length) nextTable = $(el).closest('div').find('table').first();

      if (nextTable.length) {
        const data = parseTable($, nextTable);
        result.bowling = extractBowling(data);
        if (result.bowling && data && data.rows.length > 1) {
          result.competitions.push(...extractCompetitions(data, 'bowling'));
        }
      }
    }
  });

  // ── Strategy 2: detect table type by column headers ──────────────
  if (!result.batting || !result.bowling) {
    $('table').each((_, table) => {
      const data = parseTable($, table);
      if (!data || data.rows.length === 0) return;

      if (!result.batting && isBattingTable(data.headers)) {
        result.batting = extractBatting(data);
        if (result.batting && data.rows.length > 1) {
          result.competitions.push(...extractCompetitions(data, 'batting'));
        }
      }
      if (!result.bowling && isBowlingTable(data.headers)) {
        result.bowling = extractBowling(data);
        if (result.bowling && data.rows.length > 1) {
          result.competitions.push(...extractCompetitions(data, 'bowling'));
        }
      }
    });
  }

  // Deduplicate competitions by name
  const seen = new Set();
  result.competitions = result.competitions.filter((c) => {
    const key = `${c.competition}_${c.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return result;
}

// ── HTTP fetcher ──────────────────────────────────────────────────────────────

/**
 * Fetch and parse a player's profile page from SCA.
 *
 * Attempt 1: Direct GET (no session) — many CricClubs profiles are public.
 * Attempt 2: Session-based GET if attempt 1 yields no useful data.
 *
 * @param {string} playerId
 * @returns {Promise<object>}
 */
async function fetchPlayerStats(playerId) {
  const searchPageUrl = `${selectors.BASE_URL}${selectors.SEARCH_PATH}?clubId=${selectors.CLUB_ID}`;
  const profileUrl = `${selectors.BASE_URL}/viewPlayer.do?playerId=${playerId}&clubId=${selectors.CLUB_ID}`;

  // ── Attempt 1: direct GET ────────────────────────────────────────
  try {
    const res = await axios.get(profileUrl, {
      headers: COMMON_HEADERS,
      timeout: TIMEOUT_MS,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    if (res.status === 200 && typeof res.data === 'string' && res.data.length > 2000) {
      const parsed = parsePlayerProfile(res.data, playerId);
      if (parsed.batting || parsed.bowling || parsed.playerName) {
        return parsed;
      }
    }
  } catch (_) {
    // fall through to session-based fetch
  }

  // ── Attempt 2: session-based GET ────────────────────────────────
  const getRes = await axios.get(searchPageUrl, {
    headers: COMMON_HEADERS,
    timeout: TIMEOUT_MS,
    maxRedirects: 5,
    validateStatus: () => true,
  });

  let jsessionId = null;
  const setCookies = getRes.headers['set-cookie'];
  if (setCookies) {
    const arr = Array.isArray(setCookies) ? setCookies : [setCookies];
    for (const c of arr) {
      const m = c.match(/JSESSIONID=([^;]+)/);
      if (m) {
        jsessionId = m[1];
        break;
      }
    }
  }

  const profileRes = await axios.get(profileUrl, {
    headers: {
      ...COMMON_HEADERS,
      ...(jsessionId ? { Cookie: `JSESSIONID=${jsessionId}` } : {}),
      Referer: searchPageUrl,
    },
    timeout: TIMEOUT_MS,
    maxRedirects: 5,
    validateStatus: () => true,
  });

  if (profileRes.status !== 200) {
    throw new Error(`Profile page returned HTTP ${profileRes.status}`);
  }

  return parsePlayerProfile(profileRes.data, playerId);
}

module.exports = { fetchPlayerStats, parsePlayerProfile };
