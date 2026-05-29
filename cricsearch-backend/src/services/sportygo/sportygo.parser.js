/**
 * @module sportygo.parser
 * @description Browser-side DOM extraction functions for Sportygo pages.
 * Each export is a plain (no-closure) function safe to pass to page.evaluate().
 */

// ── Search results ────────────────────────────────────────────────────────────

/**
 * Extract player list from #playersData search results table.
 * Runs entirely in browser context — no external references.
 */
function extractSearchResults() {
  function cleanText(t) {
    return (t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  }

  var rows = document.querySelectorAll('#playersData tbody tr');
  var results = [];

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var cells = row.querySelectorAll('th, td');
    if (cells.length < 4) continue;

    var nameCell = cells[1];
    var link = nameCell.querySelector('a[href*="viewPlayer.do"]');
    if (!link) continue;

    var href = link.getAttribute('href') || '';
    var idMatch = href.match(/playerId=(\d+)/);
    if (!idMatch) continue;
    var playerId = idMatch[1];

    var clubMatch = href.match(/clubId=(\d+)/);
    var clubId = clubMatch ? clubMatch[1] : '';

    var profileUrl = href.startsWith('http')
      ? href
      : 'https://cricclubs.com' + (href.startsWith('/') ? '' : '/') + href;

    var rawName = cleanText(link.textContent);
    var playerName = rawName.replace(/\s*\(\d+\)\s*$/, '').trim();

    var playerRole = cleanText((cells[2] ? cells[2].textContent : ''));

    var teamCell = cells[3];
    var nestedTds = teamCell ? teamCell.querySelectorAll('td') : [];
    var teamName = nestedTds.length > 0
      ? cleanText(nestedTds[nestedTds.length - 1].textContent)
      : cleanText(teamCell ? teamCell.textContent : '');

    results.push({
      id: playerId,
      name: playerName,
      profileUrl: profileUrl,
      playerRole: playerRole,
      teamName: teamName,
      clubId: clubId,
      verified: false,
      source: 'sportygo',
    });
  }

  return results;
}

// ── Profile — player info ─────────────────────────────────────────────────────

/**
 * Extract player name, team, role, batting/bowling style from a profile page.
 * Runs entirely in browser context — no external references.
 */
