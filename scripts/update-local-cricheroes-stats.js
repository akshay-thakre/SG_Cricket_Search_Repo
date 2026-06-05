#!/usr/bin/env node
'use strict';

/**
 * Local Windows CricHeroes stats updater (visible browser).
 *
 * Downloads BAT + BOWL leaderboard XLS for each tournament,
 * parses them, backs up the existing JSON, and writes the update.
 * After success, commits and pushes the changed JSON files to GitHub.
 *
 * Each tournament is updated independently — a failure in one does NOT
 * prevent the others from running or being written.
 *
 * Usage (from the scripts/ directory):
 *   npm run update:local-cricheroes
 *
 * Exit codes:
 *   0 — at least one tournament succeeded (or no changes needed)
 *   1 — every tournament failed
 */

const { chromium } = require('playwright');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Shared utilities ──────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normKey(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normName(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '');
}

function safeInt(v, def = 0) {
  if (v === null || v === undefined || v === '' || v === '-') return def;
  const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
  return Number.isNaN(n) ? def : n;
}

function safeFloat(v, def = 0) {
  if (
    v === null || v === undefined || v === '' ||
    v === '-' || v === '∞' || v === 'Inf' || v === 'N/A'
  ) return def;
  const n = parseFloat(String(v));
  return Number.isNaN(n) ? def : Math.round(n * 100) / 100;
}

function safeFloatNullable(v) {
  if (
    v === null || v === undefined || v === '' ||
    v === '-' || v === '∞' || v === 'Inf' || v === 'N/A'
  ) return null;
  const n = parseFloat(String(v));
  return Number.isNaN(n) ? null : Math.round(n * 100) / 100;
}

function nowSGT() {
  const sgt = new Date(Date.now() + 8 * 3600_000);
  return sgt.toISOString().slice(0, 19) + '+08:00';
}

function parseOvers(v) {
  const s = String(v ?? '0').trim();
  const parts = s.split('.');
  const completeOvers = safeInt(parts[0]);
  const extraBalls    = parts.length > 1 ? safeInt(parts[1]) : 0;
  return { overs: completeOvers, balls: completeOvers * 6 + extraBalls };
}

// ── Shared Excel parsing ──────────────────────────────────────────────────────

function parseSheetToRows(filePath, colMap) {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rawRows.length < 2) {
    throw new Error(`Sheet in "${path.basename(filePath)}" has fewer than 2 rows.`);
  }

  let headerRowIdx = -1;
  let headerMap = {};

  for (let i = 0; i < Math.min(6, rawRows.length); i++) {
    const row = rawRows[i];
    const map = {};
    let hits = 0;
    for (let j = 0; j < row.length; j++) {
      const k = normKey(row[j]);
      if (colMap[k]) { map[String(j)] = colMap[k]; hits++; }
    }
    if (hits >= 3) { headerRowIdx = i; headerMap = map; break; }
  }

  if (headerRowIdx === -1) {
    const preview = (rawRows[0] || []).slice(0, 20).join(' | ');
    throw new Error(
      `Cannot identify header row in "${path.basename(filePath)}". ` +
      `First row: [${preview}]`
    );
  }

  log(`  Header at row ${headerRowIdx}: ` +
    Object.entries(headerMap).map(([i, f]) => `col${i}->${f}`).join(', '));

  const results = [];
  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const raw = rawRows[i];
    if (raw.every((v) => v === '' || v == null)) continue;
    const obj = {};
    for (const [idx, field] of Object.entries(headerMap)) {
      obj[field] = raw[parseInt(idx, 10)] ?? '';
    }
    if (!obj.name || String(obj.name).trim() === '') continue;
    results.push(obj);
  }
  return results;
}

// ── Shared Playwright download ────────────────────────────────────────────────

const TAB_ALIASES = {
  BAT:  ['BAT', 'Batting', 'Bat', 'BATTING', 'bat'],
  BOWL: ['BOWL', 'Bowling', 'Bowl', 'BOWLING', 'bowl'],
};

async function tryClick(page, strategies, timeoutMs = 3000) {
  for (const get of strategies) {
    try {
      const loc = get();
      await loc.waitFor({ state: 'visible', timeout: timeoutMs });
      await loc.click({ timeout: timeoutMs });
      return true;
    } catch { /* try next */ }
  }
  return false;
}

