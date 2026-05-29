/**
 * @module sportygo.service
 * @description Playwright-based search orchestration for Sportygo (cricclubs.com/sportygo).
 * Automates the search form, waits for results, and extracts player data from the DOM.
 */

const { withPage } = require('./sportygo.client');
const { extractSearchResults } = require('./sportygo.parser');
const selectors = require('./sportygo.selectors');

function debug(...args) {
  if (process.env.DEBUG_SCRAPER === 'true') console.log('[Sportygo:search]', ...args);
}

/**
 * Search for players on Sportygo using Playwright.
 * @param {object} params - Search parameters. `firstName` is the main field.
 * @returns {Promise<object>}
 */
async function searchPlayers(params = {}) {
  const clubId = selectors.CLUB_ID;
  const searchUrl = selectors.searchUrl(clubId);

  debug('Searching at:', searchUrl, '| params:', JSON.stringify(params));

  return withPage(async (page) => {
    page.setDefaultTimeout(selectors.NAV_TIMEOUT);

    // Navigate to the Sportygo search page
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: selectors.NAV_TIMEOUT });
    debug('Search page loaded');

    // Wait for the firstName input field
    await page.waitForSelector(selectors.FIRSTNAME_INPUT, { timeout: selectors.SELECTOR_TIMEOUT });
    await page.fill(selectors.FIRSTNAME_INPUT, params.firstName || '');
    debug('Filled firstName:', params.firstName);

    // Submit the form; CricClubs does a full-page POST, so we wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: selectors.NAV_TIMEOUT }).catch(() => {}),
      page.click(selectors.SEARCH_SUBMIT),
    ]);
    debug('Form submitted');

    // Wait for the results table or the "no results" placeholder
    await page
      .waitForSelector(`${selectors.RESULTS_TABLE}, ${selectors.NO_RESULTS}`, {
        timeout: selectors.SELECTOR_TIMEOUT,
      })
      .catch(() => {});
    debug('Results ready');

    // Extract player rows using the browser-side parser
    const players = await page.evaluate(extractSearchResults);
    debug('Players found:', players.length);

    return {
      source: 'sportygo',
      query: params,
      totalResults: players.length,
      players,
      meta: {
        method: 'playwright',
        upstreamUrl: searchUrl,
        blocked: false,
        empty: players.length === 0,
        message:
          players.length === 0
            ? 'No players found matching the search criteria.'
            : `Found ${players.length} player(s).`,
        scrapedAt: new Date().toISOString(),
      },
    };
  });
}

module.exports = { searchPlayers };
