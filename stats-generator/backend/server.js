const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const { execSync } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

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

// multer: store in memory
const upload = multer({ storage: multer.memoryStorage() });

function parseFileToRows(buffer, originalname) {
  const ext = path.extname(originalname).toLowerCase();
  if (ext === '.csv') {
    const text = buffer.toString('utf8');
    return parse(text, { columns: true, skip_empty_lines: true, trim: true });
  }
  if (ext === '.xlsx' || ext === '.xls') {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: '' });
  }
  throw new Error(`Unsupported file type: ${ext}. Use .csv, .xlsx, or .xls`);
}

function validateColumns(rows, required, label) {
  if (!rows || rows.length === 0) throw new Error(`${label}: file is empty`);
  const cols = Object.keys(rows[0]).map(c => c.trim().toLowerCase());
  const missing = required.filter(r => !cols.includes(r.toLowerCase()));
  if (missing.length > 0) {
    throw new Error(`${label}: missing required columns: ${missing.join(', ')}`);
  }
}

function normalizeKey(key) {
  return key.trim().toLowerCase();
}

function mapRow(row, fieldMap) {
  const normalized = {};
  for (const [k, v] of Object.entries(row)) {
    normalized[normalizeKey(k)] = v;
  }
  const out = {};
  for (const [src, dest] of Object.entries(fieldMap)) {
    const val = normalized[src.toLowerCase()];
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

function mapBattingRows(rows) {
  return rows.map((row, i) => {
    const mapped = mapRow(row, BATTING_MAP);
    if (!mapped.rank) mapped.rank = i + 1;
    return { rank: i + 1, ...mapped };
  });
}

function mapBowlingRows(rows) {
  return rows.map((row, i) => {
    const mapped = mapRow(row, BOWLING_MAP);
    if (!mapped.rank) mapped.rank = i + 1;
    return { rank: i + 1, ...mapped };
  });
}

// Build multer fields dynamically (up to 20 tournaments)
function buildUploadFields() {
  const fields = [];
  for (let i = 0; i < 20; i++) {
    fields.push({ name: `batting_${i}`, maxCount: 1 });
    fields.push({ name: `bowling_${i}`, maxCount: 1 });
  }
  return fields;
}

// POST /api/generate
app.post('/api/generate', upload.fields(buildUploadFields()), (req, res) => {
  try {
    const tournamentsRaw = req.body.tournaments;
    if (!tournamentsRaw) return res.status(400).json({ error: 'Missing tournaments data' });

    const tournaments = JSON.parse(tournamentsRaw);
    const competition = req.body.competition;

    if (!competition || !COMPETITIONS[competition]) {
      return res.status(400).json({ error: 'Invalid competition' });
    }

    const competitionConfig = COMPETITIONS[competition];
    const logs = [];
    const dataEntries = [];

    logs.push(`Reading competition: ${competition} (${competitionConfig.fullName})`);

    for (let i = 0; i < tournaments.length; i++) {
      const t = tournaments[i];
      logs.push(`Processing tournament ${i + 1}: ${t.tournamentName}`);

      const battingFile = req.files[`batting_${i}`]?.[0];
      const bowlingFile = req.files[`bowling_${i}`]?.[0];

      if (!battingFile) throw new Error(`Tournament "${t.tournamentName}": batting file missing`);
      if (!bowlingFile) throw new Error(`Tournament "${t.tournamentName}": bowling file missing`);

      logs.push(`Validating batting file: ${battingFile.originalname}`);
      const battingRows = parseFileToRows(battingFile.buffer, battingFile.originalname);
      validateColumns(battingRows, BATTING_REQUIRED, `Batting (${t.tournamentName})`);
      logs.push(`Batting file valid — ${battingRows.length} records`);

      logs.push(`Validating bowling file: ${bowlingFile.originalname}`);
      const bowlingRows = parseFileToRows(bowlingFile.buffer, bowlingFile.originalname);
      validateColumns(bowlingRows, BOWLING_REQUIRED, `Bowling (${t.tournamentName})`);
      logs.push(`Bowling file valid — ${bowlingRows.length} records`);

      logs.push(`Generating JSON for ${t.tournamentName}...`);
      const batting = mapBattingRows(battingRows);
      const bowling = mapBowlingRows(bowlingRows);

      dataEntries.push({
        year: t.year,
        tournamentId: t.tournamentId,
        tournamentName: t.tournamentName,
        status: t.status,
        batting,
        bowling,
      });
    }

    const now = new Date().toISOString();
    const result = {
      competition,
      fullName: competitionConfig.fullName,
      lastUpdated: now,
      data: dataEntries,
    };

    const totalBatting = dataEntries.reduce((s, e) => s + e.batting.length, 0);
    const totalBowling = dataEntries.reduce((s, e) => s + e.bowling.length, 0);

    logs.push(`JSON generated successfully`);
    logs.push(`Tournaments: ${dataEntries.length} | Batting records: ${totalBatting} | Bowling records: ${totalBowling}`);

    res.json({
      success: true,
      logs,
      json: result,
      summary: {
        competition,
        fullName: competitionConfig.fullName,
        outputFileName: competitionConfig.outputFileName,
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
  if (!fs.existsSync(filePath)) {
    return res.json({ exists: false });
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json({ exists: true, data });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read existing JSON' });
  }
});

// POST /api/save-backup-and-replace
app.post('/api/save-backup-and-replace', express.json({ limit: '50mb' }), (req, res) => {
  try {
    const { competition, newJson } = req.body;
    if (!competition || !newJson) return res.status(400).json({ error: 'Missing competition or newJson' });

    const config = COMPETITIONS[competition];
    if (!config) return res.status(400).json({ error: 'Unknown competition' });

    const targetPath = path.join(REPO_ROOT, config.targetRepoPath);
    const backupDirPath = path.join(REPO_ROOT, config.backupDir);
    const logs = [];

    fs.mkdirSync(backupDirPath, { recursive: true });

    // Backup existing JSON if it exists
    let backupPath = null;
    if (fs.existsSync(targetPath)) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
      const backupName = `${path.basename(config.outputFileName, '.json')}-${dateStr}-${timeStr}.json`;
      backupPath = path.join(backupDirPath, backupName);
      fs.copyFileSync(targetPath, backupPath);
      logs.push(`Backup created: ${config.backupDir}/${backupName}`);
    } else {
      logs.push('No existing file to backup — creating new file');
    }

    // Ensure target directory exists
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    // Write new JSON
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

    const targetFile = config.targetRepoPath;
    logs.push(`Running: git add ${targetFile}`);
    execSync(`git add "${targetFile}"`, { cwd: REPO_ROOT, stdio: 'pipe' });

    const backupGlob = `${config.backupDir}/`;
    logs.push(`Running: git add ${backupGlob}`);
    execSync(`git add "${backupGlob}"`, { cwd: REPO_ROOT, stdio: 'pipe' });

    const commitMsg = `Update ${competition} stats JSON - ${today}`;
    logs.push(`Running: git commit -m "${commitMsg}"`);
    execSync(`git commit -m "${commitMsg}"`, { cwd: REPO_ROOT, stdio: 'pipe' });
    logs.push('Commit created');

    logs.push('Running: git push origin main');
    execSync('git push origin main', { cwd: REPO_ROOT, stdio: 'pipe' });
    logs.push('Git push completed successfully');

    res.json({ success: true, logs });
  } catch (err) {
    const stderr = err.stderr?.toString() || '';
    const stdout = err.stdout?.toString() || '';
    const detail = stderr || stdout || err.message;
    logs.push(`Error: ${detail}`);
    res.status(500).json({ error: detail, logs });
  }
});

// GET /api/competitions
app.get('/api/competitions', (req, res) => {
  res.json(COMPETITIONS);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Stats Generator backend running on http://localhost:${PORT}`);
  console.log(`Repo root: ${REPO_ROOT}`);
});
