/**
 * @module sportygo.parser
 * @description Cheerio-based HTML parsers for Sportygo search results and player profiles.
 */

'use strict';

const cheerio = require('cheerio');
const selectors = require('./sportygo.selectors');

const CRICCLUBS_ORIGIN = 'https://cricclubs.com';

function clean(text) {
  return (text || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

function normHeader(h) {
  return clean(h).toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

// ── Search results ────────────────────────────────────────────────────────────

/**
 * Parse Sportygo search results HTML into a player list.
 * @param {string} html
 * @returns {{ players: object[], totalResults: number, empty: boolean }}
 */
function parseSearchResults(html) {
  const $ = cheerio.load(html);

  if ($(selectors.RESULTS_TABLE).length === 0) {
    return { players: [], totalResults: 0, empty: true };
  }

  const players = [];

  $(selectors.RESULTS_ROW).each((_i, row) => {
    const $row = $(row);
    const cells = $row.find(selectors.ROW_CELL);
    if (cells.length < 4) return;

    const nameCell = $(cells[1]);
    const link = nameCell.find(selectors.PLAYER_LINK);
    const href = link.attr('href') || '';

    const idMatch = href.match(/playerId=(\d+)/);
    if (!idMatch) return;
    const playerId = idMatch[1];

    const clubMatch = href.match(/clubId=(\d+)/);
    const clubId = clubMatch ? clubMatch[1] : selectors.CLUB_ID;

    const profileUrl = href.startsWith('http')
      ? href
      : `${CRICCLUBS_ORIGIN}${href.startsWith('/') ? '' : '/'}${href}`;

    const playerName = clean(link.text()).replace(/\s*\(\d+\)\s*$/, '').trim();
    const playerRole = clean($(cells[2]).text());

    const teamCell = $(cells[3]);
    const nestedTds = teamCell.find('td');
    const teamName = nestedTds.length > 0
      ? clean(nestedTds.last().text())
      : clean(teamCell.text());

    players.push({
      id: playerId,
      name: playerName,
      profileUrl,
      playerRole,
      teamName,
      clubId,
      verified: false,
      source: 'sportygo',
    });
  });

  return { players, totalResults: players.length, empty: players.length === 0 };
}

// ── Profile — player info ─────────────────────────────────────────────────────

function parsePlayerInfo($) {
  const info = { name: null, teamName: null, playerRole: null, battingStyle: null, bowlingStyle: null };

  for (const sel of ['h3', 'h2', '.player-name', '.playername']) {
    const el = $(sel).first();
    if (el.length) {
      const t = clean(el.text());
      if (t && t.length > 1 && t.length < 80 && !/search|login|register|nav|menu/i.test(t)) {
        info.name = t;
        break;
      }
    }
  }

  for (const sel of ['h4', '.team-name', '.club-name']) {
    const el = $(sel).first();
    if (el.length) {
      const t = clean(el.text());
      if (t && t.length > 1 && t.length < 80) {
        info.teamName = t;
        break;
      }
    }
  }

  const bodyText = $('body').text();

  const roleMatch = bodyText.match(/(?:player\s*role|role)\s*[:\-]?\s*([^\n\r,]{2,50})/i);
  if (roleMatch) info.playerRole = clean(roleMatch[1]);

  const batMatch = bodyText.match(/batting\s+style\s*[:\-]?\s*([^\n\r,]{2,60})/i);
  if (batMatch) info.battingStyle = clean(batMatch[1]);

  const bowlMatch = bodyText.match(/bowling\s+style\s*[:\-]?\s*([^\n\r,]{2,60})/i);
  if (bowlMatch) info.bowlingStyle = clean(bowlMatch[1]);

  return info;
}

// ── Profile — stats tables ────────────────────────────────────────────────────

function parseStatsTable($, table, isBatting) {
  const $table = $(table);
  let headerCells = $table.find('thead tr th, thead tr td');
  if (headerCells.length === 0) {
    headerCells = $table.find('tr').first().find('th, td');
  }
  if (headerCells.length === 0) return null;

  const headers = headerCells.toArray().map((th) => normHeader($(th).text()));

  if (isBatting) {
    const hasBatting = (headers.includes('inns') || headers.includes('inn') || headers.includes('hs'))
      && headers.includes('runs');
    if (!hasBatting) return null;
  } else {
    const hasBowling = ['wkt', 'wkts', 'wickets', 'w'].some((h) => headers.includes(h))
      || ['eco', 'economy', 'econ'].some((h) => headers.includes(h))
      || ['bbi', 'bbm', 'best'].some((h) => headers.includes(h));
    if (!hasBowling) return null;
    // Exclude tables that are actually batting tables
    if (headers.includes('inns') || headers.includes('hs')) return null;
  }

  const rows = [];
  $table.find('tbody tr').each((_i, tr) => {
    const cells = $(tr).find('td, th').toArray();
    if (cells.length < 5) return;

    const raw = {};
    headers.forEach((h, idx) => {
      if (cells[idx]) raw[h] = clean($(cells[idx]).text());
    });

    const seriesType = clean($(cells[0]).text());
    if (!seriesType || seriesType === '-') return;

    if (isBatting) {
      rows.push({
        seriesType,
        year: 'All',
        mat:    raw['mat']   || raw['m']                            || null,
        inns:   raw['inns']  || raw['inn']                          || null,
        no:     raw['no']                                           || null,
        runs:   raw['runs']                                         || null,
        balls:  raw['balls'] || raw['b']                            || null,
        ave:    raw['ave']   || raw['avg']  || raw['average']       || null,
        sr:     raw['sr']    || raw['strikerate']                   || null,
        hs:     raw['hs']    || raw['highest']                      || null,
        '100s': raw['100s']  || raw['100']                          || null,
        '50s':  raw['50s']   || raw['50']                           || null,
        '25s':  raw['25s']   || raw['25']                           || null,
        '0s':   raw['0s']    || raw['0']                            || null,
        '4s':   raw['4s']    || raw['4']                            || null,
        '6s':   raw['6s']    || raw['6']                            || null,
      });
    } else {
      rows.push({
        seriesType,
        year: 'All',
        mat:   raw['mat']   || raw['m']                                       || null,
        overs: raw['overs'] || raw['o']    || raw['ov']                       || null,
        mdns:  raw['mdns']  || raw['maiden'] || raw['maidens'] || raw['md']   || null,
        runs:  raw['runs']  || raw['r']                                       || null,
        wkts:  raw['wkts']  || raw['wkt']  || raw['wickets'] || raw['w'] || raw['wic'] || null,
        ave:   raw['ave']   || raw['avg']  || raw['average']                  || null,
        eco:   raw['eco']   || raw['economy'] || raw['econ']  || raw['er']    || null,
        sr:    raw['sr']    || raw['strikerate']                               || null,
        bbi:   raw['bbi']   || raw['best'] || raw['bbm']                      || null,
      });
    }
  });

  return rows.length > 0 ? rows : null;
}

/**
 * Parse a Sportygo profile page HTML into structured stats.
 * CricClubs pre-renders all data in the initial HTML — no JS execution needed.
 *
 * @param {string} html
 * @param {string} playerId
 * @param {string} clubId
 * @returns {object}
 */
function parseProfileHtml(html, playerId, clubId) {
  const $ = cheerio.load(html);
  const profileUrl = selectors.profileUrl(playerId, clubId);

  const playerInfo = parsePlayerInfo($);

  let batting = [];
  let bowling = [];

  $('table').each((_i, table) => {
    if (batting.length === 0) {
      const rows = parseStatsTable($, table, true);
      if (rows) batting = rows;
    }
    if (bowling.length === 0) {
      const rows = parseStatsTable($, table, false);
      if (rows) bowling = rows;
    }
  });

  return { playerInfo, batting, bowling, profileUrl };
}

module.exports = { parseSearchResults, parseProfileHtml };
