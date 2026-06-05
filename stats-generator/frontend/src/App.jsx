import { useState, useRef } from 'react';

const COMPETITIONS = {
  'SG IA': { fullName: 'Singapore Indian Association', outputFileName: 'sgiaStats.json' },
  'BPL': { fullName: 'Bengali Premier League', outputFileName: 'bplStats.json' },
  'YPL': { fullName: 'Young Premier League', outputFileName: 'yplStats.json' },
  'SCA': { fullName: 'Singapore Cricket Association', outputFileName: 'scaStats.json' },
};

const STATUS_OPTIONS = ['on-going', 'completed', 'upcoming'];

const EMPTY_TOURNAMENT = () => ({
  id: Date.now() + Math.random(),
  year: new Date().getFullYear().toString(),
  tournamentId: '',
  tournamentName: '',
  status: 'on-going',
  battingFile: null,
  bowlingFile: null,
});

function LogPanel({ logs }) {
  const ref = useRef(null);
  // auto-scroll
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
        <div className="value" style={{ fontSize: '0.75rem' }}>{new Date(summary.lastUpdated).toLocaleString()}</div>
      </div>
    </div>
  );
}

function ComparisonTable({ oldJson, newJson }) {
  if (!oldJson || !newJson) return null;

  const oldBatting = oldJson.data?.reduce((s, e) => s + (e.batting?.length || 0), 0) ?? 0;
  const newBatting = newJson.data?.reduce((s, e) => s + (e.batting?.length || 0), 0) ?? 0;
  const oldBowling = oldJson.data?.reduce((s, e) => s + (e.bowling?.length || 0), 0) ?? 0;
  const newBowling = newJson.data?.reduce((s, e) => s + (e.bowling?.length || 0), 0) ?? 0;

  const oldTournaments = oldJson.data?.map(d => d.tournamentName) ?? [];
  const newTournaments = newJson.data?.map(d => d.tournamentName) ?? [];
  const addedT = newTournaments.filter(t => !oldTournaments.includes(t));
  const removedT = oldTournaments.filter(t => !newTournaments.includes(t));

  const rows = [
    { label: 'Last Updated', old: oldJson.lastUpdated ? new Date(oldJson.lastUpdated).toLocaleString() : '-', new: new Date(newJson.lastUpdated).toLocaleString() },
    { label: 'Batting Records', old: oldBatting, new: newBatting, changed: oldBatting !== newBatting },
    { label: 'Bowling Records', old: oldBowling, new: newBowling, changed: oldBowling !== newBowling },
    { label: 'Tournaments', old: oldTournaments.join(', ') || '-', new: newTournaments.join(', '), changed: JSON.stringify(oldTournaments.sort()) !== JSON.stringify(newTournaments.sort()) },
  ];

  return (
    <div>
      <table className="compare-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Existing (Old)</th>
            <th>New JSON</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label}>
              <td style={{ color: '#94a3b8' }}>{r.label}</td>
              <td className={r.changed ? 'changed' : ''}>{String(r.old)}</td>
              <td className="new-val">{String(r.new)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(addedT.length > 0 || removedT.length > 0) && (
        <div style={{ marginTop: 10, fontSize: '0.8rem' }}>
          {addedT.length > 0 && <div style={{ color: '#4ade80' }}>+ Added: {addedT.join(', ')}</div>}
          {removedT.length > 0 && <div style={{ color: '#f87171' }}>- Removed: {removedT.join(', ')}</div>}
        </div>
      )}
    </div>
  );
}