async function downloadTabXls(browser, url, tabLabel, savePath, debugDir) {
  log(`  [${tabLabel}] Opening ${url} ...`);
  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/130.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
    timezoneId: 'Asia/Singapore',
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
      .catch(() => log(`  [${tabLabel}] networkidle timed out – continuing with partial load`));

    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    if (/login|signin|captcha/i.test(currentUrl)) {
      throw new Error(`Auth redirect: ${currentUrl}`);
    }

    await page.screenshot({ path: path.join(debugDir, `debug-${tabLabel}-pageload.png`) });

    const loginVisible = await page.locator('text=/login|sign in/i').first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    if (loginVisible) {
      await page.screenshot({ path: path.join(debugDir, `error.png`) });
      throw new Error('Login prompt detected. Cannot proceed without authentication.');
    }

    const tabBarFound = await page.waitForSelector(
      'text=/^(BAT|BOWL|Batting|Bowling|BATTING|BOWLING|FIELD|MVP)$/i',
      { timeout: 30_000 }
    ).then(() => true).catch(() => false);

    if (!tabBarFound) {
      const diagUrl   = page.url();
      const diagTitle = await page.title().catch(() => '(error)');
      const diagBody  = await page.evaluate(() =>
        (document.body?.innerText ?? document.body?.textContent ?? '').trim().slice(0, 600)
      ).catch(() => '(error)');
      const diagLinks = await page.evaluate(() =>
        [...document.querySelectorAll('button,a,[role="tab"]')]
          .map((el) => (el.innerText || el.textContent || '').trim())
          .filter((t) => t)
          .slice(0, 20)
      ).catch(() => []);
      log(`  [${tabLabel}] Tab bar not found. Diagnostics:`);
      log(`  [${tabLabel}]   URL:    ${diagUrl}`);
      log(`  [${tabLabel}]   Title:  ${diagTitle}`);
      log(`  [${tabLabel}]   Body:   ${diagBody.replace(/\n/g, ' ')}`);
      log(`  [${tabLabel}]   Clickable elements: ${JSON.stringify(diagLinks)}`);
    }

    const aliases = TAB_ALIASES[tabLabel] || [tabLabel];
    log(`  [${tabLabel}] Clicking ${tabLabel} tab (aliases: ${aliases.join(', ')})...`);

    const strategies = [];
    for (const v of aliases) {
      strategies.push(
        () => page.getByRole('button', { name: new RegExp(`^${v}$`, 'i') }),
        () => page.getByRole('tab',   { name: new RegExp(`^${v}$`, 'i') }),
        () => page.locator(`[role="tab"]:has-text("${v}")`),
        () => page.locator(`button:has-text("${v}")`),
        () => page.getByText(new RegExp(`^${v}$`, 'i')).first(),
      );
    }

    let tabClicked = await tryClick(page, strategies, 3000);

    if (!tabClicked) {
      log(`  [${tabLabel}] Playwright selectors failed – trying JS DOM click...`);
      tabClicked = await page.evaluate((labels) => {
        const candidates = ['[role="tab"]', '[class*="tab"]', 'button', 'li', 'a', 'span'];
        for (const label of labels) {
          for (const sel of candidates) {
            for (const el of document.querySelectorAll(sel)) {
              const text = (el.innerText || el.textContent || '').trim();
              if (text.toLowerCase() === label.toLowerCase()) {
                el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                return true;
              }
            }
          }
        }
        return false;
      }, aliases);
      if (tabClicked) log(`  [${tabLabel}] JS DOM click succeeded.`);
    }

    if (!tabClicked) {
      await page.screenshot({ path: path.join(debugDir, 'error.png') });
      throw new Error(`Could not click "${tabLabel}" tab. Screenshot saved to ${debugDir}/error.png`);
    }

    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    log(`  [${tabLabel}] Downloading XLS...`);
    let download = null;
    const dlLocators = [
      () => page.getByRole('button', { name: /download xls/i }),
      () => page.locator('button:has-text("Download XLS")'),
      () => page.locator('a:has-text("Download XLS")'),
      () => page.locator('[class*="download"]:has-text("XLS")'),
      () => page.locator('text=Download XLS').first(),
      () => page.locator('[title*="Download"]').first(),
      () => page.locator('[aria-label*="download" i]').first(),
    ];
    for (const get of dlLocators) {
      try {
        const loc = get();
        if (!await loc.isVisible({ timeout: 5000 })) continue;
        const dlPromise = page.waitForEvent('download', { timeout: 90_000 });
        await loc.click({ timeout: 8000 });
        download = await dlPromise;
        break;
      } catch { /* try next */ }
    }

    if (!download) {
      await page.screenshot({ path: path.join(debugDir, 'error.png') });
      throw new Error(
        `Could not trigger XLS download for "${tabLabel}" tab. ` +
        `Screenshot saved to ${debugDir}/error.png`
      );
    }

    await download.saveAs(savePath);
    log(`  [${tabLabel}] Saved -> ${path.relative(process.cwd(), savePath)}`);
  } finally {
    await context.close();
  }
}

