/**
 * @module sportygo.profile
 * @description Playwright-based profile scraper for Sportygo player pages.
 *
 * Required user flow (per CricClubs/Sportygo UI):
 *   1. Navigate to viewPlayer.do?playerId=…&clubId=4263
 *   2. Click "BATTING STATISTICS" tab
 *   3. For each series-type row (T20, ODI …):
 *        a. Click the "+" expand button
 *        b. Year dropdown appears → select "All" (first option)
 *        c. Batting stats for that series render → capture
 *   4. Click "Bowling STATISTICS" tab → same expansion flow
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

// ── Expand-button selector — covers common CricClubs "+" patterns ──────────
const EXPAND_BTN_SEL = [
  'table tbody tr td:last-child button',
  'table tbody tr th:last-child button',
  'table tbody tr td:last-child a',
  'table tbody tr td [class*="expand"]',
  'table tbody tr td [class*="toggle"]',
  'table tbody tr td [class*="plus"]',
  'table tbody tr td [onclick]',
  'table tbody tr td [data-toggle]',
].join(', ');

/**
 * For each series-type row with a "+" button:
 *   1. Click the expand button
 *   2. Find the year <select> that appears
 *   3. Choose "All" (or first option)
 *   4. Wait for stats to render
 *   5. Scrape the stats table
 *
 * Falls back to direct table reading if no expand buttons exist.
 *
 * @param {import('playwright').Page} page
 * @param {'batting'|'bowling'} statType
 * @returns {Promise<object[]>}
 */
async function extractStatsWithExpansion(page, statType) {
  const extractFn = statType === 'batting' ? extractBattingStats : extractBowlingStats;

  // ── Attempt 1: direct read (works if CricClubs pre-renders stats) ──────────
  const directStats = await page.evaluate(extractFn);
  const directHasData = directStats.some((r) => r.mat !== null || r.runs !== null || r.wkts !== null);
  if (directHasData) {
    debug(`[${statType}] Direct read yielded ${directStats.length} row(s)`);
    return directStats;
  }

  // ── Attempt 2: "+" expansion + year dropdown ───────────────────────────────
  const btns = await page.locator(EXPAND_BTN_SEL).all();
  debug(`[${statType}] Direct read empty — found ${btns.length} expand button(s)`);

  if (btns.length === 0) return directStats; // no expand buttons, return whatever we have

  const resultsMap = new Map(); // seriesType → row

  for (const btn of btns) {
    let seriesType = 'Unknown';

    try {
      // Identify which series type this row represents
      seriesType = await btn.evaluate((el) => {
        const row = el.closest('tr');
        if (!row) return 'Unknown';
        const cell = row.querySelector('td:first-child, th:first-child');
        return cell ? cell.textContent.replace(/\s+/g, ' ').trim() : 'Unknown';
      }).catch(() => 'Unknown');

      // Skip rows whose first cell isn't a short format name (e.g. T20, ODI, T10)
      if (!seriesType || seriesType.length > 30 || seriesType === '-') continue;

      debug(`[${statType}] Clicking expand on: "${seriesType}"`);
      await btn.click({ force: true, timeout: selectors.SELECTOR_TIMEOUT });
      await page.waitForTimeout(600);

      // ── Year dropdown ────────────────────────────────────────────────
      let yearLabel = 'All';
      const yearSel = page.locator('select').first();

      if ((await yearSel.count()) > 0) {
        const opts = await yearSel.evaluate((el) =>
          Array.from(el.options).map((o, i) => ({
            i,
            v: o.value,
            t: o.text.replace(/\s+/g, ' ').trim(),
          }))
        ).catch(() => []);

        debug(`[${statType}] Year options for "${seriesType}":`, opts.map((o) => o.t));

        if (opts.length > 0) {
          // Prefer "All", otherwise take the first option
          const target = opts.find((o) => /^all$/i.test(o.t) || o.v === '0' || o.v === '') || opts[0];
          yearLabel = target.t;

          // Trigger change via JS so CricClubs AJAX fires correctly
          await yearSel.evaluate((el, val) => {
            el.value = val;
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }, target.v).catch(() => {});

          await page.waitForTimeout(selectors.ACTION_DELAY);
        }
      }

      // ── Extract stats rendered after expansion ───────────────────────
      const stats = await page.evaluate(extractFn);
      debug(`[${statType}] Stats after expanding "${seriesType}": ${stats.length} row(s)`);

      if (stats.length > 1) {
        // Global year dropdown applied to all formats at once — capture all
        stats.forEach((row) => {
          if (row.seriesType && !resultsMap.has(row.seriesType)) {
            resultsMap.set(row.seriesType, { ...row, year: yearLabel });
          }
        });
      } else if (stats.length === 1) {
        if (!resultsMap.has(seriesType)) {
          resultsMap.set(seriesType, { ...stats[0], seriesType, year: yearLabel });
        }
      }

      // All formats captured — stop early
      if (resultsMap.size >= btns.length) break;

    } catch (e) {
      debug(`[${statType}] Error expanding "${seriesType}":`, e.message);
    }
  }

  if (resultsMap.size > 0) {
    debug(`[${statType}] Expansion yielded ${resultsMap.size} row(s)`);
    return Array.from(resultsMap.values());
  }

  // ── Attempt 3: final fallback — re-read tables after all expansions ────────
  debug(`[${statType}] Expansion map empty, doing final table read`);
  return page.evaluate(extractFn);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch and parse a Sportygo player's profile page with Playwright.
 *
 * @param {string} playerId
 * @param {string} [clubId] - defaults to selectors.CLUB_ID (4263)
 * @returns {Promise<object>}
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

    // ── Player info ────────────────────────────────────────────────────
    const playerInfo = await page.evaluate(extractPlayerInfo);
    debug('Player info:', JSON.stringify(playerInfo));

    // ── Batting stats: tab → expand rows → select "All" year ──────────
    let rawBatting = [];
    try {
      const battingTab = page.locator(selectors.BATTING_BTN).first();
      if ((await battingTab.count()) > 0) {
        await battingTab.click({ timeout: selectors.SELECTOR_TIMEOUT });
        await page.waitForTimeout(selectors.ACTION_DELAY);
        debug('Clicked BATTING STATISTICS tab');
      }
      rawBatting = await extractStatsWithExpansion(page, 'batting');
      debug('Final batting rows:', rawBatting.length);
    } catch (e) {
      debug('Batting error:', e.message);
    }

    // ── Bowling stats: tab → expand rows → select "All" year ──────────
    let rawBowling = [];
    try {
      const bowlingTab = page.locator(selectors.BOWLING_BTN).first();
      if ((await bowlingTab.count()) > 0) {
        await bowlingTab.click({ timeout: selectors.SELECTOR_TIMEOUT });
        await page.waitForTimeout(selectors.ACTION_DELAY);
        debug('Clicked Bowling STATISTICS tab');
      }
      rawBowling = await extractStatsWithExpansion(page, 'bowling');
      debug('Final bowling rows:', rawBowling.length);
    } catch (e) {
      debug('Bowling error:', e.message);
    }

    // ── Normalize ──────────────────────────────────────────────────────
    const batting = rawBatting.map(normalizeBattingRow);
    const bowling = rawBowling.map(normalizeBowlingRow);

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