function extractPlayerInfo() {
  function clean(t) { return (t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }

  var info = {
    name: null,
    teamName: null,
    playerRole: null,
    battingStyle: null,
    bowlingStyle: null,
  };

  // Player name — try headings first, skip nav / utility text
  var nameSelectors = ['h3', 'h2', '.player-name', '.playername'];
  for (var i = 0; i < nameSelectors.length; i++) {
    var el = document.querySelector(nameSelectors[i]);
    if (el) {
      var t = clean(el.textContent);
      if (t && t.length > 1 && t.length < 80 && !/search|login|register|nav|menu/i.test(t)) {
        info.name = t;
        break;
      }
    }
  }

  // Team name
  var teamSelectors = ['h4', '.team-name', '.club-name'];
  for (var j = 0; j < teamSelectors.length; j++) {
    var tel = document.querySelector(teamSelectors[j]);
    if (tel) {
      var tt = clean(tel.textContent);
      if (tt && tt.length > 1 && tt.length < 80) {
        info.teamName = tt;
        break;
      }
    }
  }

  // Scan all page text for role / style labels
  var allText = document.body ? document.body.innerText : '';

  var roleMatch = allText.match(/(?:player\s*role|role)\s*[:\-]?\s*([^\n\r,]{2,50})/i);
  if (roleMatch) info.playerRole = clean(roleMatch[1]);

  var batMatch = allText.match(/batting\s+style\s*[:\-]?\s*([^\n\r,]{2,60})/i);
  if (batMatch) info.battingStyle = clean(batMatch[1]);

  var bowlMatch = allText.match(/bowling\s+style\s*[:\-]?\s*([^\n\r,]{2,60})/i);
  if (bowlMatch) info.bowlingStyle = clean(bowlMatch[1]);

  return info;
}

// ── Profile — stats tables ────────────────────────────────────────────────────

/**
 * Extract batting stats from visible tables on the profile page.
 * Detects batting table by looking for 'inns'/'hs' headers alongside 'runs'.
 * Runs entirely in browser context — no external references.
 */
function extractBattingStats() {
  function clean(t) { return (t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
  function normH(h) {
    return clean(h).toLowerCase()
      .replace(/['''’\s]+/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  var results = [];
  var tables = document.querySelectorAll('table');

  for (var i = 0; i < tables.length; i++) {
    var table = tables[i];
    var headerCells = table.querySelectorAll('thead tr th, thead tr td');
    if (headerCells.length === 0) {
      var firstRow = table.querySelector('tr');
      if (firstRow) headerCells = firstRow.querySelectorAll('th, td');
    }
    if (headerCells.length === 0) continue;

    var headers = Array.from(headerCells).map(function(th) { return normH(th.textContent); });

    var hasBatting = (headers.indexOf('inns') >= 0 || headers.indexOf('inn') >= 0 || headers.indexOf('hs') >= 0)
                  && headers.indexOf('runs') >= 0;
    if (!hasBatting) continue;

    var bodyRows = table.querySelectorAll('tbody tr');
    if (bodyRows.length === 0) continue;

    bodyRows.forEach(function(row) {
      var cells = row.querySelectorAll('td, th');
      if (cells.length < 5) return;

      var raw = {};
      headers.forEach(function(h, idx) {
        if (cells[idx]) raw[h] = clean(cells[idx].textContent);
      });

      var seriesType = clean(cells[0].textContent);
      if (!seriesType || seriesType === '-') return;

      results.push({
        seriesType: seriesType,
        year: 'All',
        mat:   raw['mat']   || raw['m']             || null,
        inns:  raw['inns']  || raw['inn']            || null,
        no:    raw['no']                             || null,
        runs:  raw['runs']                           || null,
        balls: raw['balls'] || raw['b']              || null,
        ave:   raw['ave']   || raw['avg']  || raw['average'] || null,
        sr:    raw['sr']    || raw['strikerate']     || null,
        hs:    raw['hs']    || raw['highest']        || null,
        '100s': raw['100s'] || raw['100']            || null,
        '50s':  raw['50s']  || raw['50']             || null,
        '25s':  raw['25s']  || raw['25']             || null,
        '0s':   raw['0s']   || raw['0']              || null,
        '4s':   raw['4s']   || raw['4']              || null,
        '6s':   raw['6s']   || raw['6']              || null,
      });
    });

    if (results.length > 0) break;
  }

  return results;
}

/**
 * Extract bowling stats from visible tables on the profile page.
 * Detects bowling table by looking for 'wkts'/'eco'/'bbi' headers.
 * Runs entirely in browser context — no external references.
 */
function extractBowlingStats() {
  function clean(t) { return (t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
  function normH(h) {
    return clean(h).toLowerCase()
      .replace(/['''’\s]+/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  var results = [];
  var tables = document.querySelectorAll('table');

  for (var i = 0; i < tables.length; i++) {
    var table = tables[i];
    var headerCells = table.querySelectorAll('thead tr th, thead tr td');
    if (headerCells.length === 0) {
      var firstRow = table.querySelector('tr');
      if (firstRow) headerCells = firstRow.querySelectorAll('th, td');
    }
    if (headerCells.length === 0) continue;

    var headers = Array.from(headerCells).map(function(th) { return normH(th.textContent); });

    var hasBowling = headers.some(function(h) {
      return ['wkt', 'wkts', 'wickets', 'wic', 'w'].indexOf(h) >= 0;
    }) || headers.some(function(h) {
      return ['eco', 'economy', 'econ'].indexOf(h) >= 0;
    }) || headers.some(function(h) {
      return ['bbi', 'bbm', 'best'].indexOf(h) >= 0;
    });
    if (!hasBowling) continue;

    // Exclude tables that are actually batting tables mistakenly matched
    var hasBattingOnly = headers.indexOf('inns') >= 0 || headers.indexOf('hs') >= 0;
    if (hasBattingOnly) continue;

    var bodyRows = table.querySelectorAll('tbody tr');
    if (bodyRows.length === 0) continue;

    bodyRows.forEach(function(row) {
      var cells = row.querySelectorAll('td, th');
      if (cells.length < 5) return;

      var raw = {};
      headers.forEach(function(h, idx) {
        if (cells[idx]) raw[h] = clean(cells[idx].textContent);
      });

      var seriesType = clean(cells[0].textContent);
      if (!seriesType || seriesType === '-') return;

      results.push({
        seriesType: seriesType,
        year: 'All',
        mat:  raw['mat']  || raw['m']                       || null,
        overs: raw['overs'] || raw['o'] || raw['ov']        || null,
        mdns:  raw['mdns'] || raw['maiden'] || raw['maidens'] || raw['md'] || null,
        runs:  raw['runs'] || raw['r']                      || null,
        wkts:  raw['wkts'] || raw['wkt'] || raw['wickets'] || raw['w'] || raw['wic'] || null,
        ave:   raw['ave']  || raw['avg'] || raw['average']  || null,
        eco:   raw['eco']  || raw['economy'] || raw['econ'] || raw['er'] || null,
        sr:    raw['sr']   || raw['strikerate']             || null,
        bbi:   raw['bbi']  || raw['best'] || raw['bbm']     || null,
      });
    });

    if (results.length > 0) break;
  }

  return results;
}

module.exports = {
  extractSearchResults,
  extractPlayerInfo,
  extractBattingStats,
  extractBowlingStats,
};