// ── SGIA -- column maps & builders ─────────────────────────────────────────────

const SGIA_BAT_COL_MAP = {
  rank: 'rank',        '#': 'rank',
  player: 'name',      name: 'name',       playername: 'name',
  team: 'team',
  bat: 'hand',         hand: 'hand',       battinghand: 'hand',
  bathand: 'hand',     batting: 'hand',
  mat: 'mat',          matches: 'mat',
  inn: 'inns',         inns: 'inns',       innings: 'inns',
  runs: 'runs',
  balls: 'balls',      ballsfaced: 'balls', bf: 'balls',
  hs: 'highest',       highestscore: 'highest', highest: 'highest',
  no: 'no',            notout: 'no',       notouts: 'no',
  avg: 'avg',          ave: 'avg',         average: 'avg',
  sr: 'sr',            strikerate: 'sr',
  '4s': 'fours',       fours: 'fours',
  '6s': 'sixes',       sixes: 'sixes',
  '50s': 'fifties',    fifties: 'fifties',
  '100s': 'hundreds',  hundreds: 'hundreds', tons: 'hundreds',
};

const SGIA_BOWL_COL_MAP = {
  rank: 'rank',        '#': 'rank',
  player: 'name',      name: 'name',       playername: 'name',
  team: 'team',
  bowl: 'style',       style: 'style',     bowlingstyle: 'style',
  type: 'style',       bowling: 'style',   bowltype: 'style',
  mat: 'mat',          matches: 'mat',
  inn: 'inns',         inns: 'inns',       innings: 'inns',
  overs: 'overs',      ov: 'overs',
  runs: 'runs',        runsconceded: 'runs',
  wkt: 'wickets',      wkts: 'wickets',    wickets: 'wickets',
  best: 'best',        bbi: 'best',        bestbowling: 'best',
  mdns: 'maidens',     maidens: 'maidens', maiden: 'maidens',
  avg: 'avg',          ave: 'avg',         average: 'avg',
  econ: 'econ',        economy: 'econ',    er: 'econ',           eco: 'econ',
};

function buildSGIABatting(row, rank) {
  return {
    rank:     safeInt(row.rank, rank),
    player:   String(row.name ?? '').trim(),
    team:     String(row.team ?? '').trim(),
    hand:     String(row.hand ?? '').trim(),
    mat:      safeInt(row.mat),
    inns:     safeInt(row.inns),
    runs:     safeInt(row.runs),
    balls:    safeInt(row.balls),
    highest:  String(row.highest ?? '0').trim(),
    no:       safeInt(row.no),
    avg:      safeFloat(row.avg),
    sr:       safeFloat(row.sr),
    fours:    safeInt(row.fours),
    sixes:    safeInt(row.sixes),
    fifties:  safeInt(row.fifties),
    hundreds: safeInt(row.hundreds),
  };
}

