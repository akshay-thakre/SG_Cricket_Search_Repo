#!/usr/bin/env node
'use strict';

/**
 * Automated SGIA stats updater.
 *
 * Downloads the BAT and BOWL leaderboard XLS files from the CricHeroes
 * tournament page, parses them, and replaces the shl3 tournament data
 * inside cricsearch-sg/src/data/sgiaStats.json.
 *
 * Exit codes:
 *   0 — success (data updated or already up to date)
 *   1 — unrecoverable error (JSON not written)
 */

const { chromium } = require('playwright');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// ── Configuration ─────────────────────────────────────────────────────────────

const LEADERBOARD_URL =
  'https://cricheroes.com/tournament/1986843/sgia-shl-3/leaderboard';

const DATA_FILE = path.resolve(
  __dirname, '..', 'cricsearch-sg', 'src', 'data', 'sgiaStats.json'
);

const TMP_DIR = path.resolve(__dirname, '..', 'tmp', 'sgia');

// Only this tournament is updated; all other entries are preserved as-is.
const TARGET_TOURNAMENT_ID = 'shl3';

// ── Column name maps ──────────────────────────────────────────────────────────
// Maps normalised XLS header key → canonical field name used in sgiaStats.json.
// Normalisation: lowercase, strip all non-alphanumeric characters.

const BAT_COL_MAP = {
  rank: 'rank',      '#': 'rank',
  player: 'player',  name: 'player',     playername: 'player',
  team: 'team',
  bat: 'hand',       hand: 'hand',       battinghand: 'hand',
  bathand: 'hand',   batting: 'hand',
  mat: 'mat',        matches: 'mat',     m: 'mat',
  inn: 'inns',       inns: 'inns',       innings: 'inns',       i: 'inns',
  runs: 'runs',      r: 'runs',
  balls: 'balls',    ballsfaced: 'balls', bf: 'balls',           b: 'balls',
  hs: 'highest',     highestscore: 'highest', highest: 'highest',
  no: 'no',          notout: 'no',       notouts: 'no',
  avg: 'avg',        ave: 'avg',         average: 'avg',
  sr: 'sr',          strikerate: 'sr',
  '4s': 'fours',     fours: 'fours',
  '6s': 'sixes',     sixes: 'sixes',
  '50s': 'fifties',  fifties: 'fifties',
  '100s': 'hundreds', hundreds: 'hundreds', tons: 'hundreds',
};

const BOWL_COL_MAP = {
  rank: 'rank',      '#': 'rank',
  player: 'player',  name: 'player',     playername: 'player',
  team: 'team',
  bowl: 'style',     style: 'style',     bowlingstyle: 'style',
  type: 'style',     bowling: 'style',   bowltype: 'style',
  mat: 'mat',        matches: 'mat',     m: 'mat',
  inn: 'inns',       inns: 'inns',       innings: 'inns',       i: 'inns',
  overs: 'overs',    ov: 'overs',        o: 'overs',
  runs: 'runs',      r: 'runs',          runsconceded: 'runs',
  wkt: 'wickets',    wkts: 'wickets',    wickets: 'wickets',    w: 'wickets',
  best: 'best',      bbi: 'best',        bestbowling: 'best',   bestbowlinginnings: 'best',
  mdns: 'maidens',   maidens: 'maidens', maiden: 'maidens',     md: 'maidens',
  avg: 'avg',        ave: 'avg',         average: 'avg',
  econ: 'econ',      economy: 'econ',    er: 'econ',            eco: 'econ',
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Normalize an XLS column header to a lookup key. */
function normKey(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Normalize a player name for deduplication comparisons. */
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
  if (Number.isNaN(n)) return def;
  return Math.round(n * 100) / 100;
}

/** Return current Singapore time as an ISO-8601 string with +08:00 offset. */
function nowSGT() {
  const now = new Date();
  const sgt = new Date(now.getTime() + 8 * 3600_000);
  return sgt.toISOString().slice(0, 19) + '+08:00';
}

// ── Excel parsing ─────────────────────────────────────────────────────────────

/**
 * Parse an XLS/XLSX file into an array of plain objects using the provided
 * column map.  Scans the first 5 rows to locate the header row.
 */
function parseSheetToRows(filePath, colMap) {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rawRows.length < 2) {
    throw new Error(`Sheet in "${path.basename(filePath)}" has fewer than 2 rows.`);
  }

  // Find the first row that maps ≥ 3 known columns.
  let headerRowIdx = -1;
  let headerMap = {}; // colIndex (string) → canonical field name

  for (let i = 0; i < Math.min(6, rawRows.length); i++) {
    const row = rawRows[i];
    const map = {};
    let matchCount = 0;
    for (let j = 0; j < row.length; j++) {
      const k = normKey(row[j]);
      if (colMap[k]) {
        map[String(j)] = colMap[k];
        matchCount++;
      }
    }
    if (matchCount >= 3) {
      headerRowIdx = i;
      headerMap = map;
      break;
    }
  }

  if (headerRowIdx === -1) {
    const preview = (rawRows[0] || []).slice(0, 20).join(' | ');
    throw new Error(
      `Cannot identify header row in "${path.basename(filePath)}". ` +
      `First row preview: [${preview}]`
    );
  }

  log(`  Header row at index ${headerRowIdx}: ` +
    Object.entries(headerMap).map(([i, f]) => `col${i}→${f}`).join(', ')
  );

  const results = [];
  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    if (rawRow.every((v) => v === '' || v === null || v === undefined)) continue;

    const obj = {};
    for (const [colIdx, fieldName] of Object.entries(headerMap)) {
      obj[fieldName] = rawRow[parseInt(colIdx, 10)] ?? '';
    }

    if (!obj.player || String(obj.player).trim() === '') continue;
    results.push(obj);
  }

  return results;
}

