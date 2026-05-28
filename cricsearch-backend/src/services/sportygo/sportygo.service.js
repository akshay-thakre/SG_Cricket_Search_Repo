/**
 * @module sportygo.service
 * @description Orchestration service for Sportygo player search.
 */

const { createSportygoClient } = require('./sportygo.client');
const { parsePlayerResults } = require('./sportygo.parser');
const selectors = require('./sportygo.selectors');

/**
 * Search for players on the Sportygo platform.
 * @param {object} params - Search parameters (firstName, lastName, etc.)
 */
async function searchPlayers(params = {}) {
  const client = createSportygoClient();
  const { html, status } = await client.search(params);
  const result = parsePlayerResults(html);

  const message = result.empty
    ? 'No players found matching the search criteria.'
    : `Found ${result.totalResults} player(s).`;

  return {
    source: 'sportygo',
    query: params,
    totalResults: result.totalResults,
    players: result.players,
    meta: {
      method: 'cheerio',
      upstreamUrl: `${selectors.BASE_URL}${selectors.SEARCH_PATH}`,
      responseStatus: status,
      blocked: false,
      empty: result.empty,
      message,
      scrapedAt: new Date().toISOString(),
    },
  };
}

module.exports = { searchPlayers };
