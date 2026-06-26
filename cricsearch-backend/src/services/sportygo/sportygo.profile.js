/**
 * @module sportygo.profile
 * @description Axios+cheerio profile scraper for Sportygo player pages.
 *
 * CricClubs (Java/JSP) pre-renders all stats into the initial HTML.
 * The "+" expand button and year dropdown are client-side UI toggles only —
 * no data is fetched via AJAX. A single GET is sufficient to capture all stats.
 */

'use strict';

const { getSession, fetchProfile } = require('./sportygo.client');
const { parseProfileHtml } = require('./sportygo.parser');
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
 * Fetch and parse a Sportygo player's profile page.
 *
 * @param {string} playerId
 * @param {string} [clubId] - defaults to selectors.CLUB_ID (4263)
 * @returns {Promise<object>}
 */
async function fetchSportygoPlayerStats(playerId, clubId) {
  const resolvedClubId = clubId || selectors.CLUB_ID;
  const profileUrl = selectors.profileUrl(playerId, resolvedClubId);

  debug('Fetching profile:', profileUrl);

  const { cookieStr } = await getSession();
  const { html, status } = await fetchProfile(playerId, resolvedClubId, cookieStr);

  debug('Profile response status:', status, '| html length:', html?.length);

  const { playerInfo, batting: rawBatting, bowling: rawBowling } = parseProfileHtml(html, playerId, resolvedClubId);

  debug('Player info:', JSON.stringify(playerInfo));
  debug('Raw batting rows:', rawBatting.length, '| raw bowling rows:', rawBowling.length);

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
      scrapedAt: new Date().toISOString(),
      blocked: status === 403 || status === 429,
      empty: isEmpty,
      message: isEmpty ? 'No statistics found for this player.' : null,
    },
  };
}

module.exports = { fetchSportygoPlayerStats };
