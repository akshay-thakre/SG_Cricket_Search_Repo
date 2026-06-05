#!/usr/bin/env node
'use strict';

/**
 * Manual import script for CricHeroes stats.
 *
 * HOW TO USE:
 *   1. Open cricheroes.com in your regular Chrome browser.
 *   2. Go to the SGIA SHL 3 leaderboard → download Batting XLS and Bowling XLS.
 *      Place both files in:  scripts\downloads\cricheroes\sgia\
 *   3. Go to the BPL 2025 leaderboard → download Batting XLS and Bowling XLS.
 *      Place both files in:  scripts\downloads\cricheroes\bpl\
 *   4. Run from repo root:   npm run import:cricheroes
 *
 * The script auto-detects which file is batting and which is bowling
 * by reading the column headers — no renaming required.
 * Processed files are moved to downloads\cricheroes\done\ when finished.
 */

const XLSX = require('xlsx');
const fs   = require('fs');
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

function nowStamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  );
}

function parseOvers(v) {
  const s = String(v ?? '0').trim();
  const parts = s.split('.');
  const completeOvers = safeInt(parts[0]);
  const extraBalls    = parts.length > 1 ? safeInt(parts[1]) : 0;
  return { overs: completeOvers, balls: completeOvers * 6 + extraBalls };
}

// ── Excel file detection ──────────────────────────────────────────────────────

// Column keys that are exclusive (or near-exclusive) to one tab type.
const BOWLING_MARKERS = new Set([
  'econ', 'economy', 'er', 'eco',
  'wickets', 'wkts', 'wkt',
  'overs', 'ov',
  'bbi', 'best', 'bestbowling',
  'mdns', 'maidens', 'maiden',
]);
const BATTING_MARKERS = new Set([
  'hs', 'highestscore',
  '4s', 'fours',
  '6s', 'sixes',
  '50s', 'fifties',
  '100s', 'hundreds', 'tons',
  'strikerate', 'sr',
  'ballsfaced', 'bf',
]);

/**
 * Returns 'batting', 'bowling', or null if it cannot be determined.
 */
function detectTabType(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  for (let i = 0; i < Math.min(6, rawRows.length); i++) {
    const keys      = rawRows[i].map((c) => normKey(String(c)));
    const batScore  = keys.filter((k) => BATTING_MARKERS.has(k)).length;
    const bowlScore = keys.filter((k) => BOWLING_MARKERS.has(k)).length;
    if (batScore + bowlScore >= 2) {
      return batScore >= bowlScore ? 'batting' : 'bowling';
    }
  }
  return null;
}

function findExcelFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => /\.(xls|xlsx|csv)$/i.test(f) && !f.startsWith('~$'))
    .map((f) => path.join(dir, f));
}

// ── Excel parsing ─────────────────────────────────────────────────────────────

function parseSheetToRows(filePath, colMap) {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rawRows.length < 2) {
    throw new Error(`Sheet in "${path.basename(filePath)}" has fewer than 2 rows.`);
  }

  let headerRowIdx = -1;
  let headerMap    = {};

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

// ── SGIA column maps & builders ───────────────────────────────────────────────

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
  econ: 'econ',        economy: 'econ',    er: 'econ',  eco: 'econ',
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
    rank:    safeInt(row.rank, rank),
    player:  String(row.name ?? '').trim(),
    team:    String(row.team ?? '').trim(),
    style:   String(row.style ?? '').trim(),
    mat:     safeInt(row.mat),
    inns:    safeInt(row.inns),
    overs:   String(row.overs ?? '0').trim(),
    runs:    safeInt(row.runs),
    wickets: safeInt(row.wickets),
    highest,
    maidens: safeInt(row.maidens),
    avg:     safeFloat(row.avg),
    econ:    safeFloat(row.econ),
  };
}

