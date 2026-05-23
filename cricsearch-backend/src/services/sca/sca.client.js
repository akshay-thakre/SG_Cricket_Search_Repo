/**
 * @module sca.client
 * @description HTTP client with cookie-jar support for the Singapore Cricket
 * Association (SCA) website. Handles session acquisition (JSESSIONID) and
 * form POST submission.
 */

const axios = require('axios');
const selectors = require('./sca.selectors');

/** @type {number} Request timeout in milliseconds */
const TIMEOUT_MS = 15000;

/** @type {number} Maximum number of retry attempts */
const MAX_RETRIES = 2;

/** @type {number} Delay between retries in milliseconds */
const RETRY_DELAY_MS = 1000;

/**
 * Log a debug message when DEBUG_SCRAPER is enabled.
 * @param  {...any} args - Values to log
 */
function debug(...args) {
  if (process.env.DEBUG_SCRAPER === 'true') {
    console.log('[SCA:client]', ...args);
  }
}

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Common HTTP headers sent with every request.
 * @type {object}
 */
const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Extract the JSESSIONID value from a set-cookie header array.
 * @param {string[]} setCookieHeaders
 * @returns {string|null}
 */
function extractJSessionId(setCookieHeaders) {
  if (!setCookieHeaders) return null;

  const headers = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : [setCookieHeaders];

  for (const header of headers) {
    const match = header.match(/JSESSIONID=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Build the URL-encoded POST body from search parameters.
 * Ensures every expected form field is present (empty string if unset).
 *
 * @param {object} params - Search parameters
 * @returns {string} URL-encoded form body
 */
function buildPostBody(params = {}) {
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
    clubId: selectors.CLUB_ID,
  };

  return Object.entries(fields)
    .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
    .join('&');
}

/**
 * Create an SCA HTTP client.
 *
 * @returns {{ search: (params: object) => Promise<{ html: string, status: number }> }}
 */
function createSCAClient() {
  const searchPageUrl = `${selectors.BASE_URL}${selectors.SEARCH_PATH}?clubId=${selectors.CLUB_ID}`;

  /**
   * Execute a search against the SCA player search form.
   *
   * 1. GET the search page to acquire a JSESSIONID cookie.
   * 2. POST the form data with the session cookie.
   * 3. Return the raw HTML and HTTP status.
   *
   * @param {object} params - Search parameters
   * @returns {Promise<{ html: string, status: number }>}
   */
  async function search(params) {
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          debug(`Retry attempt ${attempt}/${MAX_RETRIES}`);
          await sleep(RETRY_DELAY_MS);
        }

        // ── Step 1: GET the search page to obtain JSESSIONID ──────
        debug('GET', searchPageUrl);
        const getRes = await axios.get(searchPageUrl, {
          headers: { ...COMMON_HEADERS },
          timeout: TIMEOUT_MS,
          maxRedirects: 5,
          validateStatus: () => true, // accept any status
        });

        const jsessionId = extractJSessionId(getRes.headers['set-cookie']);
        debug('JSESSIONID:', jsessionId ? `${jsessionId.slice(0, 8)}…` : 'none');

        if (!jsessionId) {
          throw new Error('Failed to obtain JSESSIONID from SCA search page');
        }

        // ── Step 2: POST the search form ──────────────────────────
        const postBody = buildPostBody(params);
        debug('POST', searchPageUrl, '| body length:', postBody.length);

        const postRes = await axios.post(searchPageUrl, postBody, {
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

        debug('Response status:', postRes.status, '| size:', postRes.data?.length);

        return {
          html: postRes.data,
          status: postRes.status,
        };
      } catch (err) {
        lastError = err;
        debug('Request error:', err.message);
      }
    }

    throw new Error(
      `SCA search failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`
    );
  }

  return { search };
}

module.exports = { createSCAClient };
