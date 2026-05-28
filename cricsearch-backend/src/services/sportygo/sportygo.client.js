/**
 * @module sportygo.client
 * @description HTTP client for Sportygo on CricClubs (https://cricclubs.com/sportygo).
 * Strategy:
 *   1. Try a direct POST without any session (works if server is stateless for searches).
 *   2. If that yields no results, acquire a session via a manual redirect chain that
 *      accumulates Set-Cookie headers from every hop, then POST with the session.
 */

const axios = require('axios');
const selectors = require('./sportygo.selectors');

const TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

function debug(...args) {
  if (process.env.DEBUG_SCRAPER === 'true') {
    console.log('[Sportygo:client]', ...args);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function buildPostBody(params = {}) {
  const clubId = process.env.SPORTYGO_CLUB_ID || '';
  const fields = {
    firstName: params.firstName || '',
    lastName: params.lastName || '',
    teamName: params.teamName || '',
    playerCCId: params.playerCCId || '',
    emailId: params.emailId || '',
    gender: params.gender || '',
    internalClub: params.internalClub || '',
    battingStyle: params.battingStyle || '',
    bowlingStyle: params.bowlingStyle || '',
    playerStatus: params.playerStatus || '',
    clubId,
  };
  return Object.entries(fields)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/**
 * Follow redirects manually, collecting Set-Cookie from every hop.
 * Returns the accumulated cookie string (e.g. "JSESSIONID=abc123").
 */
async function acquireSessionCookies(startUrl) {
  let url = startUrl;
  const cookies = {};

  for (let hop = 0; hop < 6; hop++) {
    debug(`Session hop ${hop}: GET ${url}`);
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
    } catch (err) {
      debug(`Hop ${hop} error:`, err.message);
      break;
    }

    // Collect all Set-Cookie values from this hop
    const setCookieHeaders = res.headers['set-cookie'];
    if (setCookieHeaders) {
      const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
      arr.forEach((c) => {
        const kv = c.split(';')[0];
        const eqIdx = kv.indexOf('=');
        if (eqIdx > 0) {
          const k = kv.slice(0, eqIdx).trim();
          const v = kv.slice(eqIdx + 1).trim();
          cookies[k] = v;
        }
      });
    }

    debug(`Hop ${hop} status: ${res.status}, cookies so far:`, Object.keys(cookies));

    if (cookies['JSESSIONID']) break;

    // Follow redirect if present
    if ((res.status === 301 || res.status === 302 || res.status === 303) && res.headers['location']) {
      const loc = res.headers['location'];
      url = loc.startsWith('http') ? loc : `https://cricclubs.com${loc}`;
    } else {
      break; // No redirect, no more hops
    }
  }

  return cookies['JSESSIONID'] || null;
}

function createSportygoClient() {
  async function search(params) {
    const clubId = process.env.SPORTYGO_CLUB_ID || '';
    const searchPageUrl = clubId
      ? `${selectors.BASE_URL}${selectors.SEARCH_PATH}?clubId=${clubId}`
      : `${selectors.BASE_URL}${selectors.SEARCH_PATH}`;

    const postBody = buildPostBody(params);
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          debug(`Retry attempt ${attempt}/${MAX_RETRIES}`);
          await sleep(RETRY_DELAY_MS);
        }

        // ── Strategy A: direct POST without session ───────────────
        // Sportygo may not require CSRF/session for read-only searches.
        debug('Strategy A: direct POST to', searchPageUrl);
        const directRes = await axios.post(searchPageUrl, postBody, {
          headers: {
            ...COMMON_HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: searchPageUrl,
          },
          timeout: TIMEOUT_MS,
          maxRedirects: 5,
          validateStatus: () => true,
        });

        debug('Strategy A status:', directRes.status, '| size:', directRes.data?.length);

        // If we got a real HTML page back (not a login redirect), use it
        if (
          directRes.status === 200 &&
          typeof directRes.data === 'string' &&
          directRes.data.length > 500 &&
          !directRes.data.includes('loginForm') &&
          !directRes.data.includes('login.do')
        ) {
          return { html: directRes.data, status: directRes.status };
        }

        // ── Strategy B: acquire session via manual hop chain, then POST ──
        debug('Strategy B: acquiring session cookies from', searchPageUrl);
        const jsessionId = await acquireSessionCookies(searchPageUrl);
        debug('JSESSIONID:', jsessionId ? `${jsessionId.slice(0, 8)}…` : 'none');

        if (!jsessionId) {
          throw new Error('Failed to obtain JSESSIONID from Sportygo');
        }

        const sessionRes = await axios.post(searchPageUrl, postBody, {
          headers: {
            ...COMMON_HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: `JSESSIONID=${jsessionId}`,
            Referer: searchPageUrl,
          },
          timeout: TIMEOUT_MS,
          maxRedirects: 5,
          validateStatus: () => true,
        });

        debug('Strategy B status:', sessionRes.status, '| size:', sessionRes.data?.length);
        return { html: sessionRes.data, status: sessionRes.status };

      } catch (err) {
        lastError = err;
        debug('Attempt error:', err.message);
      }
    }

    throw new Error(
      `Sportygo search failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`
    );
  }

  return { search };
}

module.exports = { createSportygoClient };