function buildSGIABowling(row, rank) {
  const bestRaw = String(row.best ?? '0').trim();
  const highest = bestRaw.includes('/')
    ? safeInt(bestRaw.split('/')[0])
    : safeInt(bestRaw);
  return {
    rank:     safeInt(row.rank, rank),
    player:   String(row.name ?? '').trim(),
    team:     String(row.team ?? '').trim(),
    style:    String(row.style ?? '').trim(),
    mat:      safeInt(row.mat),
    inns:     safeInt(row.inns),
    overs:    String(row.overs ?? '0').trim(),
    runs:     safeInt(row.runs),
    wickets:  safeInt(row.wickets),
    highest,
    maidens:  safeInt(row.maidens),
    avg:      safeFloat(row.avg),
    econ:     safeFloat(row.econ),
  };
}

function patchSGIA(existing, batRows, bowlRows) {
  const batting = batRows.map((r, i) => buildSGIABatting(r, i + 1));
  const bowling = bowlRows.map((r, i) => buildSGIABowling(r, i + 1));
  const TARGET = 'shl3';

  if (!existing.data?.find((t) => t.tournamentId === TARGET)) {
    throw new Error(
      `Tournament "${TARGET}" not found. Available: ` +
      (existing.data || []).map((t) => t.tournamentId).join(', ')
    );
  }

  return {
    ...existing,
    lastUpdated: nowSGT(),
    data: existing.data.map((t) =>
      t.tournamentId === TARGET ? { ...t, batting, bowling } : t
    ),
  };
}

// ── BPL -- column maps & builders ──────────────────────────────────────────────

const BPL_BAT_COL_MAP = {
  playerid: 'player_id', 'player_id': 'player_id',
  rank: 'rank',          '#': 'rank',
  player: 'name',        name: 'name',          playername: 'name',
  team: 'team_name',     teamname: 'team_name', teamid: 'team_id',
  bat: 'batting_hand',   hand: 'batting_hand',  battinghand: 'batting_hand',
  bathand: 'batting_hand',
  mat: 'matches',        matches: 'matches',
  inn: 'innings',        inns: 'innings',        innings: 'innings',
  runs: 'runs',
  balls: 'balls_faced',  ballsfaced: 'balls_faced', bf: 'balls_faced',
  hs: 'highest_score',   highestscore: 'highest_score', highest: 'highest_score',
  no: 'not_outs',        notout: 'not_outs',     notouts: 'not_outs',
  avg: 'average',        ave: 'average',         average: 'average',
  sr: 'strike_rate',     strikerate: 'strike_rate',
  '4s': 'fours',         fours: 'fours',
  '6s': 'sixes',         sixes: 'sixes',
  '50s': 'fifties',      fifties: 'fifties',
  '100s': 'hundreds',    hundreds: 'hundreds',   tons: 'hundreds',
};

const BPL_BOWL_COL_MAP = {
  playerid: 'player_id', 'player_id': 'player_id',
  rank: 'rank',          '#': 'rank',
  player: 'name',        name: 'name',          playername: 'name',
  team: 'team_name',     teamname: 'team_name', teamid: 'team_id',
  bowl: 'bowling_style', style: 'bowling_style', bowlingstyle: 'bowling_style',
  type: 'bowling_style', bowling: 'bowling_style',
  mat: 'matches',        matches: 'matches',
  inn: 'innings',        inns: 'innings',        innings: 'innings',
  overs: 'overs',        ov: 'overs',
  balls: 'balls',
  runs: 'runs_conceded', runsconceded: 'runs_conceded', rc: 'runs_conceded',
  wkt: 'wickets',        wkts: 'wickets',        wickets: 'wickets',
  best: 'best',          bbi: 'best',             bestbowling: 'best',
  mdns: 'maidens',       maidens: 'maidens',     maiden: 'maidens',
  avg: 'average',        ave: 'average',         average: 'average',
  econ: 'economy',       economy: 'economy',     er: 'economy',        eco: 'economy',
  sr: 'strike_rate',     strikerate: 'strike_rate',
  dots: 'dot_balls',     dotballs: 'dot_balls',  dot: 'dot_balls',
};

