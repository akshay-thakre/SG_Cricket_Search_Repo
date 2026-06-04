import React, { useState, useEffect, useCallback, useMemo } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchYPLBatting(year, team) {
  const res = await fetch(`${API_BASE}/api/ypl/batting?year=${year}&team=${team}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchYPLYears() {
  const res = await fetch(`${API_BASE}/api/ypl/years`);
  if (!res.ok) return { years: [new Date().getFullYear().toString()] };
  return res.json();
}

// ── Stat formatting ───────────────────────────────────────────────────────────

function fmt(val, decimals = 0) {
  if (val === null || val === undefined) return '-';
  if (decimals > 0) return Number(val).toFixed(decimals);
  return String(val);
}

// ── Manual paste parser ───────────────────────────────────────────────────────

function parsePastedTable(text, teamId) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { players: [], error: 'Need at least a header row and one data row.' };

  const headers = lines[0].split(/\t/).map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));

  const HMAP = {
    player: 'playerName', name: 'playerName', playername: 'playerName',
    mat: 'matches', matches: 'matches',
    inn: 'innings', inns: 'innings', innings: 'innings',
    no: 'notOuts', notout: 'notOuts',
    runs: 'runs',
    hs: 'highestScore', highest: 'highestScore',
    ave: 'average', avg: 'average',
    bf: 'ballsFaced', balls: 'ballsFaced',
    sr: 'strikeRate',
    '100s': 'hundreds', '100': 'hundreds',
    '50s': 'fifties', '50': 'fifties',
    '4s': 'fours',
    '6s': 'sixes',
    '0s': 'ducks', ducks: 'ducks',
  };

  const fieldMap = headers.map((h) => HMAP[h] || null);
  if (!fieldMap.includes('playerName')) {
    return { players: [], error: 'Could not find a Player Name column. Copy the full table including headers.' };
  }

  const players = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(/\t/).map((c) => c.trim());
    const rec = { sourceName: 'sportygo-ypl', teamId, year: new Date().getFullYear().toString(), clubId: '4263' };
    fieldMap.forEach((field, idx) => {
      if (!field || !cells[idx]) return;
      if (field === 'playerName' || field === 'highestScore') {
        rec[field] = cells[idx];
      } else {
        const n = parseFloat(cells[idx].replace(/[^0-9.]/g, ''));
        rec[field] = isNaN(n) ? null : n;
      }
    });
    if (rec.playerName && rec.playerName !== '-') {
      const hs = (rec.highestScore || '-');
      rec.highestScoreNumeric = parseFloat(hs.replace(/[^0-9.]/g, '')) || null;
      players.push(rec);
    }
  }

  return { players, error: players.length === 0 ? 'No player rows found in pasted text.' : null };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBadge({ label, value }) {
  return (
    <div style={{
      backgroundColor: '#f0f7ff', border: '1px solid #c7dff7',
      borderRadius: '8px', padding: '0.6rem 1rem', textAlign: 'center', minWidth: '80px',
    }}>
      <div style={{ fontSize: '18px', fontWeight: '700', color: '#0066cc' }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{label}</div>
    </div>
  );
}

function BattingTable({ players }) {
  const [sortCol, setSortCol] = useState('runs');
  const [sortAsc, setSortAsc]  = useState(false);

  const cols = [
    { key: 'playerName',  label: 'Player',       align: 'left' },
    { key: 'matches',     label: 'Mat',           align: 'center' },
    { key: 'innings',     label: 'Inn',           align: 'center' },
    { key: 'notOuts',     label: 'NO',            align: 'center' },
    { key: 'runs',        label: 'Runs',          align: 'center' },
    { key: 'highestScoreNumeric', label: 'HS',    align: 'center', display: 'highestScore' },
    { key: 'average',     label: 'Ave',           align: 'center', float: true },
    { key: 'ballsFaced',  label: 'Balls',         align: 'center' },
    { key: 'strikeRate',  label: 'SR',            align: 'center', float: true },
    { key: 'hundreds',    label: '100s',          align: 'center' },
    { key: 'fifties',     label: '50s',           align: 'center' },
    { key: 'fours',       label: '4s',            align: 'center' },
    { key: 'sixes',       label: '6s',            align: 'center' },
    { key: 'ducks',       label: 'Ducks',         align: 'center' },
  ];

  const handleSort = (key) => {
    if (sortCol === key) setSortAsc((a) => !a);
    else { setSortCol(key); setSortAsc(false); }
  };

  const sorted = useMemo(() => {
    return [...players].sort((a, b) => {
      const av = a[sortCol] ?? -Infinity;
      const bv = b[sortCol] ?? -Infinity;
      if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? av - bv : bv - av;
    });
  }, [players, sortCol, sortAsc]);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ backgroundColor: '#1e3a5f' }}>
            <th style={{ ...thStyle, textAlign: 'center', width: '32px' }}>#</th>
            {cols.map((c) => (
              <th
                key={c.key}
                onClick={() => handleSort(c.key)}
                style={{ ...thStyle, textAlign: c.align, cursor: 'pointer', userSelect: 'none' }}
              >
                {c.label}
                {sortCol === c.key ? (sortAsc ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, idx) => (
            <tr key={p.playerName + idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
              <td style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>{idx + 1}</td>
              {cols.map((c) => {
                const rawVal = c.display ? p[c.display] : p[c.key];
                const displayVal = c.float ? fmt(p[c.key], 2) : fmt(rawVal);
                return (
                  <td key={c.key} style={{ ...tdStyle, textAlign: c.align, fontWeight: c.key === 'playerName' ? '600' : 'normal' }}>
                    {displayVal}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = {
  padding: '0.6rem 0.75rem',
  color: '#e2e8f0',
  fontWeight: '600',
  fontSize: '12px',
  whiteSpace: 'nowrap',
  borderBottom: '2px solid #0f2a4a',
};

const tdStyle = {
  padding: '0.55rem 0.75rem',
  borderBottom: '1px solid #e2e8f0',
  color: '#1e293b',
  whiteSpace: 'nowrap',
};

function ManualImport({ teamId, onImported }) {
  const [text, setText]       = useState('');
  const [result, setResult]   = useState(null);
  const [expanded, setExpanded] = useState(false);

  const handleParse = () => {
    const { players, error } = parsePastedTable(text, teamId);
    setResult({ players, error });
    if (players.length > 0) onImported(players);
  };

  return (
    <div style={{ marginTop: '1.5rem', border: '1px dashed #94a3b8', borderRadius: '10px', padding: '1rem' }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600', color: '#0066cc', fontSize: '13px', padding: 0 }}
      >
        {expanded ? '▼' : '▶'} Manual Paste Import
      </button>
      {expanded && (
        <div style={{ marginTop: '0.75rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '13px', color: '#475569' }}>
            Copy the batting table from the YPL page and paste it here (tab-separated).
            Include the header row.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={'Player\tMat\tInn\tNO\tRuns\tHS\tAve\tBF\tSR\t100s\t50s\t4s\t6s\t0s\nAkshay Thakre\t8\t7\t1\t235\t58\t39.17\t198\t118.69\t0\t2\t22\t8\t0'}
            style={{
              width: '100%', fontFamily: 'monospace', fontSize: '12px',
              padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px',
              resize: 'vertical', boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleParse}
            disabled={!text.trim()}
            style={{
              marginTop: '0.5rem', padding: '0.5rem 1.25rem', backgroundColor: '#0066cc',
              color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
            }}
          >
            Parse Table
          </button>
          {result && (
            <div style={{ marginTop: '0.5rem', fontSize: '13px', color: result.error ? '#dc2626' : '#16a34a' }}>
              {result.error ? `❌ ${result.error}` : `✅ Parsed ${result.players.length} player(s).`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main YPLStats component ───────────────────────────────────────────────────

const TEAM_OPTIONS = [
  { value: '211',          label: 'YPL Team 211' },
  { value: '120',          label: 'YPL Team 120' },
  { value: 'consolidated', label: 'YPL Consolidated' },
];

export default function YPLStats() {
  const currentYear = new Date().getFullYear().toString();

  const [years, setYears]         = useState([currentYear]);
  const [year, setYear]           = useState(currentYear);
  const [team, setTeam]           = useState('211');
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [filter, setFilter]       = useState('');
  const [pastedPlayers, setPastedPlayers] = useState(null);

  // Load available years once
  useEffect(() => {
    fetchYPLYears()
      .then(({ years: y }) => { if (y && y.length) setYears(y); })
      .catch(() => {});
  }, []);

  // Fetch batting data when year/team changes
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsBlocked(false);
    setPastedPlayers(null);

    try {
      const d = await fetchYPLBatting(year, team);
      setData(d);
    } catch (e) {
      setError(e.message);
      setIsBlocked(e.message.includes('could not be accessed') || e.message.includes('403') || e.message.includes('blocked'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, team]);

  useEffect(() => { loadData(); }, [loadData]);

  const players = useMemo(() => {
    const source = pastedPlayers || (data && data.players) || [];
    if (!filter.trim()) return source;
    const q = filter.toLowerCase();
    return source.filter((p) => (p.playerName || '').toLowerCase().includes(q));
  }, [data, pastedPlayers, filter]);

  const teamLabel = TEAM_OPTIONS.find((t) => t.value === team)?.label || 'YPL';
  const totalRuns = players.reduce((s, p) => s + (p.runs || 0), 0);
  const topScorer = players.length > 0
    ? [...players].sort((a, b) => (b.runs || 0) - (a.runs || 0))[0]
    : null;

  const sectionStyle = {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 2px 8px rgba(6,28,84,0.07)',
    marginBottom: '1.5rem',
  };

  return (
    <div>
      {/* Header */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', color: '#1e3a5f', fontWeight: '700' }}>
              🏏 YPL Batting Statistics
            </h2>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Young Players League — Batting Records
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Year selector */}
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              style={selectStyle}
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>

            {/* Team selector */}
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              style={selectStyle}
            >
              {TEAM_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <button onClick={loadData} style={btnStyle}>↻ Refresh</button>
          </div>
        </div>

        {/* Sample data notice */}
        {data && data.isSample && (
          <div style={{
            marginTop: '1rem', padding: '0.6rem 1rem', backgroundColor: '#fefce8',
            border: '1px solid #fef08a', borderRadius: '8px', fontSize: '12px', color: '#92400e',
          }}>
            ℹ️ Showing sample data. Run <code style={{ backgroundColor: '#fde68a', padding: '1px 4px', borderRadius: '3px' }}>npm run import:ypl:batting</code> from the backend to load live data.
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          <div style={{ fontSize: '32px', marginBottom: '0.75rem' }}>⏳</div>
          <div>Loading YPL batting stats...</div>
        </div>
      )}

      {/* Blocked / error */}
      {!loading && error && (
        <div style={{ ...sectionStyle, backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
          <div style={{ fontWeight: '700', color: '#dc2626', marginBottom: '0.5rem' }}>⚠️ Data Unavailable</div>
          <div style={{ fontSize: '13px', color: '#7f1d1d', marginBottom: '1rem' }}>
            This YPL statistics page could not be accessed from the server.
            Please use manual copy-paste import or upload a static JSON file.
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '1rem' }}>
            Technical: {error}
          </div>
          <ManualImport teamId={team} onImported={setPastedPlayers} />
        </div>
      )}

      {/* Stats */}
      {!loading && (pastedPlayers || (data && data.players)) && (
        <>
          {/* Summary badges */}
          <div style={{ ...sectionStyle, display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontWeight: '700', color: '#1e3a5f', fontSize: '15px', marginRight: '0.5rem' }}>{teamLabel}</div>
            <StatBadge label="Players" value={players.length} />
            <StatBadge label="Total Runs" value={totalRuns.toLocaleString()} />
            {topScorer && <StatBadge label="Top Scorer" value={`${topScorer.playerName} (${topScorer.runs})`} />}
          </div>

          {/* Search + table */}
          <div style={sectionStyle}>
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder="Search player name..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{
                  padding: '0.5rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px',
                  fontSize: '13px', width: '220px',
                }}
              />
              {filter && (
                <button onClick={() => setFilter('')} style={{ ...btnStyle, backgroundColor: '#64748b' }}>
                  Clear
                </button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#94a3b8' }}>
                {players.length} player{players.length !== 1 ? 's' : ''}
              </span>
            </div>

            {players.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                {filter ? 'No players match your search.' : 'No batting data available.'}
              </div>
            ) : (
              <BattingTable players={players} />
            )}

            {/* Manual import when data loads ok but user wants to add more */}
            {!error && (
              <ManualImport teamId={team} onImported={setPastedPlayers} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

const selectStyle = {
  padding: '0.45rem 0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  fontSize: '13px',
  color: '#1e293b',
  backgroundColor: '#fff',
  cursor: 'pointer',
};

const btnStyle = {
  padding: '0.45rem 1rem',
  backgroundColor: '#0066cc',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '600',
};
