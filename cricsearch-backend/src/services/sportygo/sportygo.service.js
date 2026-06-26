/**
 * @module sportygo.service
 * @description Axios+cheerio search orchestration for Sportygo (cricclubs.com/sportygo).
 * Two-step: GET session cookie, then POST search form.
 */

'use strict';

const { getSession, search } = require('./sportygo.client');
const { parseSearchResults } = require('./sportygo.parser');
const selectors = require('./sportygo.selectors');

function debug(...args) {
  if (process.env.DEBUG_SCRAPER === 'true') console.log('[Sportygo:search]', ...args);
}

/**
 * Search for players on Sportygo.
 * @param {object} params  e.g. { firstName: 'Akshay Thakre' }
 * @returns {Promise<object>}
 */
async function searchPlayers(params = {}) {
  const searchUrl = selectors.searchUrl(selectors.CLUB_ID);
  debug('Searching:', searchUrl, '| params:', JSON.stringify(params));

  const { cookieStr } = await getSession();
  const { html, status } = await search(params, cookieStr);

  debug('Search response status:', status, '| html length:', html?.length);

  const { players, totalResults, empty } = parseSearchResults(html);
  debug('Players found:', totalResults);

  return {
    source: 'sportygo',
    query: params,
    totalResults,
    players,
    meta: {
      method: 'axios-cheerio',
      blocked: status === 403 || status === 429,
      empty,
      message: empty
        ? 'No players found matching the search criteria.'
        : `Found ${totalResults} player(s).`,
      scrapedAt: new Date().toISOString(),
    },
  };
}

module.exports = { searchPlayers };