function TournamentRow({ t, index, onChange, onRemove }) {
  return (
    <div className="tournament-row">
      <div className="tournament-header">
        <h3>Tournament {index + 1}</h3>
        <button className="btn btn-sm btn-danger" onClick={onRemove}>Remove</button>
      </div>

      <div className="tournament-grid">
        <div>
          <label>Year</label>
          <input
            type="text"
            value={t.year}
            onChange={e => onChange('year', e.target.value)}
            placeholder="2025"
          />
        </div>
        <div>
          <label>Tournament ID</label>
          <input
            type="text"
            value={t.tournamentId}
            onChange={e => onChange('tournamentId', e.target.value)}
            placeholder="shl3"
          />
        </div>
        <div>
          <label>Tournament Name</label>
          <input
            type="text"
            value={t.tournamentName}
            onChange={e => onChange('tournamentName', e.target.value)}
            placeholder="SGIA SHL 3"
          />
        </div>
        <div>
          <label>Status</label>
          <select value={t.status} onChange={e => onChange('status', e.target.value)}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="file-grid">
        <div>
          <div className="file-label">Batting File (CSV / Excel)</div>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={e => onChange('battingFile', e.target.files[0] || null)}
          />
          {t.battingFile && <div className="file-name">{t.battingFile.name}</div>}
        </div>
        <div>
          <div className="file-label">Bowling File (CSV / Excel)</div>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={e => onChange('bowlingFile', e.target.files[0] || null)}
          />
          {t.bowlingFile && <div className="file-name">{t.bowlingFile.name}</div>}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [competition, setCompetition] = useState(null);
  const [tournaments, setTournaments] = useState([EMPTY_TOURNAMENT()]);
  const [logs, setLogs] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [generatedJson, setGeneratedJson] = useState(null);
  const [summary, setSummary] = useState(null);
  const [existingJson, setExistingJson] = useState(null);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [backupPath, setBackupPath] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  function addLog(msg, type = 'info') {
    setLogs(prev => [...prev, { msg, type }]);
  }

  function clearState() {
    setGeneratedJson(null);
    setSummary(null);
    setExistingJson(null);
    setBackupPath(null);
    setError(null);
    setSuccessMsg(null);
    setLogs([]);
    setShowJsonPreview(false);
  }

  function updateTournament(index, field, value) {
    setTournaments(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  }

  function removeTournament(index) {
    setTournaments(prev => prev.filter((_, i) => i !== index));
  }

  function addTournament() {
    setTournaments(prev => [...prev, EMPTY_TOURNAMENT()]);
  }

  async function handleGenerate() {
    setError(null);
    setSuccessMsg(null);
    setLogs([]);
    setGeneratedJson(null);
    setSummary(null);

    if (!competition) { setError('Please select a competition first.'); return; }

    for (let i = 0; i < tournaments.length; i++) {
      const t = tournaments[i];
      if (!t.year || !t.tournamentId || !t.tournamentName) {
        setError(`Tournament ${i + 1}: year, ID, and name are required.`); return;
      }
      if (!t.battingFile) { setError(`Tournament ${i + 1} "${t.tournamentName}": batting file is required.`); return; }
      if (!t.bowlingFile) { setError(`Tournament ${i + 1} "${t.tournamentName}": bowling file is required.`); return; }
    }

    setGenerating(true);
    addLog('Starting file processing...', 'action');

    try {
      const formData = new FormData();
      formData.append('competition', competition);
      formData.append('tournaments', JSON.stringify(
        tournaments.map(({ year, tournamentId, tournamentName, status }) => ({ year, tournamentId, tournamentName, status }))
      ));
      tournaments.forEach((t, i) => {
        formData.append(`batting_${i}`, t.battingFile);
        formData.append(`bowling_${i}`, t.bowlingFile);
      });

      const resp = await fetch('/api/generate', { method: 'POST', body: formData });
      const data = await resp.json();

      if (!resp.ok) throw new Error(data.error || 'Generation failed');

      data.logs?.forEach(msg => {
        const type = msg.toLowerCase().includes('error') ? 'error'
          : msg.toLowerCase().includes('valid') || msg.toLowerCase().includes('success') ? 'success'
          : msg.toLowerCase().includes('generat') ? 'action'
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
      const text = await file.text();
      const json = JSON.parse(text);
      setExistingJson(json);
      addLog('Existing JSON uploaded and parsed', 'success');
    } catch {
      addLog('Failed to parse uploaded JSON', 'error');
      setError('Invalid JSON file uploaded.');
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
      setSuccessMsg('Backup saved and repo JSON replaced successfully!');
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

  return (
    <div className="app">
      <h1>Cricket Stats Generator</h1>
      <p className="subtitle">Local tool to generate and push competition stats JSON files</p>

      {/* Step 1: Competition */}
      <div className="card">
        <h2>1. Select Competition</h2>
        <div className="competition-grid">
          {Object.entries(COMPETITIONS).map(([key, val]) => (
            <button
              key={key}
              className={`comp-btn ${competition === key ? 'active' : ''}`}
              onClick={() => { setCompetition(key); clearState(); }}
            >
              <span className="comp-name">{key}</span>
              <span className="comp-full">{val.fullName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Tournaments */}
      {competition && (
        <div className="card">
          <h2>2. Add Tournaments</h2>
          {tournaments.map((t, i) => (
            <TournamentRow
              key={t.id}
              t={t}
              index={i}
              onChange={(field, val) => updateTournament(i, field, val)}
              onRemove={() => removeTournament(i)}
            />
          ))}
          <button className="btn-add" onClick={addTournament}>+ Add Another Tournament</button>

          <div className="actions-row" style={{ marginTop: 20 }}>
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

      {/* Error / Success */}
      {error && <div className="error-banner">{error}</div>}
      {successMsg && !error && <div className="success-banner">{successMsg}</div>}

      {/* Step 3: Preview & Download */}
      {generatedJson && summary && (
        <div className="card">
          <h2>3. Preview & Download</h2>
          <SummaryCard summary={summary} />

          <div className="actions-row">
            <button className="btn btn-success" onClick={downloadJson}>Download {summary.outputFileName}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowJsonPreview(v => !v)}>
              {showJsonPreview ? 'Hide JSON Preview' : 'Show JSON Preview'}
            </button>
          </div>

          {showJsonPreview && (
            <div className="json-preview" style={{ marginTop: 14 }}>
              {JSON.stringify(generatedJson, null, 2).slice(0, 3000)}
              {JSON.stringify(generatedJson, null, 2).length > 3000 ? '\n... (truncated)' : ''}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Compare & Replace */}
      {generatedJson && (
        <div className="card">
          <h2>4. Upload Existing JSON (Optional — for comparison)</h2>
          <div className="upload-existing">
            <input
              type="file"
              accept=".json"
              onChange={e => handleUploadExisting(e.target.files[0])}
            />
          </div>
          {existingJson && generatedJson && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: 10 }}>Comparison</h3>
              <ComparisonTable oldJson={existingJson} newJson={generatedJson} />
            </div>
          )}

          <hr className="section-divider" />

          <h2>5. Save & Push to GitHub</h2>
          <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 14 }}>
            This will create a timestamped backup and replace the file in the repo, then push to GitHub.
          </p>

          {backupPath && (
            <div style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: 12 }}>
              Backup at: {backupPath}
            </div>
          )}

          <div className="actions-row">
            <button className="btn btn-warning" onClick={handleSaveAndReplace} disabled={saving || pushing}>
              {saving ? <><span className="spinner" /> Saving...</> : 'Save Backup & Replace JSON'}
            </button>
            <button className="btn btn-primary" onClick={handlePushToGitHub} disabled={pushing || saving}>
              {pushing ? <><span className="spinner" /> Pushing...</> : 'Push to GitHub'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
