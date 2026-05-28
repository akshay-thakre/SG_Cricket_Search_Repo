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

/** Follow redirects manually, accumulating Set-Cookie from every hop. */
async function acquireSessionCookies(startUrl) {
  let url = startUrl;
  const cookies = {};

  for (let hop = 0; hop < 6; hop++) {
    let res;
    try {
      res = await axios.get(url, {
        headers: {
          ...COMMON_HEADERS,
          ...(Object.keys(cookies).length
            ? { Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') }
            : {}),
        },
        timeout: TIMEOUT_MS,
        maxRedirects: 0,
        validateStatus: () => true,
      });
    } catch (_) { break; }

    const arr = res.headers['set-cookie']
      ? (Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [res.headers['set-cookie']])
      : [];
    arr.forEach((c) => {
      const kv = c.split(';')[0];
      const eqIdx = kv.indexOf('=');
      if (eqIdx > 0) cookies[kv.slice(0, eqIdx).trim()] = kv.slice(eqIdx + 1).trim();
    });

    if (cookies['JSESSIONID']) break;

    if ((res.status === 301 || res.status === 302 || res.status === 303) && res.headers['location']) {
      const loc = res.headers['location'];
      url = loc.startsWith('http') ? loc : `https://cricclubs.com${loc}`;
    } else {
      break;
    }
  }

  return cookies['JSESSIONID'] || null;
}

/**
 * Fetch and parse a Sportygo player's profile page.
 * @param {string} playerId
 * @param {string} clubId
 */
async function fetchSportygoPlayerStats(playerId, clubId) {
  const profileUrl = `${BASE_URL}/viewPlayer.do?playerId=${playerId}&clubId=${clubId}`;
  const sessionUrl = `${BASE_URL}/searchPlayer.do`;

  // ── Attempt 1: direct GET (no session needed for public profiles) ──
  try {
    const res = await axios.get(profileUrl, {
      headers: COMMON_HEADERS,
      timeout: TIMEOUT_MS,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    if (
      res.status === 200 &&
      typeof res.data === 'string' &&
      res.data.length > 2000 &&
      !res.data.includes('loginForm') &&
      !res.data.includes('login.do')
    ) {
      const parsed = parsePlayerProfile(res.data, playerId);
      if (parsed.batting || parsed.bowling || parsed.playerName) return parsed;
    }
  } catch (_) {}

  // ── Attempt 2: session-based GET via manual redirect chain ──────
  const jsessionId = await acquireSessionCookies(sessionUrl);

  const profileRes = await axios.get(profileUrl, {
    headers: {
      ...COMMON_HEADERS,
      ...(jsessionId ? { Cookie: `JSESSIONID=${jsessionId}` } : {}),
      Referer: `${BASE_URL}/searchPlayer.do?clubId=${clubId}`,
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
