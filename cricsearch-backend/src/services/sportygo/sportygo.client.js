/**
 * @module sportygo.client
 * @description HTTP client with cookie-jar support for Sportygo on CricClubs.
 * SPORTYGO_CLUB_ID is read from the environment at call time so it can be set
 * via Render/Heroku environment variables without restarting the module cache.
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
  for (const header of headers) {
    const match = header.match(/JSESSIONID=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

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
    .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
    .join('&');
}

function createSportygoClient() {
  async function search(params) {
    const clubId = process.env.SPORTYGO_CLUB_ID || '';
    // Use the main page for session acquisition — the search URL with an empty
    // clubId redirects to an error page and never sets JSESSIONID.
    const sessionUrl = `${selectors.BASE_URL}/`;
    const searchPageUrl = clubId
      ? `${selectors.BASE_URL}${selectors.SEARCH_PATH}?clubId=${clubId}`
      : `${selectors.BASE_URL}${selectors.SEARCH_PATH}`;

    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          debug(`Retry attempt ${attempt}/${MAX_RETRIES}`);
          await sleep(RETRY_DELAY_MS);
        }

        // Step 1: GET main page to reliably obtain JSESSIONID
        debug('GET (session)', sessionUrl);
        const getRes = await axios.get(sessionUrl, {
          headers: { ...COMMON_HEADERS },
          timeout: TIMEOUT_MS,
          maxRedirects: 5,
          validateStatus: () => true,
        });

        const jsessionId = extractJSessionId(getRes.headers['set-cookie']);
        debug('JSESSIONID:', jsessionId ? `${jsessionId.slice(0, 8)}…` : 'none');

        if (!jsessionId) {
          throw new Error('Failed to obtain JSESSIONID from Sportygo');
        }

        const postBody = buildPostBody(params);
        debug('POST', searchPageUrl, '| body length:', postBody.length);

        const postRes = await axios.post(searchPageUrl, postBody, {
          headers: {
            ...COMMON_HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: `JSESSIONID=${jsessionId}`,
            Referer: sessionUrl,
          },
          timeout: TIMEOUT_MS,
          maxRedirects: 5,
          validateStatus: () => true,
        });

        debug('Response status:', postRes.status, '| size:', postRes.data?.length);

        return { html: postRes.data, status: postRes.status };
      } catch (err) {
        lastError = err;
        debug('Request error:', err.message);
      }
    }

    throw new Error(
      `Sportygo search failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`
    );
  }

  return { search };
}

module.exports = { createSportygoClient };
