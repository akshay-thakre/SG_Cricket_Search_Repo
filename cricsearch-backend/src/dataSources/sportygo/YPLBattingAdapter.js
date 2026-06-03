'use strict';

/**
 * @module YPLBattingAdapter
 * @description Fetches and parses YPL (Sportygo) team batting statistics from
 * cricclubs.com/sportygo/teamBatting.do. Uses axios + cheerio — no browser required.
 *
 * Source: Sportygo / YPL (displayed as "YPL" in the UI, never as "CricClubs")
 * Club ID: 4263 (YPL league on Sportygo)
 *
 * Column mapping from Sportygo batting table → our schema:
 *   Player / Name / Player Name  → playerName
 *   Mat / M / Matches            → matches
 *   Inn / Inns / Innings         → innings
 *   NO / N/O / Not Out           → notOuts
 *   Runs / R                     → runs
 *   HS / Highest / H.S.          → highestScore (preserves "*" not-out symbol)
 *   Ave / Avg / Average          → average
 *   BF / Balls / Balls Faced     → ballsFaced
 *   SR / S/R / Strike Rate       → strikeRate
 *   100 / 100s / Hundreds        → hundreds
 *   50 / 50s / Fifties           → fifties
 *   4s / Fours                   → fours
 *   6s / Sixes                   → sixes
 *   0s / Ducks / Duck            → ducks
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const { parseNumber, parseHighestScore } = require('../../utils/parseCricketStats');

const CLUB_ID = process.env.SPORTYGO_CLUB_ID || '4263';
const TIMEOUT_MS = 20_000;
const DISPLAY_NAME = 'YPL';
const SOURCE_NAME  = 'sportygo-ypl';

const TEAM_URLS = {
  '211': `https://cricclubs.com/sportygo/teamBatting.do?teamId=211&clubId=${CLUB_ID}`,
  '120': `https://cricclubs.com/sportygo/teamBatting.do?teamId=120&clubId=${CLUB_ID}`,
};

function debug(...args) {
  if (process.env.DEBUG_SCRAPER === 'true') console.log('[YPLBattingAdapter]', ...args);
}

// Normalise a column header to a compact lowercase key for matching.
// Examples: "N/O" → "no"  |  "H.S." → "hs"  |  "Balls Faced" → "ballsfaced"
function normHeader(text) {
  return (text || '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Maps normalised header → our field name
const HEADER_MAP = {
  player:        'playerName',
  playername:    'playerName',
  name:          'playerName',
  mat:           'matches',
  matches:       'matches',
  inn:           'innings',
  inns:          'innings',
  innings:       'innings',
  no:            'notOuts',
  notout:        'notOuts',
  notouts:       'notOuts',
  runs:          'runs',
  hs:            'highestScore',
  highest:       'highestScore',
  highestscore:  'highestScore',
  hs1:           'highestScore',
  ave:           'average',
  avg:           'average',
  average:       'average',
  bf:            'ballsFaced',
  balls:         'ballsFaced',
  ballsfaced:    'ballsFaced',
  sr:            'strikeRate',
  strikerate:    'strikeRate',
  '100':         'hundreds',
  '100s':        'hundreds',
  hundreds:      'hundreds',
  '50':          'fifties',
  '50s':         'fifties',
  fifties:       'fifties',
  '4s':          'fours',
  fours:         'fours',
  '6s':          'sixes',
  sixes:         'sixes',
  '0s':          'ducks',
  ducks:         'ducks',
  duck:          'ducks',
};

/**
 * Detect if a set of normalised headers describes a batting table.
 * Requires 'runs' plus at least one innings-type header.
 */
function isBattingTable(headers) {
  const hasRuns = headers.includes('runs');
  const hasInnings = headers.some((h) => ['inn', 'inns', 'innings'].includes(h));
  return hasRuns && hasInnings;
}

/**
 * Parse the YPL teamBatting HTML for a single team.
 *
 * @param {string} html      Raw HTML from the teamBatting.do page
 * @param {string} teamId
 * @param {string} clubId
 * @param {string} sourceUrl
 * @returns {object[]}  Array of player batting records
 */
