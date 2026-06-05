const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const { execSync } = require('child_process');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const REPO_ROOT = process.env.REPO_ROOT || path.resolve(__dirname, '../..');

const COMPETITIONS = {
  'SG IA': {
    fullName: 'Singapore Indian Association',
    outputFileName: 'sgiaStats.json',
    targetRepoPath: 'cricsearch-sg/src/data/sgiaStats.json',
    backupDir: 'cricsearch-sg/src/data/backups',
  },
  'BPL': {
    fullName: 'Bengali Premier League',
    outputFileName: 'bplStats.json',
    targetRepoPath: 'cricsearch-sg/src/data/bplStats.json',
    backupDir: 'cricsearch-sg/src/data/backups',
  },
  'YPL': {
    fullName: 'Young Premier League',
    outputFileName: 'yplStats.json',
    targetRepoPath: 'cricsearch-sg/src/data/yplStats.json',
    backupDir: 'cricsearch-sg/src/data/backups',
  },
  'SCA': {
    fullName: 'Singapore Cricket Association',
    outputFileName: 'scaStats.json',
    targetRepoPath: 'cricsearch-sg/src/data/scaStats.json',
    backupDir: 'cricsearch-sg/src/data/backups',
  },
};

const BATTING_MAP = {
  name: 'player',
  team_name: 'team',
  batting_hand: 'hand',
  total_match: 'mat',
  innings: 'inns',
  total_runs: 'runs',
  ball_faced: 'balls',
  highest_run: 'highest',
  not_out: 'no',
  average: 'avg',
  strike_rate: 'sr',
  '4s': 'fours',
  '6s': 'sixes',
  '50s': 'fifties',
  '100s': 'hundreds',
};

const BOWLING_MAP = {
  name: 'player',
  team_name: 'team',
  bowling_style: 'style',
  total_match: 'mat',
  innings: 'inns',
  overs: 'overs',
  runs: 'runs',
  total_wickets: 'wickets',
  highest_wicket: 'highest',
  maidens: 'maidens',
  avg: 'avg',
  economy: 'econ',
};

const BATTING_REQUIRED = ['name', 'team_name', 'total_runs'];
const BOWLING_REQUIRED = ['name', 'team_name', 'total_wickets'];

const INT_FIELDS = new Set(['mat', 'inns', 'runs', 'balls', 'no', 'fours', 'sixes', 'fifties', 'hundreds', 'wickets', 'maidens']);
const FLOAT_FIELDS = new Set(['avg', 'sr', 'econ', 'overs']);

// Column aliases for reading tournament metadata out of data rows
const TOURNAMENT_ID_ALIASES   = ['tournament_id', 'tournamentid', 'tournament_code', 'tourney_id'];
const TOURNAMENT_NAME_ALIASES = ['tournament_name', 'tournamentname', 'tournament', 'tourney_name', 'competition_name'];
const YEAR_ALIASES            = ['year', 'season', 'yr'];

// In-memory store of parsed file data, keyed by sessionId
// Each session: { createdAt, batting: Map<tournamentId, rows[]>, bowling: Map<tournamentId, rows[]> }
const parsedSessions = new Map();

// Clean sessions older than 60 minutes
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, s] of parsedSessions) {
    if (s.createdAt < cutoff) parsedSessions.delete(id);
  }
}, 10 * 60 * 1000);

const upload = multer({ storage: multer.memoryStorage() });

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseFileToRows(buffer, originalname) {
  const ext = path.extname(originalname).toLowerCase();
  if (ext === '.csv') {
    return parse(buffer.toString('utf8'), { columns: true, skip_empty_lines: true, trim: true });
  }
  if (ext === '.xlsx' || ext === '.xls') {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: '' });
  }
  throw new Error(`Unsupported file type: ${ext}. Use .csv, .xlsx, or .xls`);
}

function normalizeKey(k) {
  return k.trim().toLowerCase();
}

