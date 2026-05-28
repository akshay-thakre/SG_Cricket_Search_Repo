/**
 * @module sportygo.profile
 * @description Fetches and parses Sportygo player profile pages.
 * Profile HTML structure is identical to SCA — reuses the shared parser.
 */

const axios = require('axios');
const { parsePlayerProfile } = require('../sca/sca.profile');

const BASE_URL = 'https://cricclubs.com/sportygo';
const TIMEOUT_MS = 15000;

const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function extractJSessionId(setCookieHeaders) {
  if (!setCookieHeaders) return null;
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const h of headers) {
    const m = h.match(/JSESSIONID=([^;]+)/);
    if (m) return m[1];
  }
  return null;
}

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

  // ── Attempt 2: session-based GET (maxRedirects:0 captures cookie from first response) ──
  const sessionUrl = `${BASE_URL}/searchPlayer.do`;
  const getRes = await axios.get(sessionUrl, {
    headers: COMMON_HEADERS,
    timeout: TIMEOUT_MS,
    maxRedirects: 0,
    validateStatus: () => true,
  });

  let jsessionId = extractJSessionId(getRes.headers['set-cookie']);

  if (!jsessionId && getRes.headers['location']) {
    const redirectUrl = getRes.headers['location'];
    const redirectRes = await axios.get(
      redirectUrl.startsWith('http') ? redirectUrl : `https://cricclubs.com${redirectUrl}`,
      { headers: COMMON_HEADERS, timeout: TIMEOUT_MS, maxRedirects: 0, validateStatus: () => true }
    );
    jsessionId = extractJSessionId(redirectRes.headers['set-cookie']);
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
