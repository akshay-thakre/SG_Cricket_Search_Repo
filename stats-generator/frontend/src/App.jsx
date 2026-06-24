import { useState, useRef, useCallback } from 'react';

// Only the competitions shown in UI — add more here as needed
const COMPETITIONS = [
  { key: 'SG IA', label: 'SG IA Competition',  accent: '#0ea5e9' },
  { key: 'BPL',   label: 'BPL Competition',     accent: '#a855f7' },
];

// ─── Shared helpers ───────────────────────────────────────────────────────────

function logType(msg) {
  const m = msg.toLowerCase();
  if (m.includes('error') || m.includes('missing') || m.includes('cannot')) return 'error';
  if (m.includes('✓') || m.includes('success') || m.includes('done') || m.includes('generated')) return 'success';
  if (m.includes('warning') || m.includes('unknown')) return 'warn';
  if (m.startsWith('$') || m.includes('running')) return 'action';
  return 'info';
}

function LogPanel({ logs }) {
  const ref = useRef(null);
  if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  if (!logs.length) return null;
  return (
    <div className="log-panel" ref={ref}>
      {logs.map((l, i) => (
        <div key={i} className={`log-entry ${l.type}`}>{l.msg}</div>
      ))}
    </div>
  );
}

function MultiFileButton({ label, files, onChange, accent }) {
  const ref = useRef(null);
  function handleChange(e) {
    const picked = Array.from(e.target.files);
    onChange(prev => {
      const existing = new Set(prev.map(f => f.name));
      return [...prev, ...picked.filter(f => !existing.has(f.name))];
    });
    e.target.value = '';
  }
  function removeFile(name) {
    onChange(prev => prev.filter(f => f.name !== name));
  }

  const onDrop = useCallback(e => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter(f =>
      ['.csv', '.xlsx', '.xls'].some(ext => f.name.toLowerCase().endsWith(ext))
    );
    if (dropped.length) onChange(prev => {
      const existing = new Set(prev.map(f => f.name));
      return [...prev, ...dropped.filter(f => !existing.has(f.name))];
    });
  }, [onChange]);

  return (
    <div className="mfb-wrap">
      <div
        className={`mfb-dropzone ${files.length > 0 ? 'has-files' : ''}`}
        style={{ '--accent': accent }}
        onDragOver={e => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => ref.current?.click()}
      >
        <input ref={ref} type="file" multiple accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleChange} />
        <span className="mfb-icon">📂</span>
        <span className="mfb-label">{label}</span>
        <span className="mfb-hint">
          {files.length === 0
            ? 'Click or drag files here (CSV / Excel, multiple allowed)'
            : `${files.length} file${files.length > 1 ? 's' : ''} selected — click to add more`}
        </span>
      </div>
      {files.length > 0 && (
        <ul className="mfb-filelist">
          {files.map(f => (
            <li key={f.name}>
              <span className="mfb-filename">{f.name}</span>
              <button className="mfb-remove" onClick={e => { e.stopPropagation(); removeFile(f.name); }} title="Remove">×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Inline form to register an unknown tournament source ID
function RegisterForm({ sourceId, competition, onRegistered }) {
  const [form, setForm] = useState({ year: '', tournamentId: '', tournamentName: '', status: 'on-going' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function set(field, val) { setForm(prev => ({ ...prev, [field]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      const resp = await fetch('/api/register-tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competition, sourceId, ...form }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Register failed');
      onRegistered(sourceId, data.meta);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="register-form" onSubmit={handleSubmit}>
      <div className="register-form-title">Register Tournament — Source ID: <code>{sourceId}</code></div>
      <div className="register-fields">
        <label>
          Year
          <input required placeholder="e.g. 2025" value={form.year} onChange={e => set('year', e.target.value)} />
        </label>
        <label>
          Tournament Name
          <input required placeholder="e.g. BPL 2025" value={form.tournamentName} onChange={e => set('tournamentName', e.target.value)} />
        </label>
        <label>
          ID Slug <span className="field-hint">(lowercase, hyphens only)</span>
          <input required placeholder="e.g. bpl-2025" value={form.tournamentId} onChange={e => set('tournamentId', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />
        </label>
        <label>
          Status
          <select value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="on-going">On-going</option>
            <option value="completed">Completed</option>
          </select>
        </label>
      </div>
      {err && <div className="register-error">{err}</div>}
      <button className="btn btn-register" type="submit" disabled={saving}>
        {saving ? 'Registering…' : 'Register & Continue'}
      </button>
    </form>
  );
}

// Pairing status table shown after parsing
function PairingStatus({ tournaments, competition, onTournamentRegistered }) {
  if (!tournaments || tournaments.length === 0) return null;
  return (
    <div className="pairing-table-wrap">
      <table className="pairing-table">
        <thead>
          <tr>
            <th>Source ID</th>
            <th>Tournament</th>
            <th>Year</th>
            <th>Batting</th>
            <th>Bowling</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tournaments.map(t => {
            const ok = t.meta && t.hasBatting && t.hasBowling;
            const unknownMeta = !t.meta;
            const missingFile = t.meta && (!t.hasBatting || !t.hasBowling);
            return (
              <>
                <tr key={t.sourceId} className={ok ? 'row-ok' : 'row-err'}>
                  <td className="sid">{t.sourceId}</td>
                  <td>{t.meta ? t.meta.tournamentName : <span className="unknown-label">Unknown — fill in details below</span>}</td>
                  <td>{t.meta?.year || '—'}</td>
                  <td><span className={`pill ${t.hasBatting ? 'pill-green' : 'pill-red'}`}>{t.battingCount}</span></td>
                  <td><span className={`pill ${t.hasBowling ? 'pill-green' : 'pill-red'}`}>{t.bowlingCount}</span></td>
                  <td>
                    {ok          && <span className="status-ok">✓ Ready</span>}
                    {unknownMeta && <span className="status-err">✗ Unknown ID</span>}
                    {missingFile && <span className="status-err">✗ {!t.hasBatting ? 'Batting missing' : 'Bowling missing'}</span>}
                  </td>
                </tr>
                {unknownMeta && (
                  <tr key={`${t.sourceId}-register`} className="row-register">
                    <td colSpan={6} style={{ padding: 0 }}>
                      <RegisterForm
                        sourceId={t.sourceId}
                        competition={competition}
                        onRegistered={onTournamentRegistered}
                      />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SummaryBar({ summary }) {
  if (!summary) return null;
  const items = [
    { label: 'Output file',       value: summary.outputFileName },
    { label: 'Tournaments',       value: summary.tournamentsCount },
    { label: 'Batting records',   value: summary.totalBatting },
    { label: 'Bowling records',   value: summary.totalBowling },
    { label: 'Last updated',      value: new Date(summary.lastUpdated).toLocaleString() },
  ];
  return (
    <div className="summary-bar">
      {items.map(item => (
        <div key={item.label} className="summary-cell">
          <div className="summary-label">{item.label}</div>
          <div className="summary-value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Per-competition section ──────────────────────────────────────────────────

function CompetitionSection({ compKey, label, accent }) {
  const [battingFiles,  setBattingFiles]  = useState([]);
  const [bowlingFiles,  setBowlingFiles]  = useState([]);
  const [parsing,       setParsing]       = useState(false);
  const [sessionId,     setSessionId]     = useState(null);
  const [tournaments,   setTournaments]   = useState(null);   // null = not yet parsed
  const [generating,    setGenerating]    = useState(false);
  const [generatedJson, setGeneratedJson] = useState(null);
  const [summary,       setSummary]       = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [pushing,       setPushing]       = useState(false);
  const [backupPath,    setBackupPath]    = useState(null);
  const [showJson,      setShowJson]      = useState(false);
  const [logs,          setLogs]          = useState([]);
  const [warnings,      setWarnings]      = useState([]);
  const [errors,        setErrors]        = useState([]);

  function addLog(msg, type) {
    setLogs(prev => [...prev, { msg, type: type || logType(msg) }]);
  }

  function resetGenerated() {
    setGeneratedJson(null);
    setSummary(null);
    setSaved(false);
    setBackupPath(null);
    setShowJson(false);
  }

  // Called whenever files change — re-parse automatically if we already have a session
  function handleBattingChange(updater) {
    setBattingFiles(updater);
    setTournaments(null);
    setSessionId(null);
    resetGenerated();
  }
  function handleBowlingChange(updater) {
    setBowlingFiles(updater);
    setTournaments(null);
    setSessionId(null);
    resetGenerated();
  }

  async function handleParse() {
    if (!battingFiles.length && !bowlingFiles.length) {
      setErrors(['Upload at least one batting or bowling file.']);
      return;
    }
    setLogs([]);
    setWarnings([]);
    setErrors([]);
    setTournaments(null);
    setSessionId(null);
    resetGenerated();
    setParsing(true);
    addLog(`Reading files for ${compKey}...`, 'action');

    try {
      const form = new FormData();
      form.append('competition', compKey);
      battingFiles.forEach(f => form.append('batting_files', f));
      bowlingFiles.forEach(f => form.append('bowling_files', f));

      const resp = await fetch('/api/parse-files', { method: 'POST', body: form });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Parse failed');

      data.logs?.forEach(msg => addLog(msg));
      setWarnings(data.warnings || []);
      setErrors(data.errors || []);
      setSessionId(data.sessionId);
      setTournaments(data.tournaments || []);

      if (!data.errors?.length && !data.warnings?.length) {
        addLog(`All ${data.tournaments.length} tournament(s) ready — click Generate`, 'success');
      }
    } catch (e) {
      addLog(e.message, 'error');
      setErrors([e.message]);
    } finally {
      setParsing(false);
    }
  }

  async function handleGenerate() {
    if (!sessionId) { setErrors(['Parse files first.']); return; }
    setLogs([]);
    setWarnings([]);
    setErrors([]);
    resetGenerated();
    setGenerating(true);
    addLog(`Generating ${compKey} JSON...`, 'action');

    try {
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, competition: compKey }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Generate failed');

      data.logs?.forEach(msg => addLog(msg));
      setGeneratedJson(data.json);
      setSummary(data.summary);
      addLog(`JSON generated successfully — ${data.summary.outputFileName}`, 'success');
    } catch (e) {
      addLog(e.message, 'error');
      setErrors([e.message]);
    } finally {
      setGenerating(false);
    }
  }

  function downloadJson() {
    if (!generatedJson || !summary) return;
    const blob = new Blob([JSON.stringify(generatedJson, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = summary.outputFileName;
    a.click();
    URL.revokeObjectURL(url);
    addLog(`Downloaded ${summary.outputFileName}`, 'success');
  }

  async function handleSaveAndReplace() {
    if (!generatedJson) return;
    setSaving(true);
    addLog('Creating backup and replacing repo file...', 'action');
    try {
      const resp = await fetch('/api/save-backup-and-replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competition: compKey, newJson: generatedJson }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Save failed');
      data.logs?.forEach(msg => addLog(msg));
      if (data.backupPath) {
        setBackupPath(data.backupPath);
        addLog(`Backup saved at: ${data.backupPath}`, 'warn');
      }
      setSaved(true);
      addLog('Repo file replaced — ready to push', 'success');
    } catch (e) {
      addLog(e.message, 'error');
      setErrors([e.message]);
    } finally {
      setSaving(false);
    }
  }

  async function handlePush() {
    setPushing(true);
    setErrors([]);
    addLog('Running git push...', 'action');
    try {
      const resp = await fetch('/api/push-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competition: compKey }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Push failed');
      data.logs?.forEach(msg => addLog(msg));
      addLog('Pushed to GitHub successfully', 'success');
    } catch (e) {
      addLog(e.message, 'error');
      setErrors([e.message]);
    } finally {
      setPushing(false);
    }
  }

  // Can generate if: session exists, no errors, every tournament has meta + both files
  const canGenerate = sessionId
    && !errors.length
    && tournaments?.length > 0
    && tournaments.every(t => t.meta && t.hasBatting && t.hasBowling);

  const hasAnyFile = battingFiles.length > 0 || bowlingFiles.length > 0;

  return (
    <div className="comp-section" style={{ '--accent': accent }}>
      <div className="comp-header">
        <span className="comp-accent-bar" />
        <h2>{label}</h2>
      </div>

      {/* Upload row */}
      <div className="upload-row">
        <MultiFileButton
          label={`Upload ${compKey} Batting Files`}
          files={battingFiles}
          onChange={handleBattingChange}
          accent={accent}
        />
        <MultiFileButton
          label={`Upload ${compKey} Bowling Files`}
          files={bowlingFiles}
          onChange={handleBowlingChange}
          accent={accent}
        />
      </div>

      {/* Parse button */}
      {hasAnyFile && !tournaments && (
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-primary" style={{ '--btn-color': accent }} onClick={handleParse} disabled={parsing}>
            {parsing ? <><span className="spinner" /> Detecting Tournaments...</> : 'Detect Tournaments from Files'}
          </button>
        </div>
      )}

      {/* Pairing status */}
      {tournaments !== null && (
        <div className="pairing-section">
          <div className="pairing-title">
            Tournament Detection — {tournaments.length} source{tournaments.length !== 1 ? 's' : ''} found
          </div>
          <PairingStatus
            tournaments={tournaments}
            competition={compKey}
            onTournamentRegistered={(sourceId, meta) => {
              setTournaments(prev => prev.map(t => t.sourceId === sourceId ? { ...t, meta } : t));
              setWarnings(prev => prev.filter(w => !w.includes(sourceId)));
              addLog(`Tournament registered: ${meta.tournamentName} (source ID: ${sourceId})`, 'success');
            }}
          />

          {warnings.length > 0 && (
            <div className="alert-box warn-box">
              <strong>Warnings</strong>
              <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}
          {errors.length > 0 && (
            <div className="alert-box error-box">
              <strong>Errors — fix before generating</strong>
              <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}

          {/* Generate button */}
          <div style={{ marginTop: 16 }}>
            <button
              className="btn btn-generate"
              style={{ '--btn-color': accent }}
              onClick={handleGenerate}
              disabled={!canGenerate || generating}
            >
              {generating
                ? <><span className="spinner" /> Generating...</>
                : `Generate ${compKey} JSON`}
            </button>
            {!canGenerate && !generating && tournaments?.length > 0 && (
              <span className="generate-blocked">
                {' '}Fix warnings/errors above before generating.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Activity log */}
      {logs.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <LogPanel logs={logs} />
        </div>
      )}

      {/* Generated output */}
      {generatedJson && summary && (
        <div className="output-section">
          <div className="output-title">Generated: {summary.outputFileName}</div>
          <SummaryBar summary={summary} />

          <div className="output-actions">
            <button className="btn btn-download" onClick={downloadJson}>
              ↓ Download JSON
            </button>
            <button className="btn btn-ghost" onClick={() => setShowJson(v => !v)}>
              {showJson ? 'Hide Preview' : 'Preview JSON'}
            </button>
          </div>

          {showJson && (
            <div className="json-preview">
              {(() => {
                const s = JSON.stringify(generatedJson, null, 2);
                return s.length > 4000 ? s.slice(0, 4000) + '\n… (truncated)' : s;
              })()}
            </div>
          )}

          <hr className="divider" />

          <div className="push-section">
            {backupPath && (
              <div className="backup-notice">Backup saved: {backupPath}</div>
            )}
            <div className="output-actions">
              <button
                className="btn btn-backup"
                onClick={handleSaveAndReplace}
                disabled={saving || pushing}
              >
                {saving ? <><span className="spinner" /> Saving...</> : 'Backup Old JSON and Replace Repo File'}
              </button>
              <button
                className="btn btn-push"
                onClick={handlePush}
                disabled={!saved || pushing || saving}
                title={!saved ? 'Save & replace the repo file first' : ''}
              >
                {pushing ? <><span className="spinner" /> Pushing...</> : 'Push to GitHub'}
              </button>
            </div>
            {!saved && generatedJson && (
              <p className="push-hint">Save & replace the repo file before pushing to GitHub.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Cricket Stats JSON Generator</h1>
        <p className="app-subtitle">
          Upload batting and bowling files · auto-detect tournaments · generate, backup, and push JSON
        </p>
      </header>

      <div className="config-hint">
        Tournament metadata is stored in <code>stats-generator/tournament-config.json</code>.
        If a new source ID is detected after upload, a registration form will appear inline — no manual file editing needed.
      </div>

      {COMPETITIONS.map(c => (
        <CompetitionSection key={c.key} compKey={c.key} label={c.label} accent={c.accent} />
      ))}
    </div>
  );
}
