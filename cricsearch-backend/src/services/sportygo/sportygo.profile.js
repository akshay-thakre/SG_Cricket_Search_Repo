/**
 * @module sportygo.profile
 * @description Fetches and parses Sportygo player profile pages.
 * Profile HTML structure is identical to SCA — reuses the shared parser.
 */

const axios = require('axios');
const { parsePlayerProfile } = require('../sca/sca.profile');

const BASE_URL = 'https://scores.cricclubs.com/sportygo';
const TIMEOUT_MS = 15000;

const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Fetch and parse a Sportygo player's profile page.
 *
 * @param {string} playerId - Numeric player ID
 * @param {string} clubId   - Numeric club ID (extracted from search result profileUrl)
 * @returns {Promise<object>}
 */
async function fetchSportygoPlayerStats(playerId, clubId) {
  const profileUrl = `${BASE_URL}/viewPlayer.do?playerId=${playerId}&clubId=${clubId}`;
  const searchPageUrl = `${BASE_URL}/searchPlayer.do?clubId=${clubId}`;

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

  // ── Attempt 2: session-based GET (use main page for reliable JSESSIONID) ──
  const getRes = await axios.get(`${BASE_URL}/`, {
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
      if (m) { jsessionId = m[1]; break; }
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

module.exports = { fetchSportygoPlayerStats };
