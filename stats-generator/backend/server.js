const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { parse }    = require('csv-parse/sync');
const XLSX         = require('xlsx');
const { execSync } = require('child_process');
const crypto       = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const REPO_ROOT    = process.env.REPO_ROOT    || path.resolve(__dirname, '../..');
const CONFIG_PATH  = process.env.CONFIG_PATH  || path.resolve(__dirname, '../tournament-config.json');

// ─── Config (reloaded each request so the user can edit without restarting) ──
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    throw new Error(`Cannot read tournament-config.json: ${e.message}`);
  }
}

// ─── Field maps ──────────────────────────────────────────────────────────────
const BATTING_MAP = {
  name:         'player',
  team_name:    'team',
  batting_hand: 'hand',
  total_match:  'mat',
  innings:      'inns',
  total_runs:   'runs',
  ball_faced:   'balls',
  highest_run:  'highest',
  not_out:      'no',
  average:      'avg',
  strike_rate:  'sr',
  '4s':         'fours',
  '6s':         'sixes',
  '50s':        'fifties',
  '100s':       'hundreds',
};

const BOWLING_MAP = {
  name:            'player',
  team_name:       'team',
  bowling_style:   'style',
  total_match:     'mat',
  innings:         'inns',
  overs:           'overs',
  runs:            'runs',
  total_wickets:   'wickets',
  highest_wicket:  'highest',
  maidens:         'maidens',
  avg:             'avg',
  economy:         'econ',
};

const BATTING_REQUIRED = ['name', 'team_name', 'total_runs'];
const BOWLING_REQUIRED = ['name', 'team_name', 'total_wickets'];

const INT_FIELDS   = new Set(['mat','inns','runs','balls','no','fours','sixes','fifties','hundreds','wickets','maidens']);
const FLOAT_FIELDS = new Set(['avg','sr','econ','overs']);

// ─── In-memory parse sessions (TTL 60 min) ───────────────────────────────────
const sessions = new Map();
setInterval(() => {
  const cut = Date.now() - 60 * 60 * 1000;
  for (const [id, s] of sessions) if (s.createdAt < cut) sessions.delete(id);
}, 10 * 60 * 1000);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const upload = multer({ storage: multer.memoryStorage() });

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

function normalizeKey(k) { return k.trim().toLowerCase(); }