// ── Record builders ───────────────────────────────────────────────────────────

function buildBattingRecord(row, fallbackRank) {
  return {
    rank:     safeInt(row.rank, fallbackRank),
    player:   String(row.player ?? '').trim(),
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

function buildBowlingRecord(row, fallbackRank) {
  // "Best" column may be "5/23" (BBI) or just "5" — keep only the wickets integer.
  const bestRaw = String(row.best ?? '0').trim();
  const highest = bestRaw.includes('/')
    ? safeInt(bestRaw.split('/')[0])
    : safeInt(bestRaw);

  return {
    rank:     safeInt(row.rank, fallbackRank),
    player:   String(row.player ?? '').trim(),
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

// ── Playwright helpers ────────────────────────────────────────────────────────

/**
 * Try multiple Playwright locator strategies in sequence.
 * Returns true on the first one that succeeds.
 */
async function tryClick(page, strategies) {
  for (const getLocator of strategies) {
    try {
      const locator = getLocator();
      await locator.waitFor({ state: 'visible', timeout: 6000 });
      await locator.click({ timeout: 6000 });
      return true;
    } catch {
      // try next strategy
    }
  }
  return false;
}

/**
 * Navigate to the leaderboard, select the given tab (BAT or BOWL),
 * click "Download XLS", save the file to savePath, and return savePath.
 *
 * Throws if the page requires login/captcha, the tab cannot be found,
 * or the download does not complete within 90 s.
 */
async function downloadTabXls(browser, tabLabel, savePath) {
  log(`[${tabLabel}] Opening CricHeroes leaderboard...`);

  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  try {
    await page.goto(LEADERBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });

    // Detect unexpected redirects
    const currentUrl = page.url();
    if (/login|signin|captcha/i.test(currentUrl)) {
      throw new Error(`Redirected to auth page: ${currentUrl}. Site requires login.`);
    }

    // Detect login modal / CAPTCHA overlay
    const loginVisible = await page.locator('text=/login|sign in/i').first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    if (loginVisible) {
      await page.screenshot({ path: path.join(TMP_DIR, `debug-${tabLabel}-login.png`) });
      throw new Error(`Login prompt detected on leaderboard page. Cannot proceed without authentication.`);
    }

    // Wait for the page to render the tab bar (look for any of the known tab labels)
    await page.waitForSelector('text=/^(BAT|BOWL|FIELD|MVP)$/i', { timeout: 20_000 })
      .catch(() => {
        // Non-fatal: tab bar may use different text; proceed anyway
        log(`[${tabLabel}] Tab bar selector timed out; attempting to continue...`);
      });

    // Click the correct tab
    log(`[${tabLabel}] Selecting ${tabLabel} tab...`);
    const tabClicked = await tryClick(page, [
      () => page.getByRole('button', { name: new RegExp(`^${tabLabel}$`, 'i') }),
      () => page.getByRole('tab',   { name: new RegExp(`^${tabLabel}$`, 'i') }),
      () => page.locator(`[role="tab"]:has-text("${tabLabel}")`),
      () => page.locator(`button:has-text("${tabLabel}")`),
      () => page.locator(`a:has-text("${tabLabel}")`),
      () => page.locator(`[class*="tab"]:has-text("${tabLabel}")`),
      () => page.locator(`div:has-text("${tabLabel}")`).nth(1),
      () => page.getByText(new RegExp(`^${tabLabel}$`, 'i')).nth(0),
    ]);

    if (!tabClicked) {
      await page.screenshot({ path: path.join(TMP_DIR, `debug-${tabLabel}-notab.png`) });
      throw new Error(`Could not click "${tabLabel}" tab. Check debug screenshot at tmp/sgia/`);
    }

    // Let the table re-render after the tab switch
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Click "Download XLS" and intercept the file download
    log(`[${tabLabel}] Downloading XLS...`);

    let download = null;
    const dlStrategies = [
      () => page.getByRole('button', { name: /download xls/i }),
      () => page.locator('button:has-text("Download XLS")'),
      () => page.locator('a:has-text("Download XLS")'),
      () => page.locator('[class*="download"]:has-text("XLS")'),
      () => page.locator('text=Download XLS').first(),
      () => page.locator('[title*="Download"]').first(),
      () => page.locator('[aria-label*="download" i]').first(),
    ];

    for (const getLocator of dlStrategies) {
      try {
        const locator = getLocator();
        const isVisible = await locator.isVisible({ timeout: 5000 });
        if (!isVisible) continue;

        const dlPromise = page.waitForEvent('download', { timeout: 90_000 });
        await locator.click({ timeout: 8000 });
        download = await dlPromise;
        break;
      } catch {
        // try next
      }
    }

    if (!download) {
      await page.screenshot({ path: path.join(TMP_DIR, `debug-${tabLabel}-nodl.png`) });
      throw new Error(
        `Could not trigger XLS download for "${tabLabel}" tab. ` +
        `Check debug screenshot at tmp/sgia/`
      );
    }

    await download.saveAs(savePath);
    log(`[${tabLabel}] Saved to ${path.relative(process.cwd(), savePath)}`);
  } finally {
    await context.close();
  }

  return savePath;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  log('=== SGIA stats update starting ===');
  ensureDir(TMP_DIR);

  const batPath  = path.join(TMP_DIR, 'batting.xls');
  const bowlPath = path.join(TMP_DIR, 'bowling.xls');

  // ── 1. Download XLS files ─────────────────────────────────────────────────
  log('Launching Playwright (headless Chromium)...');
  const browser = await chromium.launch({ headless: true });

  try {
    await downloadTabXls(browser, 'BAT',  batPath);
    await downloadTabXls(browser, 'BOWL', bowlPath);
  } finally {
    await browser.close();
    log('Browser closed.');
  }

  // ── 2. Sanity-check downloads ─────────────────────────────────────────────
  for (const [label, p] of [['BAT', batPath], ['BOWL', bowlPath]]) {
    if (!fs.existsSync(p)) {
      throw new Error(`${label} download file not found: ${p}`);
    }
    const bytes = fs.statSync(p).size;
    log(`${label} file: ${bytes} bytes`);
    if (bytes < 500) {
      throw new Error(
        `${label} file is suspiciously small (${bytes} bytes). ` +
        `The download may have failed or returned an error page.`
      );
    }
  }

  // ── 3. Parse both Excel files ─────────────────────────────────────────────
  log('Parsing BAT Excel...');
  const batRows = parseSheetToRows(batPath, BAT_COL_MAP);
  log(`  → ${batRows.length} batting rows`);

  log('Parsing BOWL Excel...');
  const bowlRows = parseSheetToRows(bowlPath, BOWL_COL_MAP);
  log(`  → ${bowlRows.length} bowling rows`);

  if (batRows.length === 0) throw new Error('No batting rows parsed — column mapping may be wrong.');
  if (bowlRows.length === 0) throw new Error('No bowling rows parsed — column mapping may be wrong.');

  // ── 4. Build final arrays ─────────────────────────────────────────────────
  log('Merging player records...');
  const batting = batRows.map((row, i) => buildBattingRecord(row, i + 1));
  const bowling = bowlRows.map((row, i) => buildBowlingRecord(row, i + 1));

  log(`  → ${batting.length} batting records, ${bowling.length} bowling records`);

  // ── 5. Read + patch existing JSON ─────────────────────────────────────────
  log('Reading existing sgiaStats.json...');
  const existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

  if (!existing.data || !Array.isArray(existing.data)) {
    throw new Error('Unexpected sgiaStats.json structure — "data" array not found.');
  }

  const targetIdx = existing.data.findIndex(
    (t) => t.tournamentId === TARGET_TOURNAMENT_ID
  );
  if (targetIdx === -1) {
    throw new Error(
      `Tournament "${TARGET_TOURNAMENT_ID}" not found in sgiaStats.json. ` +
      `Available: ${existing.data.map((t) => t.tournamentId).join(', ')}`
    );
  }

  const now = nowSGT();
  const updatedData = existing.data.map((tournament, idx) => {
    if (idx !== targetIdx) return tournament;
    return { ...tournament, batting, bowling };
  });

  const updated = { ...existing, lastUpdated: now, data: updatedData };

  // ── 6. Validate output JSON ───────────────────────────────────────────────
  const jsonOut = JSON.stringify(updated, null, 2) + '\n';
  try {
    JSON.parse(jsonOut);
  } catch (e) {
    throw new Error(`Generated JSON failed validation: ${e.message}`);
  }

  // ── 7. Check if data actually changed ────────────────────────────────────
  // Compare data arrays only (ignore lastUpdated timestamp).
  const existingDataJson = JSON.stringify(existing.data);
  const updatedDataJson  = JSON.stringify(updatedData);

  if (existingDataJson === updatedDataJson) {
    log('No data changes detected — sgiaStats.json is already up to date.');
    return;
  }

  // ── 8. Write ──────────────────────────────────────────────────────────────
  log('Updating sgiaStats.json...');
  fs.writeFileSync(DATA_FILE, jsonOut, 'utf-8');

  // Read back to confirm
  const verified = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const vt = verified.data.find((t) => t.tournamentId === TARGET_TOURNAMENT_ID);
  log(`Validation successful:`);
  log(`  batting:  ${vt.batting.length} records`);
  log(`  bowling:  ${vt.bowling.length} records`);
  log(`  lastUpdated: ${verified.lastUpdated}`);
  log('=== Done ===');
}

main().catch((err) => {
  console.error(`\n[FATAL] ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