function buildBPLBatting(row, teamId) {
  const hs = safeInt(String(row.highest_score ?? '0').replace(/[^0-9]/g, ''));
  const innings = safeInt(row.innings);
  const avg = innings === 0 ? null : safeFloatNullable(row.average);
  return {
    team_id:      safeInt(row.team_id, teamId),
    team_name:    String(row.team_name ?? '').trim(),
    matches:      safeInt(row.matches),
    innings,
    runs:         safeInt(row.runs),
    highest_score: hs,
    average:      avg,
    not_outs:     safeInt(row.not_outs),
    strike_rate:  safeFloat(row.strike_rate),
    balls_faced:  safeInt(row.balls_faced),
    batting_hand: String(row.batting_hand ?? '').trim() || null,
    fours:        safeInt(row.fours),
    sixes:        safeInt(row.sixes),
    fifties:      safeInt(row.fifties),
    hundreds:     safeInt(row.hundreds),
  };
}

function buildBPLBowling(row, teamId) {
  const { overs, balls: ballsFromOvers } = parseOvers(row.overs);
  const balls = safeInt(row.balls) || ballsFromOvers;
  const bestRaw = String(row.best ?? '0').trim();
  const best_wickets = bestRaw.includes('/')
    ? safeInt(bestRaw.split('/')[0])
    : safeInt(bestRaw);
  return {
    team_id:       safeInt(row.team_id, teamId),
    team_name:     String(row.team_name ?? '').trim(),
    matches:       safeInt(row.matches),
    innings:       safeInt(row.innings),
    wickets:       safeInt(row.wickets),
    balls,
    best_wickets,
    economy:       safeFloat(row.economy),
    strike_rate:   safeFloat(row.strike_rate),
    maidens:       safeInt(row.maidens),
    average:       safeFloat(row.average),
    runs_conceded: safeInt(row.runs_conceded),
    bowling_style: String(row.bowling_style ?? '').trim() || null,
    overs,
    dot_balls:     safeInt(row.dot_balls),
  };
}

function defaultBPLBatting(teamId, teamName) {
  return {
    team_id: teamId, team_name: teamName,
    matches: 0, innings: 0, runs: 0, highest_score: 0, average: null,
    not_outs: 0, strike_rate: 0, balls_faced: 0, batting_hand: null,
    fours: 0, sixes: 0, fifties: 0, hundreds: 0,
  };
}

function defaultBPLBowling(teamId, teamName) {
  return {
    team_id: teamId, team_name: teamName,
    matches: 0, innings: 0, wickets: 0, balls: 0, best_wickets: 0,
    economy: 0, strike_rate: 0, maidens: 0, average: 0, runs_conceded: 0,
    bowling_style: null, overs: 0, dot_balls: 0,
  };
}

function patchBPL(existing, batRows, bowlRows) {
  const batMap  = new Map();
  const bowlMap = new Map();
  const idMap   = new Map();

  for (const row of batRows) {
    const key = normName(row.name);
    if (!key) continue;
    batMap.set(key, row);
    const pid = safeInt(row.player_id);
    if (pid > 0) idMap.set(key, pid);
  }
  for (const row of bowlRows) {
    const key = normName(row.name);
    if (!key) continue;
    bowlMap.set(key, row);
    const pid = safeInt(row.player_id);
    if (pid > 0 && !idMap.has(key)) idMap.set(key, pid);
  }

  const allKeys = new Set([...batMap.keys(), ...bowlMap.keys()]);
  const players = [];

  for (const key of allKeys) {
    const bat  = batMap.get(key);
    const bowl = bowlMap.get(key);
    const displayName = (bat?.name ?? bowl?.name ?? '').trim();
    const player_id   = idMap.get(key) ?? 0;

    const batTeamId   = safeInt(bat?.team_id);
    const bowlTeamId  = safeInt(bowl?.team_id);
    const teamId      = batTeamId || bowlTeamId;
    const teamName    = (bat?.team_name ?? bowl?.team_name ?? '').trim();

    const batting  = bat  ? buildBPLBatting(bat, teamId)   : defaultBPLBatting(teamId, teamName);
    const bowling  = bowl ? buildBPLBowling(bowl, teamId)  : defaultBPLBowling(teamId, teamName);
    const has_batting = !!bat;
    const has_bowling = !!bowl;

    const teams = [];
    if (teamId > 0 || teamName) {
      teams.push({ team_id: teamId, team_name: teamName });
    }
    const altTeamId   = has_batting ? bowlTeamId : batTeamId;
    const altTeamName = has_batting
      ? (bowl?.team_name ?? '').trim()
      : (bat?.team_name  ?? '').trim();
    if (altTeamId && altTeamId !== teamId && altTeamName) {
      teams.push({ team_id: altTeamId, team_name: altTeamName });
    }

    players.push({ player_id, name: displayName, teams, batting, bowling, has_batting, has_bowling });
  }

  players.sort((a, b) => a.name.localeCompare(b.name));

  const summary = {
    batting_records:                  players.filter((p) => p.has_batting).length,
    bowling_records:                  players.filter((p) => p.has_bowling).length,
    total_player_profiles:            players.length,
    players_with_batting_and_bowling: players.filter((p) => p.has_batting && p.has_bowling).length,
    players_with_batting_only:        players.filter((p) => p.has_batting && !p.has_bowling).length,
    players_with_bowling_only:        players.filter((p) => !p.has_batting && p.has_bowling).length,
  };

  return {
    ...existing,
    tournament:   'BPL 2025',
    lastUpdated:  nowSGT(),
    source_files: { batting: 'cricheroes-bpl-batting.xls', bowling: 'cricheroes-bpl-bowling.xls' },
    summary,
    players,
  };
}