function patchSGIA(existing, batRows, bowlRows) {
  const batting = batRows.map((r, i) => buildSGIABatting(r, i + 1));
  const bowling = bowlRows.map((r, i) => buildSGIABowling(r, i + 1));
  const TARGET  = 'shl3';

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

// ── BPL column maps & builders ────────────────────────────────────────────────

const BPL_BAT_COL_MAP = {
  playerid: 'player_id', 'player_id': 'player_id',
  rank: 'rank',          '#': 'rank',
  player: 'name',        name: 'name',          playername: 'name',
  team: 'team_name',     teamname: 'team_name', teamid: 'team_id',
  bat: 'batting_hand',   hand: 'batting_hand',  battinghand: 'batting_hand',
  bathand: 'batting_hand',
  mat: 'matches',        matches: 'matches',    m: 'matches',
  inn: 'innings',        inns: 'innings',       innings: 'innings',    i: 'innings',
  runs: 'runs',
  balls: 'balls_faced',  ballsfaced: 'balls_faced', bf: 'balls_faced',
  hs: 'highest_score',   highestscore: 'highest_score', highest: 'highest_score',
  no: 'not_outs',        notout: 'not_outs',    notouts: 'not_outs',
  avg: 'average',        ave: 'average',        average: 'average',
  sr: 'strike_rate',     strikerate: 'strike_rate',
  '4s': 'fours',         fours: 'fours',
  '6s': 'sixes',         sixes: 'sixes',
  '50s': 'fifties',      fifties: 'fifties',
  '100s': 'hundreds',    hundreds: 'hundreds',  tons: 'hundreds',
};

const BPL_BOWL_COL_MAP = {
  playerid: 'player_id', 'player_id': 'player_id',
  rank: 'rank',          '#': 'rank',
  player: 'name',        name: 'name',          playername: 'name',
  team: 'team_name',     teamname: 'team_name', teamid: 'team_id',
  bowl: 'bowling_style', style: 'bowling_style', bowlingstyle: 'bowling_style',
  type: 'bowling_style', bowling: 'bowling_style',
  mat: 'matches',        matches: 'matches',    m: 'matches',
  inn: 'innings',        inns: 'innings',       innings: 'innings',    i: 'innings',
  overs: 'overs',        ov: 'overs',
  balls: 'balls',
  runs: 'runs_conceded', runsconceded: 'runs_conceded', rc: 'runs_conceded',
  wkt: 'wickets',        wkts: 'wickets',       wickets: 'wickets',
  best: 'best',          bbi: 'best',           bestbowling: 'best',
  mdns: 'maidens',       maidens: 'maidens',    maiden: 'maidens',
  avg: 'average',        ave: 'average',        average: 'average',
  econ: 'economy',       economy: 'economy',    er: 'economy', eco: 'economy',
  sr: 'strike_rate',     strikerate: 'strike_rate',
  dots: 'dot_balls',     dotballs: 'dot_balls', dot: 'dot_balls',
};

function buildBPLBatting(row, teamId) {
  const hs      = safeInt(String(row.highest_score ?? '0').replace(/[^0-9]/g, ''));
  const innings = safeInt(row.innings);
  const avg     = innings === 0 ? null : safeFloatNullable(row.average);
  return {
    team_id:       safeInt(row.team_id, teamId),
    team_name:     String(row.team_name ?? '').trim(),
    matches:       safeInt(row.matches),
    innings,
    runs:          safeInt(row.runs),
    highest_score: hs,
    average:       avg,
    not_outs:      safeInt(row.not_outs),
    strike_rate:   safeFloat(row.strike_rate),
    balls_faced:   safeInt(row.balls_faced),
    batting_hand:  String(row.batting_hand ?? '').trim() || null,
    fours:         safeInt(row.fours),
    sixes:         safeInt(row.sixes),
    fifties:       safeInt(row.fifties),
    hundreds:      safeInt(row.hundreds),
  };
}

function buildBPLBowling(row, teamId) {
  const { overs, balls: ballsFromOvers } = parseOvers(row.overs);
  const balls       = safeInt(row.balls) || ballsFromOvers;
  const bestRaw     = String(row.best ?? '0').trim();
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

    const batTeamId  = safeInt(bat?.team_id);
    const bowlTeamId = safeInt(bowl?.team_id);
    const teamId     = batTeamId || bowlTeamId;
    const teamName   = (bat?.team_name ?? bowl?.team_name ?? '').trim();

    const batting     = bat  ? buildBPLBatting(bat, teamId)  : defaultBPLBatting(teamId, teamName);
    const bowling     = bowl ? buildBPLBowling(bowl, teamId) : defaultBPLBowling(teamId, teamName);
    const has_batting = !!bat;
    const has_bowling = !!bowl;

    const teams = [];
    if (teamId > 0 || teamName) teams.push({ team_id: teamId, team_name: teamName });
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

// ── Backup ────────────────────────────────────────────────────────────────────

function backupJson(jsonFile, key, backupBase) {
  const backupDir  = path.join(backupBase, key);
  ensureDir(backupDir);
  const baseName   = path.basename(jsonFile, '.json');
  const backupPath = path.join(backupDir, `${baseName}-${nowStamp()}.json`);
  fs.copyFileSync(jsonFile, backupPath);
  log(`  Backup -> ${path.relative(ROOT, backupPath)}`);
}

// ── Git commit + push ─────────────────────────────────────────────────────────

function gitCommitPush(changedFiles) {
  log('');
  log('=== Committing to GitHub ===');
  try {
    const status = execSync('git status --short', { cwd: ROOT }).toString().trim();
    if (!status) { log('No changes detected by git.'); return; }

    for (const f of changedFiles) {
      const rel = path.relative(ROOT, f);
      execSync(`git add "${rel}"`, { cwd: ROOT });
      log(`  Staged: ${rel}`);
    }
    execSync('git commit -m "chore: update CricHeroes stats from local download"',
      { cwd: ROOT, stdio: 'inherit' });
    log('Pushing to origin main...');
    execSync('git push -u origin main', { cwd: ROOT, stdio: 'inherit' });
    log('Push complete. Stats are live on GitHub.');
  } catch (err) {
    log(`\nGit error: ${err.message}`);
    log('JSON files were updated locally. Push manually:');
    for (const f of changedFiles) log(`  git add "${path.relative(ROOT, f)}"`);
    log('  git commit -m "chore: update CricHeroes stats from local download"');
    log('  git push origin main');
  }
}

// ── Per-tournament import ─────────────────────────────────────────────────────

function importTournament(config) {
  const { key, name, downloadDir, jsonFile, batColMap, bowlColMap, patch } = config;
  const tag = `[${key.toUpperCase()}]`;

  const files = findExcelFiles(downloadDir);

  if (files.length === 0) {
    throw new Error(
      `No Excel files found in ${downloadDir}\n` +
      `  → Download the ${name} Batting and Bowling XLS files from CricHeroes\n` +
      `    and place them in that folder, then re-run.`
    );
  }

  log(`${tag} Found ${files.length} file(s): ${files.map((f) => path.basename(f)).join(', ')}`);

  let batFile  = null;
  let bowlFile = null;

  for (const f of files) {
    const type = detectTabType(f);
    log(`${tag}   ${path.basename(f)} → detected as: ${type ?? 'unknown'}`);
    if (type === 'batting' && !batFile)   batFile  = f;
    if (type === 'bowling' && !bowlFile)  bowlFile = f;
  }

  if (!batFile)  throw new Error(`${tag} Could not identify a batting file in ${downloadDir}.`);
  if (!bowlFile) throw new Error(`${tag} Could not identify a bowling file in ${downloadDir}.`);

  log(`${tag} Parsing batting: ${path.basename(batFile)}`);
  const batRows = parseSheetToRows(batFile, batColMap);
  log(`${tag}   → ${batRows.length} rows`);

  log(`${tag} Parsing bowling: ${path.basename(bowlFile)}`);
  const bowlRows = parseSheetToRows(bowlFile, bowlColMap);
  log(`${tag}   → ${bowlRows.length} rows`);

  if (batRows.length  === 0) throw new Error('Zero batting rows parsed — check column mapping.');
  if (bowlRows.length === 0) throw new Error('Zero bowling rows parsed — check column mapping.');

  log(`${tag} Patching JSON...`);
  const existing = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
  const updated  = patch(existing, batRows, bowlRows);

  const jsonOut = JSON.stringify(updated, null, 2) + '\n';
  JSON.parse(jsonOut); // validate before write

  const toCompare = (obj) => { const { lastUpdated: _, ...rest } = obj; return JSON.stringify(rest); };
  const changed   = toCompare(existing) !== toCompare(updated);

  log(`${tag} Done — changed: ${changed}`);
  return { jsonFile, jsonOut, changed, batFile, bowlFile };
}

// ── Paths ─────────────────────────────────────────────────────────────────────

const ROOT          = path.resolve(__dirname, '..');
const DOWNLOAD_BASE = path.join(__dirname, 'downloads', 'cricheroes');
const BACKUP_BASE   = path.join(ROOT, 'backups', 'cricheroes');

const TOURNAMENTS = [
  {
    key:         'sgia',
    name:        'SGIA SHL 3',
    downloadDir: path.join(DOWNLOAD_BASE, 'sgia'),
    jsonFile:    path.join(ROOT, 'cricsearch-sg', 'src', 'data', 'sgiaStats.json'),
    batColMap:   SGIA_BAT_COL_MAP,
    bowlColMap:  SGIA_BOWL_COL_MAP,
    patch:       patchSGIA,
  },
  {
    key:         'bpl',
    name:        'BPL 2025',
    downloadDir: path.join(DOWNLOAD_BASE, 'bpl'),
    jsonFile:    path.join(ROOT, 'cricsearch-sg', 'src', 'data', 'bplStats.json'),
    batColMap:   BPL_BAT_COL_MAP,
    bowlColMap:  BPL_BOWL_COL_MAP,
    patch:       patchBPL,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  log('=== CricHeroes manual import starting ===');
  log('');

  // Create download folders and drop a helper text file if first run.
  for (const t of TOURNAMENTS) {
    ensureDir(t.downloadDir);
    const hint = path.join(t.downloadDir, 'PUT_FILES_HERE.txt');
    if (!fs.existsSync(hint)) {
      fs.writeFileSync(
        hint,
        `Place the ${t.name} Batting and Bowling Excel files here.\n` +
        `Any file name is fine — the script detects the type automatically.\n` +
        `Then run:  npm run import:cricheroes  from the repo root.\n`
      );
    }
  }

  // Check upfront that every folder has files before doing any work.
  const missing = TOURNAMENTS.filter((t) => findExcelFiles(t.downloadDir).length === 0);
  if (missing.length > 0) {
    log('ERROR: Missing Excel files. Please download them first:\n');
    for (const t of missing) {
      log(`  ${t.name}`);
      log(`    Batting XLS  →  place in: ${t.downloadDir}`);
      log(`    Bowling XLS  →  place in: ${t.downloadDir}`);
    }
    log('\nSteps:');
    log('  1. Open cricheroes.com in your browser');
    log('  2. Go to the tournament leaderboard');
    log('  3. Click the Batting tab → Download XLS → save to the folder above');
    log('  4. Click the Bowling tab → Download XLS → save to the folder above');
    log('  5. Re-run: npm run import:cricheroes');
    process.exit(1);
  }

  // Import each tournament.
  const results = [];
  for (const config of TOURNAMENTS) {
    try {
      const r = importTournament(config);
      results.push({ config, success: true, ...r });
    } catch (err) {
      log(`[${config.key.toUpperCase()}] FAILED: ${err.message}`);
      results.push({ config, success: false, error: err.message });
    }
  }

  // Backup old JSON then write new JSON for successful results.
  const writtenFiles = [];
  for (const r of results) {
    if (r.success && r.changed) {
      log(`Backing up ${path.basename(r.jsonFile)}...`);
      backupJson(r.jsonFile, r.config.key, BACKUP_BASE);

      log(`Writing ${path.basename(r.jsonFile)}...`);
      fs.writeFileSync(r.jsonFile, r.jsonOut, 'utf-8');
      JSON.parse(fs.readFileSync(r.jsonFile, 'utf-8')); // verify
      log(`  OK: ${path.basename(r.jsonFile)} written and verified.`);
      writtenFiles.push(r.jsonFile);
    }
  }

  // Move processed Excel files to done/ so they don't get re-imported accidentally.
  const doneDir = path.join(DOWNLOAD_BASE, 'done', nowStamp());
  for (const r of results) {
    if (r.success) {
      ensureDir(doneDir);
      for (const f of [r.batFile, r.bowlFile]) {
        if (!f) continue;
        const dest = path.join(doneDir, `${r.config.key}-${path.basename(f)}`);
        fs.renameSync(f, dest);
        log(`  Archived: ${path.basename(f)} → done/${path.basename(doneDir)}/`);
      }
    }
  }

  // Summary.
  log('');
  log('=== Summary ===');
  for (const r of results) {
    const status = r.success
      ? (r.changed ? 'UPDATED' : 'NO CHANGE')
      : `FAILED — ${r.error}`;
    log(`  ${r.config.key.toUpperCase()}: ${status}`);
  }

  if (results.every((r) => !r.success)) {
    log('All imports failed. No files written.');
    process.exit(1);
  }

  if (writtenFiles.length > 0) {
    gitCommitPush(writtenFiles);
  } else {
    log('No JSON files changed — nothing to commit.');
  }
}

main();
