/**
 * @module sportygo.parser
 * @description Wraps the shared SCA HTML parser for Sportygo search results.
 * The CricClubs HTML structure is identical between SCA and Sportygo; the only
 * difference is the origin domain in the profile links.
 */

const { parsePlayerResults: scaParse } = require('../sca/sca.parser');

const SCA_ORIGIN = 'https://scores.cricketsingapore.com';
const SPORTYGO_ORIGIN = 'https://scores.cricclubs.com';

/**
 * Parse Sportygo search result HTML.
 * Delegates to the SCA parser then fixes the profileUrl origin and extracts clubId.
 *
 * @param {string} html
 * @returns {{ players: Array<object>, totalResults: number, empty: boolean }}
 */
function parsePlayerResults(html) {
  const result = scaParse(html);

  return {
    ...result,
    players: result.players.map((p) => {
      const profileUrl = p.profileUrl
        ? p.profileUrl.replace(SCA_ORIGIN, SPORTYGO_ORIGIN)
        : p.profileUrl;

      const clubIdMatch = profileUrl ? profileUrl.match(/clubId=(\d+)/) : null;
      const clubId = clubIdMatch ? clubIdMatch[1] : (process.env.SPORTYGO_CLUB_ID || null);

      return { ...p, profileUrl, clubId };
    }),
  };
}

module.exports = { parsePlayerResults };