// ── Tournament configuration ──────────────────────────────────────────────────

const ROOT       = path.resolve(__dirname, '..');
const TMP_BASE   = path.join(__dirname, 'tmp', 'cricheroes');
const BACKUP_BASE = path.join(ROOT, 'backups', 'cricheroes');

const TOURNAMENTS = [
  {
    key:       'sgia',
    name:      'SGIA SHL 3',
    url:       'https://cricheroes.com/tournament/1986843/sgia-shl-3/leaderboard',
    jsonFile:  path.join(ROOT, 'cricsearch-sg', 'src', 'data', 'sgiaStats.json'),
    tmpDir:    path.join(TMP_BASE, 'sgia'),
    batColMap:  SGIA_BAT_COL_MAP,
    bowlColMap: SGIA_BOWL_COL_MAP,
    patch:     patchSGIA,
  },
  {
    key:       'bpl',
    name:      'BPL 2025',
    url:       'https://cricheroes.com/tournament/1500354/bpl-2025/leaderboard',
    jsonFile:  path.join(ROOT, 'cricsearch-sg', 'src', 'data', 'bplStats.json'),
    tmpDir:    path.join(TMP_BASE, 'bpl'),
    batColMap:  BPL_BAT_COL_MAP,
    bowlColMap: BPL_BOWL_COL_MAP,
    patch:     patchBPL,
  },
];

// ── Backup ────────────────────────────────────────────────────────────────────