function parseBattingHtml(html, teamId, clubId, sourceUrl) {
  const $  = cheerio.load(html);
  const players = [];

  $('table').each((_i, table) => {
    if (players.length > 0) return; // already found the batting table

    const $table = $(table);

    // Try thead first; fall back to first row
    let headerCells = $table.find('thead tr th, thead tr td');
    if (headerCells.length === 0) {
      headerCells = $table.find('tr').first().find('th, td');
    }
    if (headerCells.length === 0) return;

    const headers = headerCells.toArray().map((th) => normHeader($(th).text()));
    debug('Table headers:', headers);

    if (!isBattingTable(headers)) return;

    // Build column-index → field-name map
    const colMap = {};
    headers.forEach((h, idx) => {
      const field = HEADER_MAP[h];
      if (field && !(field in colMap)) colMap[idx] = field;
    });

    debug('Column map:', colMap);

    // Parse data rows (CricClubs uses <th> inside <tbody> — handle both th and td)
    $table.find('tbody tr').each((_r, tr) => {
      const cells = $(tr).find('td, th').toArray();
      if (cells.length < 4) return;

      const raw = {};
      Object.entries(colMap).forEach(([idx, field]) => {
        const cell = cells[Number(idx)];
        if (!cell) return;

        if (field === 'playerName') {
          // Prefer link text; strip trailing (ID) if present
          const link = $(cell).find('a').first();
          const text = link.length ? link.text() : $(cell).text();
          raw[field] = text.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
                           .replace(/\s*\(\d+\)\s*$/, '').trim();
        } else {
          raw[field] = $(cell).text().replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
        }
      });

      if (!raw.playerName || raw.playerName === '-') return;

      const hsData = parseHighestScore(raw.highestScore);

      players.push({
        sourceName:          SOURCE_NAME,
        sourceUrl,
        clubId,
        teamId,
        year:                new Date().getFullYear().toString(),
        playerName:          raw.playerName,
        matches:             parseNumber(raw.matches),
        innings:             parseNumber(raw.innings),
        notOuts:             parseNumber(raw.notOuts),
        runs:                parseNumber(raw.runs),
        highestScore:        hsData.display,
        highestScoreNumeric: hsData.numeric,
        average:             parseNumber(raw.average),
        ballsFaced:          parseNumber(raw.ballsFaced),
        strikeRate:          parseNumber(raw.strikeRate),
        hundreds:            parseNumber(raw.hundreds),
        fifties:             parseNumber(raw.fifties),
        fours:               parseNumber(raw.fours),
        sixes:               parseNumber(raw.sixes),
        ducks:               parseNumber(raw.ducks),
      });
    });
  });

  return players;
}

/**
 * Fetch and parse YPL batting stats for a given teamId.
 *
 * Returns a result object. If the host is blocked (403 / "Host not in allowlist"),
 * sets `blocked: true` and returns an empty players array — never throws.
 *
 * @param {string} teamId  '211' or '120'
 * @returns {Promise<{
 *   players: object[],
 *   blocked: boolean,
 *   blockedMessage: string|null,
 *   error: string|null,
 *   sourceUrl: string,
 *   teamId: string,
 *   clubId: string,
 * }>}
 */
async function fetchTeamBatting(teamId) {
  const sourceUrl = TEAM_URLS[teamId];
  if (!sourceUrl) {
    return {
      players: [], blocked: false,
      error: `Unknown teamId: ${teamId}. Supported: ${Object.keys(TEAM_URLS).join(', ')}`,
      blockedMessage: null, sourceUrl: '', teamId, clubId: CLUB_ID,
    };
  }

  debug(`Fetching YPL Team ${teamId} batting stats →`, sourceUrl);

  let res;
  try {
    res = await axios.get(sourceUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
      },
      timeout:        TIMEOUT_MS,
      maxRedirects:   5,
      validateStatus: () => true,
    });
  } catch (err) {
    return {
      players: [], blocked: false,
      error: `Network error: ${err.message}`,
      blockedMessage: null, sourceUrl, teamId, clubId: CLUB_ID,
    };
  }

  debug(`Response status: ${res.status} | size: ${res.data?.length} bytes`);

  // Detect block responses: 403, or body contains known block messages
  const bodyText = typeof res.data === 'string' ? res.data.toLowerCase() : '';
  const isBlocked =
    res.status === 403 ||
    res.status === 429 ||
    bodyText.includes('host not in allowlist') ||
    bodyText.includes('access denied') ||
    bodyText.includes('cloudflare') ||
    bodyText.includes('blocked');

  if (isBlocked) {
    const msg = `This YPL statistics page could not be accessed from the server. ` +
      `Please use manual copy-paste import or upload a static JSON file.`;
    console.warn(`[YPLBattingAdapter] Blocked (HTTP ${res.status}) for teamId=${teamId}`);
    return {
      players: [], blocked: true,
      blockedMessage: msg,
      error: null, sourceUrl, teamId, clubId: CLUB_ID,
    };
  }

  const players = parseBattingHtml(res.data, teamId, CLUB_ID, sourceUrl);
  debug(`Parsed ${players.length} player(s) for team ${teamId}`);

  return {
    players, blocked: false,
    blockedMessage: null,
    error: players.length === 0 ? 'No batting data found in page — table may have moved.' : null,
    sourceUrl, teamId, clubId: CLUB_ID,
  };
}

module.exports = {
  fetchTeamBatting,
  parseBattingHtml,
  TEAM_URLS,
  SOURCE_NAME,
  DISPLAY_NAME,
  CLUB_ID,
};
