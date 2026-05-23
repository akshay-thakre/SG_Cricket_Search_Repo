/**
 * @module sca.parser
 * @description Parses raw HTML from the SCA player search results page
 * using cheerio. Handles the non-standard table structure where <tbody>
 * rows use <th> tags instead of <td>.
 */

const cheerio = require('cheerio');
const selectors = require('./sca.selectors');

/**
 * Clean a text string — trim whitespace and collapse internal spaces.
 * @param {string} text
 * @returns {string}
 */
function clean(text) {
  return (text || '')
    .replace(/\u00a0/g, ' ') // &nbsp;
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract the player name from the raw link text.
 * Raw format: " Kintul Mistry (1077340) "
 * We strip the trailing "(ID)" portion and trim.
 *
 * @param {string} rawText
 * @returns {string}
 */
function extractPlayerName(rawText) {
  const cleaned = clean(rawText);
  // Remove trailing (digits) — the CC ID embedded in the name text
  return cleaned.replace(/\s*\(\d+\)\s*$/, '').trim();
}

/**
 * Parse the SCA search results HTML and extract player data.
 *
 * @param {string} html - Raw HTML response from the SCA search POST
 * @returns {{
 *   players: Array<{
 *     id: string,
 *     name: string,
 *     profileUrl: string,
 *     playerRole: string,
 *     teamName: string,
 *     verified: boolean,
 *     raw: { number: string, nameCell: string, role: string, team: string }
 *   }>,
 *   totalResults: number,
 *   empty: boolean
 * }}
 */
function parsePlayerResults(html) {
  const $ = cheerio.load(html);

  // ── Check if the results table exists ───────────────────────────
  const table = $(selectors.RESULTS_TABLE);
  if (table.length === 0) {
    return { players: [], totalResults: 0, empty: true };
  }

  const players = [];

  // ── Iterate over each row in the tbody ──────────────────────────
  $(selectors.RESULTS_ROW).each((_rowIdx, row) => {
    const $row = $(row);
    const cells = $row.find(selectors.ROW_CELLS); // <th> elements

    if (cells.length < 4) return; // skip malformed rows

    // Cell 0 — Row number
    const rowNumber = clean($(cells[0]).text());

    // Cell 1 — Player name, profile link, verification status
    const nameCell = $(cells[1]);
    const nameCellText = clean(nameCell.text());

    const link = nameCell.find(selectors.PLAYER_LINK);
    const href = link.attr('href') || '';
    const rawLinkText = link.text();

    // Extract player ID from the href
    const idMatch = href.match(selectors.PLAYER_ID_REGEX);
    const playerId = idMatch ? idMatch[1] : '';

    // Build full profile URL
    // The href already includes the path prefix (e.g. /SingaporeCricketAssoc/viewPlayer.do...)
    // so we only need the origin (scheme + host) to avoid duplication.
    const origin = selectors.BASE_URL.replace(/\/[^/]+\/?$/, ''); // https://scores.cricketsingapore.com
    const profileUrl = href
      ? `${origin}${href.startsWith('/') ? '' : '/'}${href}`
      : '';

    // Extract clean player name (without the CC ID in parens)
    const playerName = extractPlayerName(rawLinkText);

    // Verification status
    const hasVerified = nameCell.find(selectors.VERIFIED_ICON).length > 0;
    const hasNotVerified = nameCell.find(selectors.NOT_VERIFIED_ICON).length > 0;
    const verified = hasVerified && !hasNotVerified;

    // Cell 2 — Player role
    const playerRole = clean($(cells[2]).text());

    // Cell 3 — Team name (inside a nested table)
    const teamCell = $(cells[3]);
    let teamName = '';

    const nestedTds = teamCell.find(selectors.TEAM_NESTED_TABLE);
    if (nestedTds.length > 0) {
      // The last <td> in the nested table holds the team name text
      teamName = clean($(nestedTds[nestedTds.length - 1]).text());
    } else {
      // Fallback: just grab the cell text
      teamName = clean(teamCell.text());
    }

    players.push({
      id: playerId,
      name: playerName,
      profileUrl,
      playerRole,
      teamName,
      verified,
      raw: {
        number: rowNumber,
        nameCell: nameCellText,
        role: playerRole,
        team: teamName,
      },
    });
  });

  return {
    players,
    totalResults: players.length,
    empty: players.length === 0,
  };
}

module.exports = { parsePlayerResults };
