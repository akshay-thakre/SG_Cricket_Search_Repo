/**
 * @module sportygo.profile
 * @description Playwright-based profile scraper for Sportygo player pages.
 * Navigates to the player profile, clicks the BATTING/Bowling tab buttons,
 * and extracts structured stats from the tables.
 */

const { withPage } = require('./sportygo.client');
const { extractPlayerInfo, extractBattingStats, extractBowlingStats } = require('./sportygo.parser');
const selectors = require('./sportygo.selectors');

function debug(...args) {
  if (process.env.DEBUG_SCRAPER === 'true') console.log('[Sportygo:profile]', ...args);
}

function toInt(v) {
  if (v == null || v === '' || v === '-' || v === 'N/A') return null;
  const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? null : n;
}

function toFloat(v) {
  if (v == null || v === '' || v === '-' || v === 'N/A') return null;
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

function normalizeBattingRow(r) {
  return {
    seriesType: r.seriesType || 'Unknown',
    year:       r.year       || 'All',
    mat:   toInt(r.mat),
    inns:  toInt(r.inns),
    no:    toInt(r.no),
    runs:  toInt(r.runs),
    balls: toInt(r.balls),
    ave:   toFloat(r.ave),
    sr:    toFloat(r.sr),
    hs:    r.hs   || null,
    '100s': toInt(r['100s']),
    '50s':  toInt(r['50s']),
    '25s':  toInt(r['25s']),
    '0s':   toInt(r['0s']),
    '4s':   toInt(r['4s']),
    '6s':   toInt(r['6s']),
  };
}

function normalizeBowlingRow(r) {
  return {
    seriesType: r.seriesType || 'Unknown',
    year:       r.year       || 'All',
    mat:   toInt(r.mat),
    overs: r.overs || null,
    mdns:  toInt(r.mdns),
    runs:  toInt(r.runs),
    wkts:  toInt(r.wkts),
    ave:   toFloat(r.ave),
    eco:   toFloat(r.eco),
    sr:    toFloat(r.sr),
    bbi:   r.bbi || null,
  };
}

/**
 * Fetch and parse a Sportygo player's profile page with Playwright.
 *
 * @param {string} playerId
 * @param {string} [clubId] - defaults to selectors.CLUB_ID (4263)
 * @returns {Promise<object>} Structured player stats in the Sportygo output contract format
 */
async function fetchSportygoPlayerStats(playerId, clubId) {
  const resolvedClubId = clubId || selectors.CLUB_ID;
  const profileUrl = selectors.profileUrl(playerId, resolvedClubId);

  debug('Fetching profile:', profileUrl);

  return withPage(async (page) => {
    page.setDefaultTimeout(selectors.NAV_TIMEOUT);

    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: selectors.NAV_TIMEOUT });
    debug('Profile page loaded');

    // Wait for meaningful content
    await page
      .waitForSelector('h3, h2, .player-name, table', { timeout: selectors.SELECTOR_TIMEOUT })
      .catch(() => {});

    // ── Player info ─────────────────────────────────────────────────
    const playerInfo = await page.evaluate(extractPlayerInfo);
    debug('Player info:', JSON.stringify(playerInfo));

    // ── Batting stats ───────────────────────────────────────────────
    let rawBatting = [];
    try {
      // Click the BATTING STATISTICS tab if present
      const battingTab = page.locator(selectors.BATTING_BTN).first();
      if (await battingTab.count() > 0) {
        await battingTab.click({ timeout: selectors.SELECTOR_TIMEOUT });
        await page.waitForTimeout(selectors.ACTION_DELAY);
        debug('Clicked BATTING STATISTICS tab');
      }
      rawBatting = await page.evaluate(extractBattingStats);
      debug('Raw batting rows:', rawBatting.length);
    } catch (e) {
      debug('Batting extraction error:', e.message);
    }

    // ── Bowling stats ───────────────────────────────────────────────
    let rawBowling = [];
    try {
      const bowlingTab = page.locator(selectors.BOWLING_BTN).first();
      if (await bowlingTab.count() > 0) {
        await bowlingTab.click({ timeout: selectors.SELECTOR_TIMEOUT });
        await page.waitForTimeout(selectors.ACTION_DELAY);
        debug('Clicked Bowling STATISTICS tab');
      }
      rawBowling = await page.evaluate(extractBowlingStats);
      debug('Raw bowling rows:', rawBowling.length);
    } catch (e) {
      debug('Bowling extraction error:', e.message);
    }

    // ── Normalize ───────────────────────────────────────────────────
    const batting  = rawBatting.map(normalizeBattingRow);
    const bowling  = rawBowling.map(normalizeBowlingRow);

    // Totals — aggregate across all series types
    const totalMatches =
      batting.length > 0
        ? Math.max(...batting.map((r) => r.mat || 0))
        : bowling.length > 0
        ? Math.max(...bowling.map((r) => r.mat || 0))
        : null;

    const totalRuns    = batting.reduce((s, r) => s + (r.runs || 0), 0) || null;
    const totalWickets = bowling.reduce((s, r) => s + (r.wkts || 0), 0) || null;

    const isEmpty = batting.length === 0 && bowling.length === 0 && !playerInfo.name;

    return {
      source: 'sportygo',
      player: {
        id: playerId,
        name: playerInfo.name,
        teamName: playerInfo.teamName,
        playerRole: playerInfo.playerRole,
        battingStyle: playerInfo.battingStyle,
        bowlingStyle: playerInfo.bowlingStyle,
        totals: {
          matches: totalMatches,
          runs: totalRuns,
          wickets: totalWickets,
        },
      },
      batting,
      bowling,
      meta: {
        upstreamUrl: profileUrl,
        scrapedAt: new Date().toISOString(),
        blocked: false,
        empty: isEmpty,
        message: isEmpty ? 'No statistics found for this player.' : null,
      },
    };
  });
}

module.exports = { fetchSportygoPlayerStats };
