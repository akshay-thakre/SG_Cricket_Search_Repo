import { useState, useRef, useCallback } from 'react';

const COMPETITIONS = {
  'SG IA': { fullName: 'Singapore Indian Association', outputFileName: 'sgiaStats.json' },
  'BPL':   { fullName: 'Bengali Premier League',       outputFileName: 'bplStats.json' },
  'YPL':   { fullName: 'Young Premier League',         outputFileName: 'yplStats.json' },
  'SCA':   { fullName: 'Singapore Cricket Association', outputFileName: 'scaStats.json' },
};

const STATUS_OPTIONS = ['on-going', 'completed', 'upcoming'];

// ─── Sub-components ──────────────────────────────────────────────────────────

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

function FileDropZone({ label, accept, multiple, files, onChange }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f =>
      ['.csv', '.xlsx', '.xls'].some(ext => f.name.toLowerCase().endsWith(ext))
    );
    if (dropped.length) onChange(multiple ? dropped : [dropped[0]]);
  }, [multiple, onChange]);

  function handleChange(e) {
    const picked = Array.from(e.target.files);
    onChange(multiple ? picked : [picked[0]]);
    e.target.value = '';
  }

  return (
    <div
      className={`dropzone ${dragging ? 'dragging' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <div className="dropzone-icon">📂</div>
      <div className="dropzone-label">{label}</div>
      <div className="dropzone-hint">
        {files.length === 0
          ? 'Click or drag & drop CSV / Excel files here'
          : `${files.length} file${files.length > 1 ? 's' : ''} selected`}
      </div>
      {files.length > 0 && (
        <ul className="file-list">
          {files.map((f, i) => (
            <li key={i} onClick={e => e.stopPropagation()}>
              <span className="file-chip">{f.name}</span>
              <button
                className="remove-file-btn"
                onClick={e => { e.stopPropagation(); onChange(files.filter((_, j) => j !== i)); }}
              >×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TournamentReviewTable({ tournaments, onChange }) {
  function update(index, field, value) {
    onChange(tournaments.map((t, i) => i === index ? { ...t, [field]: value } : t));
  }

  return (
    <div className="review-table-wrap">
      <table className="review-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Tournament ID</th>
            <th>Tournament Name</th>
            <th>Year</th>
            <th>Batting</th>
            <th>Bowling</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tournaments.map((t, i) => (
            <tr key={t.tournamentId + i}>
              <td style={{ color: '#64748b' }}>{i + 1}</td>
              <td>
                <input
                  type="text"
                  className="inline-input"
                  value={t.tournamentId}
                  onChange={e => update(i, 'tournamentId', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="inline-input wide"
                  value={t.tournamentName}
                  onChange={e => update(i, 'tournamentName', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="inline-input narrow"
                  value={t.year}
                  onChange={e => update(i, 'year', e.target.value)}
                />
              </td>
              <td>
                <span className={`count-badge ${t.battingCount > 0 ? 'good' : 'warn'}`}>
                  {t.battingCount}
                </span>
              </td>
              <td>
                <span className={`count-badge ${t.bowlingCount > 0 ? 'good' : 'warn'}`}>
                  {t.bowlingCount}
                </span>
              </td>
              <td>
                <select
                  className="inline-select"
                  value={t.status}
                  onChange={e => update(i, 'status', e.target.value)}
                >
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="review-hint">
        All fields are editable. Tournament ID, Name, and Year are read from your files — correct them here if needed.
      </p>
    </div>
  );
}

function SummaryCard({ summary }) {
  if (!summary) return null;
  return (
    <div className="summary-grid">
      <div className="summary-item">
        <div className="label">Competition</div>
        <div className="value" style={{ fontSize: '1rem' }}>{summary.competition}</div>
      </div>
      <div className="summary-item">
        <div className="label">Tournaments</div>
        <div className="value">{summary.tournamentsCount}</div>
      </div>
      <div className="summary-item">
        <div className="label">Batting Records</div>
        <div className="value">{summary.totalBatting}</div>
      </div>
      <div className="summary-item">
        <div className="label">Bowling Records</div>
        <div className="value">{summary.totalBowling}</div>
      </div>
      <div className="summary-item">
        <div className="label">Output File</div>
        <div className="value" style={{ fontSize: '0.85rem' }}>{summary.outputFileName}</div>
      </div>
      <div className="summary-item">
        <div className="label">Last Updated</div>
        <div className="value" style={{ fontSize: '0.72rem' }}>{new Date(summary.lastUpdated).toLocaleString()}</div>
      </div>
    </div>
  );
}

function ComparisonTable({ oldJson, newJson }) {
  if (!oldJson || !newJson) return null;
  const oldBatting   = oldJson.data?.reduce((s, e) => s + (e.batting?.length || 0), 0) ?? 0;
  const newBatting   = newJson.data?.reduce((s, e) => s + (e.batting?.length || 0), 0) ?? 0;
  const oldBowling   = oldJson.data?.reduce((s, e) => s + (e.bowling?.length || 0), 0) ?? 0;
  const newBowling   = newJson.data?.reduce((s, e) => s + (e.bowling?.length || 0), 0) ?? 0;
  const oldTourneys  = oldJson.data?.map(d => d.tournamentName) ?? [];
  const newTourneys  = newJson.data?.map(d => d.tournamentName) ?? [];
  const added        = newTourneys.filter(t => !oldTourneys.includes(t));
  const removed      = oldTourneys.filter(t => !newTourneys.includes(t));

  const rows = [
    { label: 'Last Updated',    old: oldJson.lastUpdated ? new Date(oldJson.lastUpdated).toLocaleString() : '-', now: new Date(newJson.lastUpdated).toLocaleString(), changed: true },
    { label: 'Batting Records', old: oldBatting, now: newBatting, changed: oldBatting !== newBatting },
    { label: 'Bowling Records', old: oldBowling, now: newBowling, changed: oldBowling !== newBowling },
    { label: 'Tournaments',     old: oldTourneys.join(', ') || '-', now: newTourneys.join(', '), changed: JSON.stringify([...oldTourneys].sort()) !== JSON.stringify([...newTourneys].sort()) },
  ];

  return (
    <div>
      <table className="compare-table">
        <thead><tr><th>Field</th><th>Existing</th><th>New JSON</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label}>
              <td style={{ color: '#94a3b8' }}>{r.label}</td>
              <td className={r.changed ? 'changed' : ''}>{String(r.old)}</td>
              <td className="new-val">{String(r.now)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(added.length > 0 || removed.length > 0) && (
        <div style={{ marginTop: 10, fontSize: '0.8rem' }}>
          {added.length   > 0 && <div style={{ color: '#4ade80' }}>+ Added: {added.join(', ')}</div>}
          {removed.length > 0 && <div style={{ color: '#f87171' }}>− Removed: {removed.join(', ')}</div>}
        </div>
      )}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [competition,   setCompetition]   = useState(null);
  const [battingFiles,  setBattingFiles]  = useState([]);
  const [bowlingFiles,  setBowlingFiles]  = useState([]);
  const [parsing,       setParsing]       = useState(false);
  const [sessionId,     setSessionId]     = useState(null);
  const [detectedTournaments, setDetectedTournaments] = useState([]); // editable review list
  const [generating,    setGenerating]    = useState(false);
  const [generatedJson, setGeneratedJson] = useState(null);
  const [summary,       setSummary]       = useState(null);
  const [showPreview,   setShowPreview]   = useState(false);
  const [existingJson,  setExistingJson]  = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [pushing,       setPushing]       = useState(false);
  const [backupPath,    setBackupPath]    = useState(null);
  const [logs,          setLogs]          = useState([]);
  const [error,         setError]         = useState(null);
  const [successMsg,    setSuccessMsg]    = useState(null);

  function addLog(msg, type = 'info') {
    setLogs(prev => [...prev, { msg, type }]);
  }

  function resetOutput() {
    setSessionId(null);
    setDetectedTournaments([]);
    setGeneratedJson(null);
    setSummary(null);
    setExistingJson(null);
    setBackupPath(null);
    setError(null);
    setSuccessMsg(null);
    setLogs([]);
    setShowPreview(false);
  }

  function selectCompetition(comp) {
    setCompetition(comp);
    setBattingFiles([]);
    setBowlingFiles([]);
    resetOutput();
  }

  // Step 2: Parse uploaded files
  async function handleParseFiles() {
    if (!competition) { setError('Select a competition first.'); return; }
    if (battingFiles.length === 0 && bowlingFiles.length === 0) {
      setError('Upload at least one batting or bowling file.'); return;
    }
    setError(null);
    setSuccessMsg(null);
    setLogs([]);
    setDetectedTournaments([]);
    setSessionId(null);
    setGeneratedJson(null);
    setSummary(null);

    setParsing(true);
    addLog('Reading uploaded files...', 'action');

    try {
      const formData = new FormData();
      battingFiles.forEach(f => formData.append('batting_files', f));
      bowlingFiles.forEach(f => formData.append('bowling_files', f));

      const resp = await fetch('/api/parse-files', { method: 'POST', body: formData });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Parse failed');

      data.logs?.forEach(msg => {
        const type = msg.startsWith('  →') ? 'success'
          : msg.toLowerCase().includes('warning') ? 'warn'
          : 'info';
        addLog(msg, type);
      });

      setSessionId(data.sessionId);
      setDetectedTournaments(data.tournaments);
      addLog(`Detected ${data.tournaments.length} tournament(s). Review below then click Generate.`, 'action');
    } catch (e) {
      addLog(e.message, 'error');
      setError(e.message);
    } finally {
      setParsing(false);
    }
  }

  // Step 3: Generate JSON
  async function handleGenerate() {
    if (!sessionId) { setError('Please parse files first.'); return; }
    for (const t of detectedTournaments) {
      if (!t.tournamentId || !t.tournamentName || !t.year) {
        setError(`Tournament "${t.tournamentName || '(unnamed)'}" is missing ID, name, or year.`); return;
      }
    }
    setError(null);
    setSuccessMsg(null);
    setGeneratedJson(null);
    setSummary(null);
    setGenerating(true);
    addLog('Generating JSON...', 'action');

    try {
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          competition,
          tournaments: detectedTournaments.map(({ tournamentId, tournamentName, year, status }) =>
            ({ tournamentId, tournamentName, year, status })
          ),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Generation failed');

      data.logs?.forEach(msg => {
        const type = msg.toLowerCase().includes('warning') ? 'warn'
          : msg.toLowerCase().includes('success') || msg.toLowerCase().includes('generated') ? 'success'
          : 'info';
        addLog(msg, type);
      });

      setGeneratedJson(data.json);
      setSummary(data.summary);
      setSuccessMsg('JSON generated successfully!');
    } catch (e) {
      addLog(e.message, 'error');
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  function downloadJson() {
    if (!generatedJson || !summary) return;
    const blob = new Blob([JSON.stringify(generatedJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = summary.outputFileName;
    a.click();
    URL.revokeObjectURL(url);
    addLog(`Downloaded ${summary.outputFileName}`, 'success');
  }

  async function handleUploadExisting(file) {
    if (!file) return;
    addLog(`Reading existing JSON: ${file.name}`, 'action');
    try {
      const json = JSON.parse(await file.text());
      setExistingJson(json);
      addLog('Existing JSON loaded — comparison ready below', 'success');
    } catch {
      addLog('Failed to parse uploaded JSON', 'error');
      setError('Invalid JSON file.');
    }
  }

  async function handleSaveAndReplace() {
    if (!generatedJson || !competition) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    addLog('Creating backup and replacing repo JSON...', 'action');
    try {
      const resp = await fetch('/api/save-backup-and-replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competition, newJson: generatedJson }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Save failed');
      data.logs?.forEach(msg => addLog(msg, msg.toLowerCase().includes('backup') ? 'warn' : 'success'));
      if (data.backupPath) setBackupPath(data.backupPath);
      setSuccessMsg('Backup saved and repo JSON replaced!');
    } catch (e) {
      addLog(e.message, 'error');
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePushToGitHub() {
    if (!competition) return;
    setPushing(true);
    setError(null);
    setSuccessMsg(null);
    addLog('Starting git push to GitHub...', 'action');
    try {
      const resp = await fetch('/api/push-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competition }),
      });
      const data = await resp.json();
      data.logs?.forEach(msg => {
        const type = msg.toLowerCase().includes('error') ? 'error'
          : msg.toLowerCase().includes('complet') || msg.toLowerCase().includes('success') ? 'success'
          : 'action';
        addLog(msg, type);
      });
      if (!resp.ok) throw new Error(data.error || 'Push failed');
      setSuccessMsg('Pushed to GitHub successfully!');
    } catch (e) {
      addLog(e.message, 'error');
      setError(e.message);
    } finally {
      setPushing(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="app">
      <h1>Cricket Stats Generator</h1>
      <p className="subtitle">Local tool · upload Excel/CSV files → generate and push stats JSON</p>

      {/* Step 1: Competition */}
      <div className="card">
        <h2>1. Select Competition</h2>
        <div className="competition-grid">
          {Object.entries(COMPETITIONS).map(([key, val]) => (
            <button
              key={key}
              className={`comp-btn ${competition === key ? 'active' : ''}`}
              onClick={() => selectCompetition(key)}
            >
              <span className="comp-name">{key}</span>
              <span className="comp-full">{val.fullName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Upload Files */}
      {competition && (
        <div className="card">
          <h2>2. Upload Files</h2>
          <p className="step-hint">
            Upload all batting and/or bowling files for <strong>{competition}</strong>.
            You can select <strong>multiple files</strong> at once — one file per tournament,
            or a single file covering multiple tournaments if it has a <code>tournament_id</code> column.
          </p>

          <div className="upload-grid">
            <FileDropZone
              label="Batting Files"
              accept=".csv,.xlsx,.xls"
              multiple
              files={battingFiles}
              onChange={setBattingFiles}
            />
            <FileDropZone
              label="Bowling Files"
              accept=".csv,.xlsx,.xls"
              multiple
              files={bowlingFiles}
              onChange={setBowlingFiles}
            />
          </div>

          <div className="hint-box">
            <strong>Tournament info is read from your files.</strong>{' '}
            Supported columns: <code>tournament_id</code>, <code>tournament_name</code>, <code>year</code>.
            If absent, the filename is used as the tournament name and you can edit it in step 3.
          </div>

          <div className="actions-row" style={{ marginTop: 18 }}>
            <button
              className="btn btn-primary"
              onClick={handleParseFiles}
              disabled={parsing || (battingFiles.length === 0 && bowlingFiles.length === 0)}
            >
              {parsing ? <><span className="spinner" /> Reading Files...</> : 'Read & Detect Tournaments'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review detected tournaments */}
      {detectedTournaments.length > 0 && (
        <div className="card">
          <h2>3. Review Detected Tournaments</h2>
          <p className="step-hint">
            {detectedTournaments.length} tournament{detectedTournaments.length > 1 ? 's' : ''} detected.
            Edit any field inline, then set the <strong>status</strong> for each tournament.
          </p>
          <TournamentReviewTable
            tournaments={detectedTournaments}
            onChange={setDetectedTournaments}
          />
          <div className="actions-row" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
              {generating ? <><span className="spinner" /> Generating...</> : 'Generate JSON'}
            </button>
          </div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="card">
          <h2>Activity Log</h2>
          <LogPanel logs={logs} />
        </div>
      )}

      {error      && <div className="error-banner">{error}</div>}
      {successMsg && !error && <div className="success-banner">{successMsg}</div>}

      {/* Step 4: Preview & Download */}
      {generatedJson && summary && (
        <div className="card">
          <h2>4. Preview &amp; Download</h2>
          <SummaryCard summary={summary} />
          <div className="actions-row">
            <button className="btn btn-success" onClick={downloadJson}>
              ↓ Download {summary.outputFileName}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPreview(v => !v)}>
              {showPreview ? 'Hide JSON' : 'Show JSON Preview'}
            </button>
          </div>
          {showPreview && (
            <div className="json-preview" style={{ marginTop: 14 }}>
              {(() => {
                const str = JSON.stringify(generatedJson, null, 2);
                return str.length > 4000 ? str.slice(0, 4000) + '\n... (truncated)' : str;
              })()}
            </div>
          )}
        </div>
      )}

      {/* Step 5: Compare & Push */}
      {generatedJson && (
        <div className="card">
          <h2>5. Compare &amp; Push to GitHub</h2>

          <div className="sub-section">
            <h3>Upload Existing JSON (optional — for comparison)</h3>
            <input
              type="file"
              accept=".json"
              onChange={e => handleUploadExisting(e.target.files[0])}
              style={{ marginTop: 8 }}
            />
            {existingJson && (
              <div style={{ marginTop: 16 }}>
                <ComparisonTable oldJson={existingJson} newJson={generatedJson} />
              </div>
            )}
          </div>

          <hr className="section-divider" />

          <div className="sub-section">
            <h3>Save &amp; Push</h3>
            <p className="step-hint">
              Creates a timestamped backup, replaces the repo JSON, then runs git push.
            </p>
            {backupPath && (
              <div className="backup-notice">Backup saved at: {backupPath}</div>
            )}
            <div className="actions-row" style={{ marginTop: 14 }}>
              <button className="btn btn-warning" onClick={handleSaveAndReplace} disabled={saving || pushing}>
                {saving ? <><span className="spinner" /> Saving...</> : 'Save Backup & Replace JSON'}
              </button>
              <button className="btn btn-primary" onClick={handlePushToGitHub} disabled={pushing || saving}>
                {pushing ? <><span className="spinner" /> Pushing...</> : 'Push to GitHub'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