function validateColumns(rows, required, label) {
  if (!rows || rows.length === 0) throw new Error(`${label}: file is empty`);
  const cols = Object.keys(rows[0]).map(normalizeKey);
  const missing = required.filter(r => !cols.includes(r));
  if (missing.length) throw new Error(`${label}: missing columns: ${missing.join(', ')}`);
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

/**
 * Extract the leading numeric source ID from a filename.
 * "1986843_batting_leaderboard.csv" → "1986843"
 * Falls back to the full basename if no numeric prefix found.
 */
function extractSourceId(filename) {
  const base = path.basename(filename, path.extname(filename));
  const m = base.match(/^(\d+)/);
  return m ? m[1] : base;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/tournament-config  – lets the frontend read the current config
app.get('/api/tournament-config', (_req, res) => {
  try {
    res.json(loadConfig());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/parse-files
 * Multipart body:
 *   competition  – "SG IA" | "BPL" | …
 *   batting_files[]
 *   bowling_files[]
 *
 * Returns:
 *   sessionId, tournaments[], warnings[], errors[]
 *
 * Tournament shape:
 *   { sourceId, meta, hasBatting, hasBowling, battingCount, bowlingCount }
 *   meta = config entry (or null if unknown)
 */
app.post('/api/parse-files', upload.fields([
  { name: 'batting_files', maxCount: 50 },
  { name: 'bowling_files', maxCount: 50 },
]), (req, res) => {
  try {
    const competition  = req.body.competition;
    const battingFiles = req.files['batting_files'] || [];
    const bowlingFiles = req.files['bowling_files'] || [];
    const config       = loadConfig();
    const compConfig   = config[competition];
    const logs         = [];
    const warnings     = [];
    const errors       = [];

    if (!compConfig) return res.status(400).json({ error: `Unknown competition: ${competition}` });
    if (!battingFiles.length && !bowlingFiles.length) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // sourceId → { battingRows: [], bowlingRows: [], battingFiles: [], bowlingFiles: [] }
    const bySource = new Map();

    function ensureSource(id) {
      if (!bySource.has(id)) bySource.set(id, { battingRows: [], bowlingRows: [], battingFiles: [], bowlingFiles: [] });
      return bySource.get(id);
    }

    // Parse batting files
    for (const file of battingFiles) {
      const sid = extractSourceId(file.originalname);
      logs.push(`Reading batting file: ${file.originalname} → source ID: ${sid}`);
      const rows = parseFileToRows(file.buffer, file.originalname);
      validateColumns(rows, BATTING_REQUIRED, `Batting (${file.originalname})`);
      logs.push(`  ✓ ${rows.length} batting records`);
      const bucket = ensureSource(sid);
      bucket.battingRows.push(...rows);
      bucket.battingFiles.push(file.originalname);
    }

    // Parse bowling files
    for (const file of bowlingFiles) {
      const sid = extractSourceId(file.originalname);
      logs.push(`Reading bowling file: ${file.originalname} → source ID: ${sid}`);
      const rows = parseFileToRows(file.buffer, file.originalname);
      validateColumns(rows, BOWLING_REQUIRED, `Bowling (${file.originalname})`);
      logs.push(`  ✓ ${rows.length} bowling records`);
      const bucket = ensureSource(sid);
      bucket.bowlingRows.push(...rows);
      bucket.bowlingFiles.push(file.originalname);
    }

    // Build tournament list with validation
    const tournaments = [];
    for (const [sid, bucket] of bySource) {
      const meta = compConfig.tournaments[sid] || null;

      if (!meta) {
        warnings.push(`Unknown tournament source ID: ${sid}. Add it to tournament-config.json before generating.`);
      }

      if (bucket.battingRows.length > 0 && bucket.bowlingRows.length === 0) {
        errors.push(`Source ID ${sid}: batting file uploaded but bowling file is missing.`);
      }
      if (bucket.bowlingRows.length > 0 && bucket.battingRows.length === 0) {
        errors.push(`Source ID ${sid}: bowling file uploaded but batting file is missing.`);
      }

      tournaments.push({
        sourceId:     sid,
        meta,
        hasBatting:   bucket.battingRows.length > 0,
        hasBowling:   bucket.bowlingRows.length > 0,
        battingCount: bucket.battingRows.length,
        bowlingCount: bucket.bowlingRows.length,
        battingFiles: bucket.battingFiles,
        bowlingFiles: bucket.bowlingFiles,
      });
    }

    // Sort by year desc, then name
    tournaments.sort((a, b) => {
      const ay = a.meta?.year || '0';
      const by = b.meta?.year || '0';
      return by.localeCompare(ay) || (a.meta?.tournamentName || a.sourceId).localeCompare(b.meta?.tournamentName || b.sourceId);
    });

    // Store in session
    const sessionId = crypto.randomBytes(8).toString('hex');
    sessions.set(sessionId, { createdAt: Date.now(), bySource, competition });

    logs.push(`Detected ${tournaments.length} tournament source(s)`);
    res.json({ sessionId, tournaments, logs, warnings, errors });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/generate
 * Body: { sessionId, competition }
 * Uses stored session. Fails fast if any tournament has no config entry or unmatched files.
 */
app.post('/api/generate', (req, res) => {
  try {
    const { sessionId, competition } = req.body;

    if (!sessionId || !sessions.has(sessionId)) {
      return res.status(400).json({ error: 'Session expired. Please re-upload your files.' });
    }

    const session    = sessions.get(sessionId);
    const config     = loadConfig();
    const compConfig = config[competition];
    if (!compConfig) return res.status(400).json({ error: `Unknown competition: ${competition}` });

    const logs   = [];
    const data   = [];
    const { bySource } = session;

    logs.push(`Building JSON for: ${competition} (${compConfig.fullName})`);

    for (const [sid, bucket] of bySource) {
      const meta = compConfig.tournaments[sid];
      if (!meta) {
        return res.status(400).json({
          error: `Cannot generate: source ID "${sid}" is not in tournament-config.json. Add it first.`,
        });
      }
      if (bucket.battingRows.length === 0) {
        return res.status(400).json({ error: `Source ID ${sid} (${meta.tournamentName}): batting file is missing.` });
      }
      if (bucket.bowlingRows.length === 0) {
        return res.status(400).json({ error: `Source ID ${sid} (${meta.tournamentName}): bowling file is missing.` });
      }

      const batting = bucket.battingRows.map((r, i) => ({ rank: i + 1, ...mapRow(r, BATTING_MAP) }));
      const bowling = bucket.bowlingRows.map((r, i) => ({ rank: i + 1, ...mapRow(r, BOWLING_MAP) }));

      logs.push(`  ${meta.tournamentName}: ${batting.length} batting, ${bowling.length} bowling`);
      data.push({
        year:           meta.year,
        tournamentId:   meta.tournamentId,
        tournamentName: meta.tournamentName,
        status:         meta.status,
        batting,
        bowling,
      });
    }

    // Sort tournaments by year desc
    data.sort((a, b) => b.year.localeCompare(a.year));

    const now    = new Date().toISOString();
    const result = {
      competition:  compConfig.competition,
      fullName:     compConfig.fullName,
      lastUpdated:  now,
      data,
    };

    const totalBatting = data.reduce((s, e) => s + e.batting.length, 0);
    const totalBowling = data.reduce((s, e) => s + e.bowling.length, 0);

    logs.push(`JSON generated — ${data.length} tournaments, ${totalBatting} batting, ${totalBowling} bowling`);

    res.json({
      success: true,
      logs,
      json: result,
      summary: {
        competition,
        fullName:        compConfig.fullName,
        outputFileName:  compConfig.outputFileName,
        tournamentsCount: data.length,
        totalBatting,
        totalBowling,
        lastUpdated: now,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/save-backup-and-replace
app.post('/api/save-backup-and-replace', (req, res) => {
  try {
    const { competition, newJson } = req.body;
    const config     = loadConfig();
    const compConfig = config[competition];
    if (!compConfig) return res.status(400).json({ error: `Unknown competition: ${competition}` });

    const targetPath = path.join(REPO_ROOT, compConfig.targetRepoPath);
    const backupDir  = path.join(REPO_ROOT, compConfig.backupDir);
    const logs = [];

    fs.mkdirSync(backupDir, { recursive: true });

    let backupRelPath = null;
    if (fs.existsSync(targetPath)) {
      const now      = new Date();
      const dateStr  = now.toISOString().slice(0, 10);
      const timeStr  = now.toTimeString().slice(0, 5).replace(':', '');
      const name     = `${path.basename(compConfig.outputFileName, '.json')}-${dateStr}-${timeStr}.json`;
      const fullPath = path.join(backupDir, name);
      fs.copyFileSync(targetPath, fullPath);
      backupRelPath = path.relative(REPO_ROOT, fullPath);
      logs.push(`Backup created: ${backupRelPath}`);
    } else {
      logs.push('No existing file found — creating new file');
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, JSON.stringify(newJson, null, 2), 'utf8');
    logs.push(`Repo file updated: ${compConfig.targetRepoPath}`);

    res.json({ success: true, logs, backupPath: backupRelPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/register-tournament
 * Body: { competition, sourceId, year, tournamentId, tournamentName, status }
 * Saves a new tournament entry to tournament-config.json so the generator can proceed.
 */
app.post('/api/register-tournament', (req, res) => {
  try {
    const { competition, sourceId, year, tournamentId, tournamentName, status } = req.body;
    if (!competition || !sourceId || !year || !tournamentId || !tournamentName || !status) {
      return res.status(400).json({ error: 'All fields are required: competition, sourceId, year, tournamentId, tournamentName, status' });
    }
    const slugOk = /^[a-z0-9-]+$/.test(tournamentId);
    if (!slugOk) return res.status(400).json({ error: 'Tournament ID slug must be lowercase letters, numbers, and hyphens only.' });

    const config = loadConfig();
    if (!config[competition]) return res.status(400).json({ error: `Unknown competition: ${competition}` });

    config[competition].tournaments[sourceId] = { year: String(year), tournamentId, tournamentName, status };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');

    res.json({ success: true, meta: config[competition].tournaments[sourceId] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/push-github
app.post('/api/push-github', (req, res) => {
  try {
    const { competition } = req.body;
    const config     = loadConfig();
    const compConfig = config[competition];
    if (!compConfig) return res.status(400).json({ error: `Unknown competition: ${competition}` });

    const today      = new Date().toISOString().slice(0, 10);
    const logs       = [];
    const targetPath = path.join(REPO_ROOT, compConfig.targetRepoPath);

    const run = (cmd) => {
      logs.push(`$ ${cmd}`);
      execSync(cmd, { cwd: REPO_ROOT, stdio: 'pipe' });
    };

    // Save generated content before syncing — fetch+reset clears untracked conflicts
    if (!fs.existsSync(targetPath)) {
      return res.status(400).json({ error: 'Generated file not found. Please generate first.' });
    }
    const generatedContent = fs.readFileSync(targetPath, 'utf8');

    run('git fetch origin main');
    run('git reset --hard FETCH_HEAD');
    logs.push('  ✓ synced with remote');

    // Restore the generated file and commit
    fs.writeFileSync(targetPath, generatedContent, 'utf8');
    run(`git add "${compConfig.targetRepoPath}"`);

    // git commit exits 1 with "nothing to commit" when content is unchanged — treat as success
    let committed = false;
    try {
      execSync(`git commit -m "Update ${competition} stats JSON - ${today}"`, { cwd: REPO_ROOT, stdio: 'pipe' });
      logs.push('  ✓ commit created');
      committed = true;
    } catch (commitErr) {
      const out = (commitErr.stdout?.toString() || '') + (commitErr.stderr?.toString() || '');
      if (out.includes('nothing to commit')) {
        logs.push('  ℹ no changes — stats already up to date on remote');
      } else {
        throw commitErr;
      }
    }

    if (committed) {
      run('git push origin main');
      logs.push('  ✓ push done');
    }

    res.json({ success: true, logs });
  } catch (err) {
    const detail = err.stderr?.toString() || err.stdout?.toString() || err.message;
    res.status(500).json({ error: detail });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Stats Generator backend  →  http://localhost:${PORT}`);
  console.log(`Repo root                →  ${REPO_ROOT}`);
  console.log(`Config                   →  ${CONFIG_PATH}`);
});
