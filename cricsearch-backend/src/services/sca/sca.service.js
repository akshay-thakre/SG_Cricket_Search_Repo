/**
 * @module sca.service
 * @description Orchestration service for SCA player search.
 * Combines the HTTP client (session + POST) with the HTML parser
 * to produce a normalized response envelope.
 */

const { createSCAClient } = require('./sca.client');
const { parsePlayerResults } = require('./sca.parser');
const selectors = require('./sca.selectors');

/**
 * Search for players on the SCA platform.
 *
 * @param {object} params - Search parameters
 * @param {string} [params.firstName]
 * @param {string} [params.lastName]
 * @param {string} [params.teamName]
 * @param {string} [params.playerCCId]
 * @param {string} [params.emailId]
 * @param {string} [params.gender]
 * @param {string} [params.internalClub]
 * @param {string} [params.battingStyle]
 * @param {string} [params.bowlingStyle]
 * @param {string} [params.playerStatus]
 * @returns {Promise<{
 *   source: string,
 *   query: object,
 *   totalResults: number,
 *   players: Array<object>,
 *   meta: {
 *     method: string,
 *     upstreamUrl: string,
 *     responseStatus: number,
 *     blocked: boolean,
 *     empty: boolean,
 *     message: string|null,
 *     scrapedAt: string
 *   }
 * }>}
 */
async function searchPlayers(params = {}) {
  const client = createSCAClient();

  // ── Execute the search against the live site ────────────────────
  const { html, status } = await client.search(params);

  // ── Parse the HTML response ─────────────────────────────────────
  const result = parsePlayerResults(html);

  // ── Build the normalized response ───────────────────────────────
  let message = null;
  if (result.empty) {
    message = 'No players found matching the search criteria.';
  } else {
    message = `Found ${result.totalResults} player(s).`;
  }

  return {
    source: 'sca',
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
