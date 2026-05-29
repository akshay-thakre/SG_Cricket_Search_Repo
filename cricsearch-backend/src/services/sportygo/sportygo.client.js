/**
 * @module sportygo.client
 * @description Axios HTTP client for Sportygo (cricclubs.com/sportygo).
 * Two-step flow: GET the search page to acquire a JSESSIONID, then POST
 * the search form — same pattern as the working SCA client.
 */

'use strict';

const axios   = require('axios');
const selectors = require('./sportygo.selectors');

const TIMEOUT_MS = 20_000;

const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function debug(...args) {
  if (process.env.DEBUG_SCRAPER === 'true') console.log('[Sportygo:client]', ...args);
}

function extractCookies(setCookieHeaders) {
  if (!setCookieHeaders) return '';
  const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  return arr.map((c) => c.split(';')[0]).join('; ');
}

function buildSearchBody(params = {}) {
  const fields = [
    ['firstName',    params.firstName    || ''],
    ['lastName',     params.lastName     || ''],
    ['teamName',     ''],
    ['playerCCId',   ''],
    ['emailId',      ''],
    ['gender',       ''],
    ['internalClub', ''],
    ['battingStyle', ''],
    ['bowlingStyle', ''],
    ['playerStatus', ''],
    ['clubId',       selectors.CLUB_ID],
  ];
  return fields.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

/**
 * GET the search page to obtain a session cookie.
 * @returns {{ cookieStr: string, status: number }}
 */
async function getSession() {
  const url = selectors.searchUrl(selectors.CLUB_ID);
  debug('GET session →', url);
  const res = await axios.get(url, {
    headers:       COMMON_HEADERS,
    timeout:       TIMEOUT_MS,
    maxRedirects:  5,
    validateStatus: () => true,
  });
  const cookieStr = extractCookies(res.headers['set-cookie']);
  debug('Session cookie:', cookieStr ? `${cookieStr.slice(0, 30)}…` : '(none)');
  return { cookieStr, status: res.status };
}

/**
 * POST the search form and return the results-page HTML.
 * @param {object} params  e.g. { firstName: 'Akshay Thakre' }
 * @param {string} cookieStr  JSESSIONID cookie from getSession()
 */
async function search(params, cookieStr) {
  const url  = selectors.searchUrl(selectors.CLUB_ID);
  const body = buildSearchBody(params);
  debug('POST search →', url, '| firstName:', params.firstName);
  const res = await axios.post(url, body, {
    headers: {
      ...COMMON_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(cookieStr ? { Cookie: cookieStr } : {}),
      Referer: url,
    },
    timeout:        TIMEOUT_MS,
    maxRedirects:   5,
    validateStatus: () => true,
  });
  debug('POST response:', res.status, '|', res.data?.length, 'bytes');
  return { html: res.data, status: res.status };
}

/**
 * GET a player profile page.
 * @param {string} playerId
 * @param {string} clubId
 * @param {string} cookieStr  session cookie (optional but improves success rate)
 */
async function fetchProfile(playerId, clubId, cookieStr) {
  const profileUrl = selectors.profileUrl(playerId, clubId);
  const searchUrl  = selectors.searchUrl(clubId);
  debug('GET profile →', profileUrl);
  const res = await axios.get(profileUrl, {
    headers: {
      ...COMMON_HEADERS,
      ...(cookieStr ? { Cookie: cookieStr } : {}),
      Referer: searchUrl,
    },
    timeout:        TIMEOUT_MS,
    maxRedirects:   5,
    validateStatus: () => true,
  });
  debug('Profile response:', res.status, '|', res.data?.length, 'bytes');
  return { html: res.data, status: res.status };
}

module.exports = { getSession, search, fetchProfile };
