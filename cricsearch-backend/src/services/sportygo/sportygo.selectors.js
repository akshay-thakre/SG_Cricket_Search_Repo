/**
 * @module sportygo.selectors
 * @description CSS selectors and URL configuration for scraping the
 * Sportygo site on CricClubs (https://cricclubs.com/sportygo).
 * HTML structure is identical to SCA — both are CricClubs tenants.
 */

module.exports = {
  SEARCH_FORM: '#searchPlayer',

  RESULTS_TABLE: '#playersData',
  RESULTS_THEAD: '#playersData thead',
  RESULTS_TBODY: '#playersData tbody',
  RESULTS_ROW: '#playersData tbody tr',

  // CricClubs uses <th> not <td> in tbody rows
  ROW_CELLS: 'th',

  PLAYER_LINK: 'a[href*="viewPlayer.do"]',

  VERIFIED_ICON: 'img[alt="Verified"]',
  NOT_VERIFIED_ICON: 'img[alt="Not Verified"]',

  TEAM_NESTED_TABLE: 'table td',
  TEAM_LOGO: 'img.img-responsive.img-circle',

  NO_RESULTS: '#noSearchPlayer',
  SEARCH_ERROR: '#searchError',

  PLAYER_ID_REGEX: /playerId=(\d+)/,
  CLUB_ID_REGEX: /clubId=(\d+)/,

  BASE_URL: 'https://cricclubs.com/sportygo',
  SEARCH_PATH: '/searchPlayer.do',
  VIEW_PLAYER_PATH: '/viewPlayer.do',
};
