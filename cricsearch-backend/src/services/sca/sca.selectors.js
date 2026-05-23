/**
 * @module sca.selectors
 * @description CSS selectors and URL configuration for scraping the
 * Singapore Cricket Association (SCA) website.
 *
 * These selectors were reverse-engineered from the live site at
 * https://scores.cricketsingapore.com/SingaporeCricketAssoc/searchPlayer.do
 *
 * IMPORTANT: The results table uses <th> tags inside <tbody> rows,
 * NOT the standard <td> tags.
 */

module.exports = {
  // ── Search form ──────────────────────────────────────────────────
  SEARCH_FORM: '#searchPlayer',

  // ── Results table ────────────────────────────────────────────────
  RESULTS_TABLE: '#playersData',
  RESULTS_THEAD: '#playersData thead',
  RESULTS_TBODY: '#playersData tbody',
  RESULTS_ROW: '#playersData tbody tr',

  // Row cells — SCA uses <th> not <td> in tbody rows
  ROW_CELLS: 'th',

  // ── Player name cell (2nd column) ────────────────────────────────
  PLAYER_LINK: 'a[href*="viewPlayer.do"]',

  // ── Verification icons ───────────────────────────────────────────
  VERIFIED_ICON: 'img[alt="Verified"]',
  NOT_VERIFIED_ICON: 'img[alt="Not Verified"]',

  // ── Team cell contains a nested table ────────────────────────────
  TEAM_NESTED_TABLE: 'table td',
  TEAM_LOGO: 'img.img-responsive.img-circle',

  // ── Empty / error states ─────────────────────────────────────────
  NO_RESULTS: '#noSearchPlayer',
  SEARCH_ERROR: '#searchError',

  // ── URL patterns (regex) ─────────────────────────────────────────
  PLAYER_ID_REGEX: /playerId=(\d+)/,
  CLUB_ID_REGEX: /clubId=(\d+)/,

  // ── Base configuration ───────────────────────────────────────────
  BASE_URL: 'https://scores.cricketsingapore.com/SingaporeCricketAssoc',
  CLUB_ID: '7683',
  SEARCH_PATH: '/searchPlayer.do',
  VIEW_PLAYER_PATH: '/viewPlayer.do',
};