function backupJson(jsonFile, key) {
  const backupDir = path.join(BACKUP_BASE, key);
  ensureDir(backupDir);

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
             `-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

  const baseName = path.basename(jsonFile, '.json');
  const backupPath = path.join(backupDir, `${baseName}-${ts}.json`);
  fs.copyFileSync(jsonFile, backupPath);
  log(`  Backup saved -> ${path.relative(ROOT, backupPath)}`);
  return backupPath;
}

// ── Git commit + push ─────────────────────────────────────────────────────────

function gitCommitPush(changedFiles) {
  log('');
  log('=== Committing to GitHub ===');

  try {
    const status = execSync('git status --short', { cwd: ROOT }).toString().trim();
    log(`Git status:\n${status || '  (nothing to commit)'}`);

    if (!status) {
      log('No changes detected by git -- nothing to commit.');
      return;
    }

    for (const f of changedFiles) {
      const rel = path.relative(ROOT, f);
      execSync(`git add "${rel}"`, { cwd: ROOT });
      log(`  Staged: ${rel}`);
    }

    execSync(
      'git commit -m "chore: update CricHeroes stats from local download"',
      { cwd: ROOT, stdio: 'inherit' }
    );

    log('Pushing to origin main...');
    execSync('git push -u origin main', { cwd: ROOT, stdio: 'inherit' });
    log('Push complete. Stats are live on GitHub.');
  } catch (err) {
    log(`\nGit error: ${err.message}`);
    log('The JSON files were updated locally but could not be pushed automatically.');
    log('Please commit and push manually:');
    for (const f of changedFiles) {
      log(`  git add "${path.relative(ROOT, f)}"`);
    }
    log('  git commit -m "chore: update CricHeroes stats from local download"');
    log('  git push origin main');
  }
}

// ── Per-tournament update ─────────────────────────────────────────────────────

async function updateTournament(browser, config) {
  const { key, name, url, jsonFile, tmpDir, batColMap, bowlColMap, patch } = config;
  const tag = `[${key.toUpperCase()}]`;

  ensureDir(tmpDir);

  const batPath  = path.join(tmpDir, 'batting.xlsx');
  const bowlPath = path.join(tmpDir, 'bowling.xlsx');

  log(`${tag} === Starting ${name} update ===`);

  // Both downloads must succeed before we touch the JSON
  await downloadTabXls(browser, url, 'BAT',  batPath,  tmpDir);
  await downloadTabXls(browser, url, 'BOWL', bowlPath, tmpDir);

  for (const [label, p] of [['BAT', batPath], ['BOWL', bowlPath]]) {
    const bytes = fs.statSync(p).size;
    log(`${tag} ${label} file: ${bytes} bytes`);
    if (bytes < 500) throw new Error(`${label} file too small (${bytes} B) -- likely a failed download.`);
  }

  log(`${tag} Parsing BAT Excel...`);
  const batRows = parseSheetToRows(batPath, batColMap);
  log(`${tag}   -> ${batRows.length} rows`);

  log(`${tag} Parsing BOWL Excel...`);
  const bowlRows = parseSheetToRows(bowlPath, bowlColMap);
  log(`${tag}   -> ${bowlRows.length} rows`);

  if (batRows.length === 0)  throw new Error('Zero batting rows parsed -- check column mapping.');
  if (bowlRows.length === 0) throw new Error('Zero bowling rows parsed -- check column mapping.');

  log(`${tag} Patching JSON...`);
  const existing = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
  const updated  = patch(existing, batRows, bowlRows);

  const jsonOut = JSON.stringify(updated, null, 2) + '\n';
  JSON.parse(jsonOut); // validate output before writing

  const toCompare = (obj) => {
    const { lastUpdated: _, ...rest } = obj;
    return JSON.stringify(rest);
  };
  const changed = toCompare(existing) !== toCompare(updated);

  log(`${tag} === ${name} done -- changed: ${changed} ===`);
  return { key, jsonFile, jsonOut, changed };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  log('=== CricHeroes local stats updater starting ===');
  log('A browser window will open. Please do not close it until the script finishes.');
  log('');

  const browser = await chromium.launch({ headless: false });
  const results = [];

  for (const config of TOURNAMENTS) {
    try {
      const r = await updateTournament(browser, config);
      results.push({ config, success: true, ...r });
    } catch (err) {
      log(`[${config.key.toUpperCase()}] FAILED: ${err.message}`);
      results.push({ config, success: false, error: err.message });
    }
  }

  await browser.close();
  log('Browser closed.');

  // Backup then write each successfully updated file.
  // JSON is never overwritten unless BOTH BAT and BOWL downloads succeeded.
  const writtenFiles = [];
  for (const r of results) {
    if (r.success && r.changed) {
      log(`Backing up ${path.basename(r.jsonFile)}...`);
      backupJson(r.jsonFile, r.key);

      log(`Writing ${path.basename(r.jsonFile)}...`);
      fs.writeFileSync(r.jsonFile, r.jsonOut, 'utf-8');
      JSON.parse(fs.readFileSync(r.jsonFile, 'utf-8')); // verify
      log(`  OK: ${path.basename(r.jsonFile)} written and verified.`);
      writtenFiles.push(r.jsonFile);
    }
  }

  log('');
  log('=== Summary ===');
  for (const r of results) {
    const status = r.success
      ? (r.changed ? 'UPDATED' : 'NO CHANGE')
      : `FAILED -- ${r.error}`;
    log(`  ${r.config.key.toUpperCase()}: ${status}`);
  }

  if (results.every((r) => !r.success)) {
    log('All tournaments failed. No files written.');
    process.exit(1);
  }

  if (writtenFiles.length > 0) {
    gitCommitPush(writtenFiles);
  } else {
    log('No JSON files changed -- nothing to commit.');
  }
}

main().catch((err) => {
  console.error(`\n[FATAL] ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
