/**
 * @module sportygo.selectors
 * @description All CSS selectors and URL constants for Sportygo scraping.
 * Centralised here so selector drift doesn't require touching service logic.
 */

module.exports = {
  // ── Config ────────────────────────────────────────────────────────────────
  CLUB_ID: process.env.SPORTYGO_CLUB_ID || '4263',
  BASE_URL: 'https://cricclubs.com/sportygo',

  // ── URLs ──────────────────────────────────────────────────────────────────
  searchUrl(clubId) {
    return `https://cricclubs.com/sportygo/searchPlayer.do?clubId=${clubId}`;
  },
  profileUrl(playerId, clubId) {
    return `https://cricclubs.com/sportygo/viewPlayer.do?playerId=${playerId}&clubId=${clubId}`;
  },

  // ── Search form ───────────────────────────────────────────────────────────
  FIRSTNAME_INPUT: 'input[name="firstName"]',
  SEARCH_SUBMIT:   'input[type="submit"]',

  // ── Search results ────────────────────────────────────────────────────────
  // CricClubs uses <th> not <td> in tbody rows (same as SCA)
  RESULTS_TABLE:   '#playersData',
  RESULTS_ROW:     '#playersData tbody tr',
  ROW_CELL:        'th, td',
  PLAYER_LINK:     'a[href*="viewPlayer.do"]',
  NO_RESULTS:      '#noSearchPlayer',

  // ── Profile header ────────────────────────────────────────────────────────
  PLAYER_NAME:     'h3, h2.player-name, .player-name h3',
  TEAM_NAME:       'h4, .team-name',
  // Stat "badge" boxes on the profile hero (Matches / Runs / Wickets)
  STAT_BOX:        '.box-score, .stat-box, [class*="score-box"]',

  // ── Stats section ─────────────────────────────────────────────────────────
  // "BATTING STATISTICS" and "Bowling STATISTICS" tab buttons
  BATTING_BTN:     'text=BATTING STATISTICS',
  BOWLING_BTN:     'text=Bowling STATISTICS',

  // Expand "+" toggle button on a series row (e.g. T20 ⊙ → + )
  ROW_EXPAND_BTN:  'tbody tr td:last-child button, tbody tr th:last-child button, ' +
                   'tbody tr [class*="expand"], tbody tr [class*="toggle"]',

  // Year select dropdown that appears after expanding
  YEAR_SELECT:     'select',

  // ── Timeouts ──────────────────────────────────────────────────────────────
  NAV_TIMEOUT:      30_000,
  SELECTOR_TIMEOUT: 10_000,
  ACTION_DELAY:      1_000,   // ms to wait after clicks before reading DOM
};