function findAlias(normRow, aliases) {
  for (const alias of aliases) {
    const v = normRow[alias];
    if (v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Strip _batting / _bowling suffixes from filename to get a base tournament name
function filenameToBase(filename) {
  let base = path.basename(filename, path.extname(filename));
  base = base.replace(/[-_\s]*(batting|bowling|bat|bowl|stats)[-_\s]*/gi, ' ').trim();
  return base || path.basename(filename, path.extname(filename));
}

// Read tournament metadata from a single row (normalised keys)
function rowTournamentMeta(normRow, fileBase) {
  const tournamentId   = findAlias(normRow, TOURNAMENT_ID_ALIASES)   || slugify(fileBase);
  const tournamentName = findAlias(normRow, TOURNAMENT_NAME_ALIASES)  || fileBase;
  const year           = findAlias(normRow, YEAR_ALIASES)             || String(new Date().getFullYear());
  return {
    tournamentId:   String(tournamentId).trim(),
    tournamentName: String(tournamentName).trim(),
    year:           String(year).trim(),
  };
}

// Group rows from one file by tournament_id, also capturing name & year per group
function groupRowsByTournament(rows, fileBase) {
  // Map: tournamentId → { meta: {id, name, year}, rows: [] }
  const groups = new Map();
  for (const row of rows) {
    const normRow = {};
    for (const [k, v] of Object.entries(row)) normRow[normalizeKey(k)] = v;

    const meta = rowTournamentMeta(normRow, fileBase);
    if (!groups.has(meta.tournamentId)) {
      groups.set(meta.tournamentId, { meta, rows: [] });
    }
    groups.get(meta.tournamentId).rows.push(row);
  }
  return groups;
}

function validateColumns(rows, required, label) {
  if (!rows || rows.length === 0) throw new Error(`${label}: file is empty`);
  const cols = Object.keys(rows[0]).map(c => normalizeKey(c));
  const missing = required.filter(r => !cols.includes(r.toLowerCase()));
  if (missing.length > 0) {
    throw new Error(`${label}: missing required columns: ${missing.join(', ')}`);
  }
}

function mapRow(row, fieldMap) {
  const norm = {};
  for (const [k, v] of Object.entries(row)) norm[normalizeKey(k)] = v;
  const out = {};
  for (const [src, dest] of Object.entries(fieldMap)) {
    const val = norm[src.toLowerCase()];
    if (val === undefined || val === '') continue;
    if (INT_FIELDS.has(dest)) {
      const n = parseInt(val, 10);
      out[dest] = isNaN(n) ? 0 : n;
    } else if (FLOAT_FIELDS.has(dest)) {
      const f = parseFloat(val);
      out[dest] = isNaN(f) ? 0 : f;
    } else {
      out[dest] = String(val).trim();
    }
  }
  return out;
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// GET /api/competitions
app.get('/api/competitions', (_req, res) => res.json(COMPETITIONS));

/**
 * POST /api/parse-files
 * Accepts: multipart with batting_files[] and bowling_files[]
 * Returns: sessionId + list of detected tournaments (id, name, year, battingCount, bowlingCount)
 */
app.post('/api/parse-files', upload.fields([
  { name: 'batting_files', maxCount: 50 },
  { name: 'bowling_files', maxCount: 50 },
]), (req, res) => {
  try {
    const battingFiles = req.files['batting_files'] || [];
    const bowlingFiles = req.files['bowling_files'] || [];
    const logs = [];

    if (battingFiles.length === 0 && bowlingFiles.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Aggregate batting rows grouped by tournamentId across all uploaded batting files
    const allBatting = new Map(); // tournamentId → { meta, rows[] }
    for (const file of battingFiles) {
      logs.push(`Reading batting file: ${file.originalname}`);
      const rows = parseFileToRows(file.buffer, file.originalname);
      validateColumns(rows, BATTING_REQUIRED, `Batting (${file.originalname})`);
      logs.push(`  → ${rows.length} records found`);

      const fileBase = filenameToBase(file.originalname);
      const groups = groupRowsByTournament(rows, fileBase);

      for (const [tid, group] of groups) {
        if (!allBatting.has(tid)) {
          allBatting.set(tid, { meta: group.meta, rows: [] });
        }
        allBatting.get(tid).rows.push(...group.rows);
        logs.push(`  → Tournament detected: "${group.meta.tournamentName}" (${tid}) — ${group.rows.length} batting rows`);
      }
    }

    // Aggregate bowling rows
    const allBowling = new Map(); // tournamentId → { meta, rows[] }
    for (const file of bowlingFiles) {
      logs.push(`Reading bowling file: ${file.originalname}`);
      const rows = parseFileToRows(file.buffer, file.originalname);
      validateColumns(rows, BOWLING_REQUIRED, `Bowling (${file.originalname})`);
      logs.push(`  → ${rows.length} records found`);

      const fileBase = filenameToBase(file.originalname);
      const groups = groupRowsByTournament(rows, fileBase);

      for (const [tid, group] of groups) {
        if (!allBowling.has(tid)) {
          allBowling.set(tid, { meta: group.meta, rows: [] });
        }
        allBowling.get(tid).rows.push(...group.rows);
        logs.push(`  → Tournament detected: "${group.meta.tournamentName}" (${tid}) — ${group.rows.length} bowling rows`);
      }
    }

    // Merge all known tournament IDs
    const allIds = new Set([...allBatting.keys(), ...allBowling.keys()]);
    const tournaments = [];
    for (const tid of allIds) {
      const bMeta = allBatting.get(tid)?.meta;
      const wMeta = allBowling.get(tid)?.meta;
      const meta = bMeta || wMeta;
      tournaments.push({
        tournamentId:   meta.tournamentId,
        tournamentName: meta.tournamentName,
        year:           meta.year,
        battingCount:   allBatting.get(tid)?.rows.length ?? 0,
        bowlingCount:   allBowling.get(tid)?.rows.length ?? 0,
        status:         'on-going',
      });
    }

    // Sort by year desc, then name
    tournaments.sort((a, b) => b.year.localeCompare(a.year) || a.tournamentName.localeCompare(b.tournamentName));

    // Store parsed data in session
    const sessionId = crypto.randomBytes(8).toString('hex');
    parsedSessions.set(sessionId, {
      createdAt: Date.now(),
      batting: allBatting,
      bowling: allBowling,
    });

    logs.push(`Detected ${tournaments.length} tournament(s) across all uploaded files`);
    res.json({ sessionId, tournaments, logs });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/generate
 * Body: { sessionId, competition, tournaments: [{tournamentId, tournamentName, year, status}] }
 * Uses the server-stored parsed data from sessionId.
 */
app.post('/api/generate', express.json(), (req, res) => {
  try {
    const { sessionId, competition, tournaments } = req.body;

    if (!sessionId || !parsedSessions.has(sessionId)) {
      return res.status(400).json({ error: 'Session expired or not found. Please re-upload your files.' });
    }
    if (!competition || !COMPETITIONS[competition]) {
      return res.status(400).json({ error: 'Invalid competition' });
    }
    if (!tournaments || tournaments.length === 0) {
      return res.status(400).json({ error: 'No tournaments provided' });
    }

    const session = parsedSessions.get(sessionId);
    const config = COMPETITIONS[competition];
    const logs = [];
    const dataEntries = [];

    logs.push(`Generating JSON for: ${competition} (${config.fullName})`);

    for (const t of tournaments) {
      logs.push(`Processing tournament: ${t.tournamentName} (${t.tournamentId})`);

      const rawBatting = session.batting.get(t.tournamentId)?.rows || [];
      const rawBowling = session.bowling.get(t.tournamentId)?.rows || [];

      if (rawBatting.length === 0) logs.push(`  Warning: no batting records for ${t.tournamentId}`);
      if (rawBowling.length === 0) logs.push(`  Warning: no bowling records for ${t.tournamentId}`);

      const batting = rawBatting.map((row, i) => ({ rank: i + 1, ...mapRow(row, BATTING_MAP) }));
      const bowling = rawBowling.map((row, i) => ({ rank: i + 1, ...mapRow(row, BOWLING_MAP) }));

      logs.push(`  Batting: ${batting.length} records | Bowling: ${bowling.length} records`);

      dataEntries.push({
        year:           t.year,
        tournamentId:   t.tournamentId,
        tournamentName: t.tournamentName,
        status:         t.status || 'on-going',
        batting,
        bowling,
      });
    }

    const now = new Date().toISOString();
    const result = {
      competition,
      fullName: config.fullName,
      lastUpdated: now,
      data: dataEntries,
    };

    const totalBatting = dataEntries.reduce((s, e) => s + e.batting.length, 0);
    const totalBowling = dataEntries.reduce((s, e) => s + e.bowling.length, 0);

    logs.push(`JSON generated successfully`);
    logs.push(`Tournaments: ${dataEntries.length} | Batting: ${totalBatting} | Bowling: ${totalBowling}`);

    res.json({
      success: true,
      logs,
      json: result,
      summary: {
        competition,
        fullName: config.fullName,
        outputFileName: config.outputFileName,
        tournamentsCount: dataEntries.length,
        totalBatting,
        totalBowling,
        lastUpdated: now,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/existing-json/:competition
app.get('/api/existing-json/:competition', (req, res) => {
  const competition = decodeURIComponent(req.params.competition);
  const config = COMPETITIONS[competition];
  if (!config) return res.status(400).json({ error: 'Unknown competition' });
  const filePath = path.join(REPO_ROOT, config.targetRepoPath);
  if (!fs.existsSync(filePath)) return res.json({ exists: false });
  try {
    res.json({ exists: true, data: JSON.parse(fs.readFileSync(filePath, 'utf8')) });
  } catch {
    res.status(500).json({ error: 'Failed to read existing JSON' });
  }
});

// POST /api/save-backup-and-replace
app.post('/api/save-backup-and-replace', (req, res) => {
  try {
    const { competition, newJson } = req.body;
    if (!competition || !newJson) return res.status(400).json({ error: 'Missing competition or newJson' });
    const config = COMPETITIONS[competition];
    if (!config) return res.status(400).json({ error: 'Unknown competition' });

    const targetPath  = path.join(REPO_ROOT, config.targetRepoPath);
    const backupDir   = path.join(REPO_ROOT, config.backupDir);
    const logs = [];

    fs.mkdirSync(backupDir, { recursive: true });

    let backupPath = null;
    if (fs.existsSync(targetPath)) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
      const backupName = `${path.basename(config.outputFileName, '.json')}-${dateStr}-${timeStr}.json`;
      backupPath = path.join(backupDir, backupName);
      fs.copyFileSync(targetPath, backupPath);
      logs.push(`Backup created: ${config.backupDir}/${backupName}`);
    } else {
      logs.push('No existing file to backup — creating new file');
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, JSON.stringify(newJson, null, 2), 'utf8');
    logs.push(`Repo JSON replaced: ${config.targetRepoPath}`);

    res.json({ success: true, logs, backupPath: backupPath ? path.relative(REPO_ROOT, backupPath) : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/push-github
app.post('/api/push-github', (req, res) => {
  const { competition } = req.body;
  if (!competition || !COMPETITIONS[competition]) {
    return res.status(400).json({ error: 'Unknown competition' });
  }
  const config = COMPETITIONS[competition];
  const logs = [];
  try {
    const today = new Date().toISOString().slice(0, 10);

    logs.push('Running: git pull origin main');
    execSync('git pull origin main', { cwd: REPO_ROOT, stdio: 'pipe' });
    logs.push('git pull completed');

    logs.push(`Running: git add ${config.targetRepoPath}`);
    execSync(`git add "${config.targetRepoPath}"`, { cwd: REPO_ROOT, stdio: 'pipe' });

    logs.push(`Running: git add ${config.backupDir}/`);
    execSync(`git add "${config.backupDir}/"`, { cwd: REPO_ROOT, stdio: 'pipe' });

    const commitMsg = `Update ${competition} stats JSON - ${today}`;
    logs.push(`Running: git commit -m "${commitMsg}"`);
    execSync(`git commit -m "${commitMsg}"`, { cwd: REPO_ROOT, stdio: 'pipe' });
    logs.push('Commit created');

    logs.push('Running: git push origin main');
    execSync('git push origin main', { cwd: REPO_ROOT, stdio: 'pipe' });
    logs.push('Git push completed successfully');

    res.json({ success: true, logs });
  } catch (err) {
    const detail = err.stderr?.toString() || err.stdout?.toString() || err.message;
    logs.push(`Error: ${detail}`);
    res.status(500).json({ error: detail, logs });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Stats Generator backend running on http://localhost:${PORT}`);
  console.log(`Repo root: ${REPO_ROOT}`);
});
