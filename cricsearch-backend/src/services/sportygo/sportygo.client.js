/**
 * @module sportygo.client
 * @description HTTP client for Sportygo on CricClubs (https://cricclubs.com/sportygo).
 * Uses CLUB_ID=4263 (Sportygo's org ID on CricClubs) so the session URL resolves
 * to a real page that sets JSESSIONID — same two-step flow as the SCA client.
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

function extractJSessionId(setCookieHeaders) {
  if (!setCookieHeaders) return null;
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const h of headers) {
    const m = h.match(/JSESSIONID=([^;]+)/);
    if (m) return m[1];
  }
  return null;
}

function buildPostBody(params = {}) {
  const clubId = selectors.CLUB_ID;
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

function createSportygoClient() {
  async function search(params) {
    const clubId = selectors.CLUB_ID;
    const searchPageUrl = `${selectors.BASE_URL}${selectors.SEARCH_PATH}?clubId=${clubId}`;
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          debug(`Retry attempt ${attempt}/${MAX_RETRIES}`);
          await sleep(RETRY_DELAY_MS);
        }

        // Step 1: GET search page with valid clubId to obtain JSESSIONID
        debug('GET (session)', searchPageUrl);
        const getRes = await axios.get(searchPageUrl, {
          headers: { ...COMMON_HEADERS },
          timeout: TIMEOUT_MS,
          maxRedirects: 5,
          validateStatus: () => true,
        });

        let jsessionId = extractJSessionId(getRes.headers['set-cookie']);
        debug('JSESSIONID:', jsessionId ? `${jsessionId.slice(0, 8)}…` : 'none');

        // Step 2: POST search form with session cookie
        const postBody = buildPostBody(params);
        debug('POST', searchPageUrl, '| body length:', postBody.length);

        const postRes = await axios.post(searchPageUrl, postBody, {
          headers: {
            ...COMMON_HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(jsessionId ? { Cookie: `JSESSIONID=${jsessionId}` } : {}),
            Referer: searchPageUrl,
          },
          timeout: TIMEOUT_MS,
          maxRedirects: 5,
          validateStatus: () => true,
        });

        debug('Response status:', postRes.status, '| size:', postRes.data?.length);
        return { html: postRes.data, status: postRes.status };

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
