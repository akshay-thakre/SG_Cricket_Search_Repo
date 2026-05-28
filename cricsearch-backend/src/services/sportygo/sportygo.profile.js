/**
 * @module sportygo.profile
 * @description Fetches and parses Sportygo player profile pages.
 * Reuses parsePlayerProfile from sca.profile — same HTML structure.
 */

const axios = require('axios');
const { parsePlayerProfile } = require('../sca/sca.profile');
const selectors = require('./sportygo.selectors');

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
 * @param {string} playerId
 * @param {string} [clubId] - defaults to selectors.CLUB_ID (4263)
 */
async function fetchSportygoPlayerStats(playerId, clubId) {
  const resolvedClubId = clubId || selectors.CLUB_ID;
  const profileUrl = `${selectors.BASE_URL}/viewPlayer.do?playerId=${playerId}&clubId=${resolvedClubId}`;
  const searchPageUrl = `${selectors.BASE_URL}${selectors.SEARCH_PATH}?clubId=${resolvedClubId}`;

  // Attempt 1: direct GET (profiles are public on CricClubs)
  try {
    const res = await axios.get(profileUrl, {
      headers: COMMON_HEADERS,
      timeout: TIMEOUT_MS,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    if (res.status === 200 && typeof res.data === 'string' && res.data.length > 2000) {
      const parsed = parsePlayerProfile(res.data, playerId);
      if (parsed.batting || parsed.bowling || parsed.playerName) return parsed;
    }
  } catch (_) {}

  // Attempt 2: session-based GET
  const getRes = await axios.get(searchPageUrl, {
    headers: COMMON_HEADERS,
    timeout: TIMEOUT_MS,
    maxRedirects: 5,
    validateStatus: () => true,
  });

  const jsessionId = extractJSessionId(getRes.headers['set-cookie']);

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
