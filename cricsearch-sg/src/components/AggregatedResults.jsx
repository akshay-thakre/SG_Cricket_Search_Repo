import React, { useState, useEffect } from 'react';
import { fetchAnyPlayerStats } from '../services/apiService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { generatePlayerInsights } from '../utils/playerInsights';

// ── Stats format normalizer ───────────────────────────────────────────────────
// SCA returns batting/bowling as plain objects.
// Sportygo returns them as arrays of per-series rows + player.totals.
// This function converts Sportygo format to the SCA shape so the card renders identically.
function normalizeStats(raw) {
  if (!raw) return raw;
  if (!Array.isArray(raw.batting) && !Array.isArray(raw.bowling)) return raw; // already SCA shape

  const battingRow = (raw.batting || [])[0] || null;
  const bowlingRow = (raw.bowling || [])[0] || null;
  const totals = (raw.player && raw.player.totals) || {};

  return {
    ...raw,
    playerName: raw.player ? raw.player.name : raw.playerName,
    teamName:   raw.player ? raw.player.teamName : raw.teamName,
    playerRole: raw.player ? raw.player.playerRole : raw.playerRole,
    batting: battingRow ? {
      matches:      totals.matches     ?? battingRow.mat,
      innings:      battingRow.inns,
      notOuts:      battingRow.no,
      runs:         totals.runs        ?? battingRow.runs,
      highestScore: battingRow.hs,
      average:      battingRow.ave,
      strikeRate:   battingRow.sr,
      centuries:    battingRow['100s'],
      fifties:      battingRow['50s'],
      fours:        battingRow['4s'],
      sixes:        battingRow['6s'],
    } : null,
    bowling: bowlingRow ? {
      matches:     totals.matches      ?? bowlingRow.mat,
      overs:       bowlingRow.overs,
      maidens:     bowlingRow.mdns,
      runs:        bowlingRow.runs,
      wickets:     totals.wickets      ?? bowlingRow.wkts,
      average:     bowlingRow.ave,
      economy:     bowlingRow.eco,
      strikeRate:  bowlingRow.sr,
      bestBowling: bowlingRow.bbi,
    } : null,
  };
}

// ── Cross-league aggregation helpers ─────────────────────────────────────────

function checkNameFeasibility(query, allPlayers) {
  const queryWords = query.trim().toLowerCase().split(/\s+/).filter(w => w.length >= 3);
  if (queryWords.length === 0) return { feasible: true, failedNames: [] };
  const failedNames = allPlayers
    .filter(p => {
      const name = (p.name || '').toLowerCase();
      return !queryWords.some(w => name.includes(w));
    })
    .map(p => p.name);
  return { feasible: failedNames.length === 0, failedNames };
}

function normalizeForAgg(player, scaStatsMap) {
  const src = player.source;

  if (src === 'sca') {
    const stats = scaStatsMap.get(player.id);
    if (!stats) return { batting: null, bowling: null };
    const b = stats.batting;
    const bwl = stats.bowling;
    const balls = (b && b.runs != null && b.strikeRate)
      ? Math.round((b.runs / b.strikeRate) * 100) : null;
    return {
      batting: b ? { mat: b.matches||0, inns: b.innings||0, notOuts: b.notOuts||0, runs: b.runs||0, balls: balls||0 } : null,
      bowling: bwl ? { overs: bwl.overs||0, runs: bwl.runs||0, wickets: bwl.wickets||0 } : null,
    };
  }

  if (src === 'sgia-static') {
    let mat=0, inns=0, notOuts=0, runs=0, balls=0, overs=0, runsConceded=0, wickets=0;
    let hasBat=false, hasBowl=false;
    for (const entry of player.entries || []) {
      if (entry.batting) { hasBat=true; mat+=entry.batting.mat||0; inns+=entry.batting.inns||0; notOuts+=entry.batting.no||0; runs+=entry.batting.runs||0; balls+=entry.batting.balls||0; }
      if (entry.bowling) { hasBowl=true; overs+=entry.bowling.overs||0; runsConceded+=entry.bowling.runs||0; wickets+=entry.bowling.wickets||0; }
    }
    return {
      batting: hasBat ? { mat, inns, notOuts, runs, balls } : null,
      bowling: hasBowl ? { overs, runs: runsConceded, wickets } : null,
    };
  }

  if (src === 'bpl-static') {
    const b = player.batting;
    const bwl = player.bowling;
    return {
      batting: (b && b.inns > 0) ? { mat: b.mat||0, inns: b.inns||0, notOuts: b.no||0, runs: b.runs||0, balls: b.balls||0 } : null,
      bowling: (bwl && bwl.inns > 0) ? { overs: bwl.overs||0, runs: bwl.runs||0, wickets: bwl.wickets||0 } : null,
    };
  }

  if (src === 'ypl-static') {
    const b = player.inlineStats?.batting;
    const bwl = player.inlineStats?.bowling;
    return {
      batting: (b && b.innings > 0) ? { mat: b.matches||0, inns: b.innings||0, notOuts: b.not_outs||0, runs: b.runs||0, balls: b.balls||0 } : null,
      bowling: (bwl && bwl.innings > 0) ? { overs: bwl.overs||0, runs: bwl.runs_conceded||0, wickets: bwl.wickets||0 } : null,
    };
  }

  if (src === 'sca-corporate') {
    let mat=0, inns=0, notOuts=0, runs=0, balls=0, overs=0, runsConceded=0, wickets=0;
    let hasBat=false, hasBowl=false;
    for (const s of player.seasons || []) {
      if (s.batting) { hasBat=true; mat+=s.batting.mat||0; inns+=s.batting.inns||0; notOuts+=s.batting.not_outs||0; runs+=s.batting.runs||0; balls+=s.batting.balls||0; }
      if (s.bowling) { hasBowl=true; overs+=s.bowling.overs||0; runsConceded+=s.bowling.runs||0; wickets+=s.bowling.wkts||0; }
    }
    return {
      batting: hasBat ? { mat, inns, notOuts, runs, balls } : null,
      bowling: hasBowl ? { overs, runs: runsConceded, wickets } : null,
    };
  }

  return { batting: null, bowling: null };
}

function aggregateAll(normalizedList) {
  let mat=0, inns=0, notOuts=0, runs=0, balls=0, overs=0, runsConceded=0, wickets=0;
  let hasBat=false, hasBowl=false;
  for (const n of normalizedList) {
    if (n.batting) { hasBat=true; mat+=(Number(n.batting.mat)||0); inns+=(Number(n.batting.inns)||0); notOuts+=(Number(n.batting.notOuts)||0); runs+=(Number(n.batting.runs)||0); balls+=(Number(n.batting.balls)||0); }
    if (n.bowling) { hasBowl=true; overs+=(Number(n.bowling.overs)||0); runsConceded+=(Number(n.bowling.runs)||0); wickets+=(Number(n.bowling.wickets)||0); }
  }
  const dismissals = inns - notOuts;
  const d = (v, dec=2) => (v == null || isNaN(v) ? '—' : Number(v).toFixed(dec));
  return {
    hasBat, hasBowl,
    batting: {
      mat, inns, notOuts, runs, balls,
      avg:  dismissals > 0 ? d(runs / dismissals) : '—',
      sr:   balls > 0      ? d((runs / balls) * 100) : '—',
    },
    bowling: {
      overs: d(overs, 1), runs: runsConceded, wickets,
      econ: overs > 0   ? d(runsConceded / overs) : '—',
      sr:   wickets > 0 ? d((overs * 6) / wickets, 1) : '—',
    },
  };
}

// ── Source label helper ───────────────────────────────────────────────────────

const SOURCE_LABEL = {
  'sca':           { label: 'SCA Live',   color: '#1e40af', bg: '#e8f1ff' },
  'sca-corporate': { label: 'SCA Corp',   color: '#1e40af', bg: '#dbeafe' },
  'sgia-static':   { label: 'SG IA',      color: '#dc2626', bg: '#fef2f2' },
  'bpl-static':    { label: 'BPL',        color: '#7c3aed', bg: '#f3e8ff' },
  'ypl-static':    { label: 'YPL',        color: '#b45309', bg: '#fef3c7' },
};

function playerKey(p) {
  return p.id || `${p.source}-${p.name}`;
}

// ── Yearly performance helpers ────────────────────────────────────────────────

const LEAGUE_META = [
  { key: 'sgia-static',   label: 'SG IA',    runsColor: '#dc2626', wicketsColor: '#ef4444' },
  { key: 'bpl-static',    label: 'BPL',       runsColor: '#7c3aed', wicketsColor: '#a855f7' },
  { key: 'sca-corporate', label: 'SCA Corp',  runsColor: '#1e40af', wicketsColor: '#3b82f6' },
  { key: 'ypl-static',    label: 'YPL',       runsColor: '#b45309', wicketsColor: '#f59e0b' },
];

function calculateYearlyPlayerPerformance(players) {
  // byYear[year][sourceKey] = { runs, wickets }
  const byYear = {};

  const add = (yr, srcKey, runs, wkts) => {
    const y = String(yr);
    if (!byYear[y]) byYear[y] = {};
    if (!byYear[y][srcKey]) byYear[y][srcKey] = { runs: 0, wickets: 0 };
    byYear[y][srcKey].runs    += Number(runs) || 0;
    byYear[y][srcKey].wickets += Number(wkts) || 0;
  };

  for (const player of players) {
    const src = player.source;

    if (src === 'sgia-static') {
      for (const entry of player.entries || []) {
        if (entry.year) add(entry.year, src, entry.batting?.runs, entry.bowling?.wickets);
      }
    } else if (src === 'bpl-static') {
      if (player.year) add(player.year, src, player.batting?.runs, player.bowling?.wickets);
    } else if (src === 'sca-corporate') {
      for (const season of player.seasons || []) {
        if (season.year) add(season.year, src, season.batting?.runs, season.bowling?.wkts);
      }
    } else if (src === 'ypl-static') {
      const yr = player.seasons?.[0];
      if (yr) add(yr, src, player.inlineStats?.batting?.runs, player.inlineStats?.bowling?.wickets);
    }
    // sca (live) excluded — career aggregate only
  }

  const allYears = Object.keys(byYear).sort();
  if (allYears.length === 0) return null;

  // Build stacked chart data: each row has per-source runs/wickets
  const runsData = allYears.map(yr => {
    const row = { year: yr };
    for (const { key, label } of LEAGUE_META) row[label] = byYear[yr][key]?.runs ?? 0;
    return row;
  });
  const wicketsData = allYears.map(yr => {
    const row = { year: yr };
    for (const { key, label } of LEAGUE_META) row[label] = byYear[yr][key]?.wickets ?? 0;
    return row;
  });

  // Only include leagues that have at least one non-zero value
  const activeRunsLeagues    = LEAGUE_META.filter(({ label }) => runsData.some(r => r[label] > 0));
  const activeWicketsLeagues = LEAGUE_META.filter(({ label }) => wicketsData.some(r => r[label] > 0));

  return { runsData, wicketsData, activeRunsLeagues, activeWicketsLeagues };
}

function YearlyPerformanceSection({ players }) {
  const data = calculateYearlyPlayerPerformance(players);
  if (!data) return null;

  const { runsData, wicketsData, activeRunsLeagues, activeWicketsLeagues } = data;

  if (activeRunsLeagues.length === 0 && activeWicketsLeagues.length === 0) return null;

  return (
    <div style={{
      marginTop: '1.25rem',
      padding: '1.25rem',
      backgroundColor: '#f5f8fc',
      border: '1px solid #d0dae8',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(6,28,84,0.07)',
    }}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        📊 Yearly Performance Trend
      </div>
      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '1rem' }}>
        Stacked by league · SCA live excluded (career aggregate only)
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.25rem',
      }}>
        {activeRunsLeagues.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#0066cc', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>
              🏏 Runs Scored per Year
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={runsData} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {activeRunsLeagues.map(({ label, runsColor }, i) => (
                  <Bar key={label} dataKey={label} stackId="runs" fill={runsColor}
                    radius={i === activeRunsLeagues.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeWicketsLeagues.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>
              ⚡ Wickets Taken per Year
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={wicketsData} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {activeWicketsLeagues.map(({ label, wicketsColor }, i) => (
                  <Bar key={label} dataKey={label} stackId="wkts" fill={wicketsColor}
                    radius={i === activeWicketsLeagues.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cross-league panel ────────────────────────────────────────────────────────

function CrossLeaguePanel({ query, results, scaStatsMap, allLoaded }) {
  const [showPanel,   setShowPanel]   = useState(false);
  const [showNames,   setShowNames]   = useState(false);
  const [showGraph,   setShowGraph]   = useState(false);
  const [excluded,    setExcluded]    = useState(new Set());

  // Collect all players across all platforms
  const allPlayers = Object.values(results).flatMap(p => p.players || []);
  if (allPlayers.length === 0) return null;

  const { feasible, failedNames } = checkNameFeasibility(query, allPlayers);

  if (!feasible) {
    return (
      <div style={{
        marginTop: '1.5rem', padding: '1rem 1.25rem',
        backgroundColor: '#fef9ec', border: '1px solid #fcd34d',
        borderRadius: '10px', fontSize: '13px', color: '#92400e',
      }}>
        <strong>Cross-league aggregation not feasible</strong> — name check failed for:{' '}
        <em>{failedNames.join(', ')}</em>. Results contain players with names unrelated to the search query.
      </div>
    );
  }

  const includedPlayers  = allPlayers.filter(p => !excluded.has(playerKey(p)));
  const excludedPlayers  = allPlayers.filter(p =>  excluded.has(playerKey(p)));

  const fullNormalized     = allPlayers.map(p => normalizeForAgg(p, scaStatsMap));
  const fullAgg            = aggregateAll(fullNormalized);

  const adjustedNormalized = includedPlayers.map(p => normalizeForAgg(p, scaStatsMap));
  const adjustedAgg        = aggregateAll(adjustedNormalized);

  const hasExclusions = excluded.size > 0;

  function toggleExclude(p) {
    const key = playerKey(p);
    setExcluded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <div style={{ marginTop: '1.5rem' }}>

      {/* ── Primary action button ── */}
      {!allLoaded ? (
        <button disabled style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          padding: '0.75rem 1.5rem', borderRadius: '8px',
          backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1',
          color: '#64748b', fontSize: '13px', fontWeight: '600', cursor: 'not-allowed',
        }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #94a3b8', borderTopColor: '#0066cc', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Waiting for data load...
        </button>
      ) : (
        <button
          onClick={() => setShowPanel(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.75rem 1.5rem', borderRadius: '8px',
            backgroundColor: showPanel ? '#e8f1ff' : '#0066cc',
            border: `1px solid ${showPanel ? '#bcd0f0' : '#0050aa'}`,
            color: showPanel ? '#0066cc' : '#fff',
            fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <span>✅</span>
          {showPanel ? 'Hide cross-league performance' : 'Data load complete — View performance across leagues'}
        </button>
      )}

      {allLoaded && showPanel && (
        <div style={{ marginTop: '1rem' }}>

          {/* ── Section 1: Full aggregated performance ── */}
          <AggregatedStatsPanel
            agg={fullAgg}
            title="Aggregated performance across all leagues"
            accentBat="#0066cc"
            accentBowl="#7c3aed"
          />

          {/* ── Section 2: Yearly graph toggle ── */}
          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={() => setShowGraph(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 1.1rem', borderRadius: '7px',
                backgroundColor: showGraph ? '#f0f4ff' : '#f8fafc',
                border: `1px solid ${showGraph ? '#bcd0f0' : '#d0dae8'}`,
                cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                color: showGraph ? '#0066cc' : '#1e293b',
              }}
            >
              <span>📊</span>
              {showGraph ? 'Hide Yearly Performance Graph' : 'View Yearly Performance Graph'}
            </button>
            {showGraph && (
              <YearlyPerformanceSection players={includedPlayers} />
            )}
          </div>

          {/* ── Section 3: Players considered ── */}
          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={() => setShowNames(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 1.1rem', borderRadius: '7px',
                backgroundColor: showNames ? '#f1f5f9' : '#f8fafc',
                border: '1px solid #d0dae8', cursor: 'pointer',
                fontSize: '12px', fontWeight: '600', color: '#1e293b',
              }}
            >
              <span>{showNames ? '▲' : '▼'}</span>
              Players considered for aggregation ({allPlayers.length})
              {hasExclusions && (
                <span style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '4px', padding: '1px 6px', fontSize: '11px' }}>
                  {excluded.size} excluded
                </span>
              )}
            </button>

            {showNames && (
              <div style={{
                marginTop: '0.5rem', padding: '1rem',
                backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: '10px',
              }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '0.75rem' }}>
                  Click ✕ to exclude a player from aggregation. Click again to restore.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {allPlayers.map(p => {
                    const key   = playerKey(p);
                    const isOut = excluded.has(key);
                    const src   = SOURCE_LABEL[p.source] || { label: p.source, color: '#64748b', bg: '#f1f5f9' };
                    return (
                      <div
                        key={key}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.35rem 0.65rem', borderRadius: '6px',
                          backgroundColor: isOut ? '#fef2f2' : '#fff',
                          border: `1px solid ${isOut ? '#fecaca' : '#d0dae8'}`,
                          opacity: isOut ? 0.6 : 1,
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{
                          fontSize: '10px', fontWeight: '700',
                          color: src.color, backgroundColor: src.bg,
                          padding: '1px 5px', borderRadius: '3px',
                        }}>{src.label}</span>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: isOut ? '#94a3b8' : '#1e293b' }}>
                          {p.name}
                        </span>
                        <button
                          onClick={() => toggleExclude(p)}
                          title={isOut ? 'Restore player' : 'Exclude from aggregation'}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '13px', lineHeight: 1, padding: '0 1px',
                            color: isOut ? '#16a34a' : '#dc2626', fontWeight: '700',
                          }}
                        >
                          {isOut ? '↩' : '✕'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Section 4: Adjusted performance (only when exclusions exist) ── */}
          {hasExclusions && (
            <div style={{ marginTop: '1rem' }}>
              <AggregatedStatsPanel
                agg={adjustedAgg}
                title={`Adjusted performance — excluding ${excludedPlayers.map(p => p.name).join(', ')}`}
                accentBat="#16a34a"
                accentBowl="#0891b2"
                adjusted
              />
            </div>
          )}

        </div>
      )}
    </div>
  );
}

function AggregatedStatsPanel({ agg, title, accentBat, accentBowl, adjusted }) {
  const { batting: b, bowling: bwl, hasBat, hasBowl } = agg;

  const Cell = ({ label, value, accent }) => (
    <div style={{
      backgroundColor: '#fff', border: '1px solid #d0dae8', borderRadius: '10px',
      padding: '1rem', textAlign: 'center', boxShadow: '0 1px 3px rgba(6,28,84,0.05)',
    }}>
      <div style={{ fontSize: '22px', fontWeight: '700', color: accent }}>{value}</div>
      <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '4px' }}>{label}</div>
    </div>
  );

  return (
    <div style={{
      padding: '1.25rem',
      backgroundColor: adjusted ? '#f0fdf4' : '#f5f8fc',
      border: `1px solid ${adjusted ? '#bbf7d0' : '#d0dae8'}`,
      borderRadius: '12px', boxShadow: '0 2px 8px rgba(6,28,84,0.07)',
    }}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: adjusted ? '#15803d' : '#1e293b', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {adjusted && '↻ '}{title}
      </div>

      {hasBat && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: accentBat, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>🏏 Batting</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.6rem' }}>
            <Cell label="Matches" value={b.mat}  accent={accentBat} />
            <Cell label="Runs"    value={b.runs} accent={accentBat} />
            <Cell label="Bat Avg" value={b.avg}  accent={accentBat} />
            <Cell label="Bat SR"  value={b.sr}   accent={accentBat} />
          </div>
        </div>
      )}

      {hasBowl && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: accentBowl, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>⚡ Bowling</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.6rem' }}>
            <Cell label="Overs"   value={bwl.overs}   accent={accentBowl} />
            <Cell label="Wickets" value={bwl.wickets} accent={accentBowl} />
            <Cell label="Economy" value={bwl.econ}    accent={accentBowl} />
            <Cell label="Bowl SR" value={bwl.sr}      accent={accentBowl} />
          </div>
        </div>
      )}

      {!hasBat && !hasBowl && (
        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '1rem 0' }}>
          No stats available.
        </div>
      )}

      <div style={{ marginTop: '0.75rem', fontSize: '10px', color: '#94a3b8', fontStyle: 'italic' }}>
        Batting avg = runs ÷ dismissals · Batting SR = (runs ÷ balls) × 100 ·
        Economy = runs ÷ overs · Bowl SR = balls ÷ wickets.
        SCA live balls estimated from runs ÷ strike rate.
      </div>
    </div>
  );
}
// ── Background stats fetcher — fires for all SCA live players immediately,
//    independent of whether the accordion section is open. This ensures
//    allLoaded becomes true as soon as all stats resolve, not when user expands.

function ScaBackgroundFetcher({ players, onStatsResolved }) {
  useEffect(() => {
    for (const player of players) {
      if (!player.id) { onStatsResolved(player.id, null); continue; }
      fetchAnyPlayerStats(player)
        .then(data => onStatsResolved(player.id, normalizeStats(data)))
        .catch(() => onStatsResolved(player.id, null));
    }
  // Run once per player list — query changes cause parent to remount this anyway
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null; // renders nothing
}

// ── Main aggregated results component ────────────────────────────────────────

export function AggregatedResults({ searchResults }) {
  const { query, results, totalFound, meta } = searchResults;

  const [expandedPlatform, setExpandedPlatform] = useState(null);
  const [scaStatsMap, setScaStatsMap]           = useState(new Map());
  const [resolvedCount, setResolvedCount]       = useState(0);

  // All SCA live players — fetched in background regardless of accordion state
  const scaLivePlayers = (results['SCA']?.players || []).filter(p => p.source === 'sca');
  const totalScaLive   = scaLivePlayers.length;
  const allLoaded      = totalScaLive === 0 || resolvedCount >= totalScaLive;

  function handleStatsResolved(playerId, stats) {
    setScaStatsMap(prev => { const m = new Map(prev); m.set(playerId, stats); return m; });
    setResolvedCount(prev => prev + 1);
  }

  if (!results || Object.keys(results).length === 0) return null;

  if (totalFound === 0) {
    const errors = Object.values(results).filter((p) => p.error);
    return (
      <div style={{
        padding: '3rem 1.5rem', textAlign: 'center', color: '#64748b',
        backgroundColor: '#eef2f9', borderRadius: '12px',
        border: '1px solid #d0dae8', marginTop: '2rem',
      }}>
        <div style={{ fontSize: '56px', marginBottom: '1rem' }}>🔍</div>
        <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '0.5rem', color: '#1e293b' }}>
          No results found
        </div>
        <div style={{ fontSize: '14px' }}>
          No players matching "<strong>{query}</strong>" found on live platforms
        </div>
        {errors.length > 0 && (
          <div style={{ marginTop: '1rem', fontSize: '13px', color: '#dc2626' }}>
            ⚠️ {errors.length} platform{errors.length > 1 ? 's' : ''} returned errors. Check backend connectivity.
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ margin: '0 0 0.75rem 0', fontSize: '20px', fontWeight: '600', color: '#1e293b' }}>
          Results for "<span style={{ color: '#0066cc' }}>{query}</span>"
        </h2>
        <div style={{ fontSize: '14px', color: '#64748b' }}>
          Found <strong style={{ color: '#0066cc' }}>{totalFound}</strong> player{totalFound !== 1 ? 's' : ''} across platforms
          {meta?.live && <span style={{ marginLeft: '0.5rem', fontSize: '12px', color: '#16a34a' }}>● {meta.live.length} live</span>}
          {meta?.static && <span style={{ marginLeft: '0.5rem', fontSize: '12px', color: '#b45309' }}>● {meta.static.length} static</span>}
        </div>
      </div>

      {/* Background fetcher — mounts immediately, fetches all SCA live stats
          regardless of whether the SCA accordion is open */}
      {scaLivePlayers.length > 0 && (
        <ScaBackgroundFetcher
          players={scaLivePlayers}
          onStatsResolved={handleStatsResolved}
        />
      )}

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {Object.entries(results)
          .filter(([, p]) => !p.noResults || p.error)
          .map(([platformKey, platformData]) => (
            <PlatformSection
              key={platformKey}
              platformData={platformData}
              isExpanded={expandedPlatform === platformKey}
              onToggle={() =>
                setExpandedPlatform(expandedPlatform === platformKey ? null : platformKey)
              }
            />
          ))}
      </div>

      <CrossLeaguePanel
        query={query}
        results={results}
        scaStatsMap={scaStatsMap}
        allLoaded={allLoaded}
      />

      {allLoaded && (
        <PlayerInsightsSection
          results={results}
          scaStatsMap={scaStatsMap}
        />
      )}
    </div>
  );
}

// ── Platform section ──────────────────────────────────────────────────────────

function PlatformSection({ platformData, isExpanded, onToggle }) {
  const { platformName, count, players, noResults, icon, disabled, disabledReason, error } = platformData;
  const isLive = !disabled;

  return (
    <div style={{
      backgroundColor: '#f5f8fc',
      border: `1px solid ${error ? '#fecaca' : '#d0dae8'}`,
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 2px 6px rgba(6, 28, 84, 0.08)',
      opacity: disabled ? 0.6 : 1,
    }}>
      <button
        onClick={disabled ? undefined : onToggle}
        style={{
          width: '100%', padding: '1.5rem',
          backgroundColor: error ? '#fef2f2' : '#f5f8fc',
          border: 'none',
          borderBottom: isExpanded ? '1px solid #d0dae8' : 'none',
          cursor: disabled ? 'default' : 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            backgroundColor: isLive ? '#e8f1ff' : '#f3f4f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isLive ? '#0066cc' : '#9ca3af',
            fontWeight: 'bold', fontSize: '16px',
          }}>
            {icon.code}
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: '600', fontSize: '15px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {platformName}
              {isLive && <span style={{ fontSize: '8px', color: '#16a34a' }}>●</span>}
              {isLive && <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: '500' }}>LIVE</span>}
              {disabled && (
                <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: '500', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>
                  {disabledReason}
                </span>
              )}
            </div>
            {platformName === 'SCA' && (
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                live + static corporate · cognizant
              </div>
            )}
            {error && <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px' }}>Error: {error}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {noResults && !error && !disabled ? (
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>No results</span>
          ) : !disabled && !error && count > 0 ? (
            <span style={{
              backgroundColor: '#e8f1ff', color: '#0066cc',
              padding: '0.375rem 0.875rem', borderRadius: '6px',
              fontSize: '12px', fontWeight: '600',
            }}>
              {count} found
            </span>
          ) : null}
          {!disabled && (
            <span style={{
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s', fontSize: '16px', color: '#0066cc', fontWeight: 'bold',
            }}>▼</span>
          )}
        </div>
      </button>

      {isExpanded && !noResults && !disabled && (
        <div style={{ padding: '1.25rem', borderTop: '1px solid #d0dae8' }}>
          {players.map((player, idx) =>
            player.source === 'ypl-static' ? (
              <YPLPlayerCard
                key={player.id || idx}
                player={player}
                isLast={idx === players.length - 1}
              />
            ) : player.source === 'sgia-static' ? (
              <SGIAPlayerCard
                key={player.id || idx}
                player={player}
                isLast={idx === players.length - 1}
              />
            ) : player.source === 'sca-corporate' ? (
              <SCACorpPlayerCard
                key={player.id || idx}
                player={player}
                isLast={idx === players.length - 1}
              />
            ) : player.source === 'bpl-static' ? (
              <BPLPlayerCard
                key={player.id || idx}
                player={player}
                isLast={idx === players.length - 1}
              />
            ) : (
              <PlayerCard
                key={`${player.source || 'p'}-${player.id || idx}`}
                player={player}
                platformName={platformName}
                isLast={idx === players.length - 1}
              />
            )
          )}
        </div>
      )}

      {isExpanded && noResults && !disabled && !error && (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', fontSize: '14px', backgroundColor: '#eef2f9' }}>
          No players found matching your search on {platformName}.
        </div>
      )}
    </div>
  );
}

// ── Player card with auto-fetched stats ───────────────────────────────────────

function PlayerCard({ player, platformName, isLast }) {
  const { id, name, team, role, profileUrl, verified } = player;
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(!!id);
  const [statsError, setStatsError] = useState(!id ? 'Player ID unavailable — cannot load stats.' : null);

  useEffect(() => {
    if (!id) return;
    setStatsLoading(true);
    setStatsError(null);
    fetchAnyPlayerStats(player)
      .then((data) => { setStats(normalizeStats(data)); setStatsLoading(false); })
      .catch((err) => { setStatsError(err.message || 'Could not load player statistics.'); setStatsLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const hasBatting = stats?.batting && stats.batting.matches !== null;
  const hasBowling = stats?.bowling && stats.bowling.matches !== null;

  return (
    <div style={{
      marginBottom: isLast ? 0 : '1.5rem',
      backgroundColor: '#ffffff',
      border: '1px solid #d0dae8',
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(6, 28, 84, 0.06)',
    }}>
      {/* ── Player identity header ── */}
      <div style={{
        padding: '1rem 1.25rem',
        backgroundColor: '#eef2f9',
        borderBottom: '1px solid #d0dae8',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '16px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {name}
            {verified !== undefined && (
              <span title={verified ? 'Verified Player' : 'Not Verified'} style={{ fontSize: '14px' }}>
                {verified ? '✅' : '❓'}
              </span>
            )}
          </h4>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
            {team} · <span style={{ color: '#0066cc', fontSize: '12px' }}>{platformName}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {role && (
            <span style={{
              backgroundColor: '#e8f1ff', color: '#0066cc',
              padding: '0.25rem 0.75rem', borderRadius: '6px',
              fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap',
            }}>
              {role}
            </span>
          )}
        </div>
      </div>

      {/* ── Stats body ── */}
      <div style={{ padding: '1rem 1.25rem' }}>

        {/* Loading state */}
        {statsLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', color: '#64748b' }}>
            <span style={{ fontSize: '18px', animation: 'statspin 1s linear infinite', display: 'inline-block' }}>⟳</span>
            <span style={{ fontSize: '13px' }}>Loading stats...</span>
            <style>{`@keyframes statspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── KEY STATS SUMMARY ROW (always shown when loaded) ── */}
        {!statsLoading && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.5rem',
            marginBottom: (hasBatting || hasBowling) ? '1rem' : 0,
          }}>
            <StatBox
              label="Matches"
              value={hasBatting ? stats.batting.matches : hasBowling ? stats.bowling.matches : null}
              highlight
            />
            <StatBox
              label="Runs"
              value={hasBatting ? stats.batting.runs : null}
              highlight
            />
            <StatBox
              label="Average"
              value={hasBatting ? fmt(stats.batting.average) : null}
              highlight
            />
            <StatBox
              label="Wickets"
              value={hasBowling ? stats.bowling.wickets : null}
              highlight
              color="#7c3aed"
            />
          </div>
        )}

        {/* No stats at all */}
        {!statsLoading && !statsError && stats && !hasBatting && !hasBowling && (
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '0.5rem' }}>
            No match statistics recorded for this player yet.
          </div>
        )}

        {/* Stats fetch error — summary row already shows N/A; just note the cause */}
        {!statsLoading && statsError && (
          <div style={{ fontSize: '11px', color: '#9a3412', marginBottom: '0.5rem' }}>
            ⚠️ Could not load detailed stats — profile page unavailable.
          </div>
        )}

        {/* ── DETAILED BATTING (collapsible) ── */}
        {!statsLoading && hasBatting && (
          <ExpandableSection label="🏏 Full Batting" accentColor="#0066cc">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: '0.4rem' }}>
              <StatBox label="Innings" value={stats.batting.innings} small />
              <StatBox label="NO" value={stats.batting.notOuts} small />
              <StatBox label="HS" value={stats.batting.highestScore} small />
              <StatBox label="SR" value={fmt(stats.batting.strikeRate)} small />
              {stats.batting.fifties !== null && <StatBox label="50s" value={stats.batting.fifties} small />}
              {stats.batting.centuries !== null && <StatBox label="100s" value={stats.batting.centuries} small />}
              {stats.batting.fours !== null && <StatBox label="4s" value={stats.batting.fours} small />}
              {stats.batting.sixes !== null && <StatBox label="6s" value={stats.batting.sixes} small />}
            </div>
          </ExpandableSection>
        )}

        {/* ── DETAILED BOWLING (collapsible) ── */}
        {!statsLoading && hasBowling && (
          <ExpandableSection label="⚡ Full Bowling" accentColor="#7c3aed">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: '0.4rem' }}>
              <StatBox label="Overs" value={stats.bowling.overs} small />
              <StatBox label="Mdns" value={stats.bowling.maidens} small />
              <StatBox label="Runs" value={stats.bowling.runs} small />
              {stats.bowling.strikeRate !== null && <StatBox label="SR" value={fmt(stats.bowling.strikeRate)} small />}
              {stats.bowling.economy !== null && <StatBox label="Eco" value={fmt(stats.bowling.economy)} small />}
              {stats.bowling.bestBowling && <StatBox label="Best" value={stats.bowling.bestBowling} small />}
            </div>
          </ExpandableSection>
        )}

        {/* Competition breakdown (collapsible) */}
        {!statsLoading && stats?.competitions?.length > 0 && (
          <CompetitionsPanel competitions={stats.competitions} />
        )}
      </div>

      {/* ── Footer: source attribution ── */}
      <div style={{
        padding: '0.6rem 1.25rem',
        backgroundColor: '#f8fafc',
        borderTop: '1px solid #e8eef5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
          Source: {platformName}
        </span>
        {profileUrl && (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '11px', color: '#94a3b8', textDecoration: 'none', fontWeight: '500' }}
          >
            Source Profile ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ── Competition/season breakdown ──────────────────────────────────────────────

function CompetitionsPanel({ competitions }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: '1rem', borderTop: '1px solid #e8eef5', paddingTop: '0.75rem' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '12px', color: '#0066cc', fontWeight: '600', padding: 0,
          display: 'flex', alignItems: 'center', gap: '0.4rem',
        }}
      >
        <span style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.2s' }}>▶</span>
        Competition breakdown ({competitions.length})
      </button>

      {open && (
        <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
          {competitions.map((c, i) => (
            <div key={i} style={{
              padding: '0.6rem 0.75rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '12px',
            }}>
              <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '0.25rem' }}>
                {c.competition} <span style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>{c.type}</span>
              </div>
              <div style={{ display: 'flex', gap: '1rem', color: '#64748b' }}>
                {c.matches != null && <span>M: <strong>{c.matches}</strong></span>}
                {c.runs != null && <span>Runs: <strong>{c.runs}</strong></span>}
                {c.average != null && <span>Avg: <strong>{c.average}</strong></span>}
                {c.highestScore && <span>HS: <strong>{c.highestScore}</strong></span>}
                {c.wickets != null && <span>Wkts: <strong>{c.wickets}</strong></span>}
                {c.economy != null && <span>Eco: <strong>{c.economy}</strong></span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Expandable section (for full batting/bowling details) ─────────────────────

function ExpandableSection({ label, accentColor, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: '0.75rem' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0.4rem 0',
          fontSize: '11px', fontWeight: '700', color: accentColor,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          display: 'flex', alignItems: 'center', gap: '0.35rem',
        }}
      >
        <span style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.15s' }}>▶</span>
        {label}
      </button>
      {open && <div style={{ marginTop: '0.25rem' }}>{children}</div>}
    </div>
  );
}

// ── Stat box ──────────────────────────────────────────────────────────────────

function StatBox({ label, value, highlight = false, color = '#0066cc', small = false }) {
  const displayValue = value !== null && value !== undefined ? String(value) : 'N/A';
  return (
    <div style={{
      backgroundColor: highlight ? '#f0f6ff' : '#f8fafc',
      padding: small ? '0.4rem 0.35rem' : '0.65rem 0.5rem',
      borderRadius: '6px',
      textAlign: 'center',
      border: `1px solid ${highlight ? '#bcd0f0' : '#e2e8f0'}`,
      minWidth: small ? '50px' : '60px',
    }}>
      <div style={{ fontSize: small ? '12px' : '15px', fontWeight: '700', color: highlight ? color : '#1e293b' }}>
        {displayValue}
      </div>
      <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '600', marginTop: '0.15rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  );
}

// ── YPL Static player card ────────────────────────────────────────────────────
// Renders pre-loaded batting + bowling stats from the Assasins CC static dataset.
// No API call is made — all data is bundled in player.inlineStats.

function YPLPlayerCard({ player, isLast }) {
  const { name, team, seasons, competition, inlineStats } = player;
  const { batting: b, bowling: bwl } = inlineStats || {};
  const [battingOpen, setBattingOpen] = useState(false);
  const [bowlingOpen, setBowlingOpen] = useState(false);

  const d = (v, decimals = 0) => {
    if (v === null || v === undefined) return '--';
    return decimals > 0 ? Number(v).toFixed(decimals) : String(v);
  };

  const hasBatting = b && (b.innings > 0 || b.runs > 0);
  const hasBowling = bwl !== null && bwl !== undefined;

  return (
    <div style={{
      marginBottom: isLast ? 0 : '1.5rem',
      backgroundColor: '#fff',
      border: '1px solid #d0dae8',
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(6,28,84,0.06)',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.25rem',
        backgroundColor: '#fdf8f0',
        borderBottom: '1px solid #f0d9a8',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <h4 style={{ margin: '0 0 0.25rem', fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
            {name}
          </h4>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
            {team}
            <span style={{ margin: '0 0.4rem', color: '#d0dae8' }}>·</span>
            <span style={{ color: '#b45309' }}>YPL Elite</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {seasons.map((s) => (
            <span key={s} style={{
              backgroundColor: '#fef3c7', color: '#92400e',
              padding: '0.2rem 0.6rem', borderRadius: '5px',
              fontSize: '11px', fontWeight: '600',
            }}>{s}</span>
          ))}
          <span style={{
            backgroundColor: '#e8f1ff', color: '#0066cc',
            padding: '0.2rem 0.6rem', borderRadius: '5px',
            fontSize: '11px', fontWeight: '600',
          }}>{competition}</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '1rem 1.25rem' }}>

        {/* Summary row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.5rem', marginBottom: '0.75rem',
        }}>
          <StatBox label="Matches"  value={b?.matches}  highlight />
          <StatBox label="Runs"     value={b?.runs}     highlight />
          <StatBox label="Bat Avg"  value={d(b?.average, 2)} highlight />
          <StatBox label="Wickets"  value={hasBowling ? bwl.wickets : '--'} highlight color="#7c3aed" />
        </div>

        {/* Batting details */}
        {hasBatting && (
          <div style={{ marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
            <button
              onClick={() => setBattingOpen((o) => !o)}
              style={expandBtnStyle('#0066cc')}
            >
              <span style={{ ...arrowStyle, transform: battingOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
              🏏 Batting Stats
            </button>

            {battingOpen && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                  <div>
                    <BattingRow label="Innings"       value={d(b.innings)} />
                    <BattingRow label="Not Outs"      value={d(b.not_outs)} />
                    <BattingRow label="Balls"         value={d(b.balls)} />
                    <BattingRow label="Strike Rate"   value={d(b.strike_rate, 2)} />
                    <BattingRow label="Highest Score" value={d(b.highest_score)} />
                  </div>
                  <div>
                    <BattingRow label="100s"   value={d(b.hundreds)} />
                    <BattingRow label="75s"    value={d(b.seventy_fives)} />
                    <BattingRow label="50s"    value={d(b.fifties)} />
                    <BattingRow label="25s"    value={d(b.twenty_fives)} />
                    <BattingRow label="Ducks"  value={d(b.ducks)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bowling details */}
        <div style={{ marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
          {hasBowling ? (
            <>
              <button
                onClick={() => setBowlingOpen((o) => !o)}
                style={expandBtnStyle('#7c3aed')}
              >
                <span style={{ ...arrowStyle, transform: bowlingOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                ⚡ Bowling Stats
              </button>

              {bowlingOpen && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                    <div>
                      <BattingRow label="Innings"        value={d(bwl.innings)} />
                      <BattingRow label="Overs"          value={d(bwl.overs)} />
                      <BattingRow label="Runs Conceded"  value={d(bwl.runs_conceded)} />
                      <BattingRow label="Best Bowling"   value={bwl.best_bowling || '--'} />
                      <BattingRow label="Maidens"        value={d(bwl.maidens)} />
                    </div>
                    <div>
                      <BattingRow label="Economy"        value={d(bwl.economy, 2)} />
                      <BattingRow label="Average"        value={d(bwl.average, 2)} />
                      <BattingRow label="Strike Rate"    value={d(bwl.strike_rate, 2)} />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
              No bowling record available
            </div>
          )}
        </div>

        {/* All-round summary when player has both */}
        {hasBatting && hasBowling && bwl.wickets > 0 && (
          <div style={{
            marginTop: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem',
            fontSize: '12px', color: '#64748b',
          }}>
            <strong style={{ color: '#1e293b' }}>All-Round:</strong>
            {' '}{b.runs} runs · {bwl.wickets} wickets
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '0.5rem 1.25rem',
        backgroundColor: '#fdf8f0',
        borderTop: '1px solid #f0d9a8',
        fontSize: '11px', color: '#b45309',
      }}>
        YPL Elite · Assasins CC · Seasons {seasons.join(', ')} · Static Data
      </div>
    </div>
  );
}

function BattingRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.3rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px',
    }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ fontWeight: '600', color: '#1e293b' }}>{value}</span>
    </div>
  );
}

const expandBtnStyle = (color) => ({
  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
  fontSize: '11px', fontWeight: '700', color, textTransform: 'uppercase',
  letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: '0.35rem',
});

const arrowStyle = {
  display: 'inline-block', transition: 'transform 0.15s',
};

// ── SG IA Static player card ──────────────────────────────────────────────────
// Renders per-tournament batting + bowling stats from the SG IA static dataset.
// No API call — all data is bundled in player.entries[].

function SGIAPlayerCard({ player, isLast }) {
  const { name, team, lastUpdated, entries } = player;

  const fmtDate = (iso) => {
    try {
      return new Date(iso).toLocaleString('en-SG', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      });
    } catch {
      return iso;
    }
  };

  const d = (v, dec = 0) => (v === null || v === undefined ? '--' : dec > 0 ? Number(v).toFixed(dec) : String(v));

  return (
    <div style={{
      marginBottom: isLast ? 0 : '1.5rem',
      backgroundColor: '#fff',
      border: '1px solid #d0dae8',
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(6,28,84,0.06)',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.25rem',
        background: 'linear-gradient(135deg, #fff1f2 0%, #fee2e2 100%)',
        borderBottom: '1px solid #fecaca',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <h4 style={{ margin: '0 0 0.25rem', fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
            {name}
          </h4>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
            {team}
            <span style={{ margin: '0 0.4rem', color: '#d0dae8' }}>·</span>
            <span style={{ color: '#dc2626', fontWeight: '600' }}>SG IA</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{
            backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
            padding: '0.2rem 0.6rem', borderRadius: '5px', fontSize: '11px', fontWeight: '600',
          }}>🇸🇬 SIA</span>
          <div style={{ marginTop: '0.4rem', fontSize: '10px', color: '#94a3b8' }}>
            Updated: {fmtDate(lastUpdated)}
          </div>
        </div>
      </div>

      {/* Tournament entries */}
      <div style={{ padding: '1rem 1.25rem' }}>
        {entries.map((entry, ei) => (
          <SGIATournamentEntry key={entry.tournamentId} entry={entry} isLast={ei === entries.length - 1} d={d} />
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '0.5rem 1.25rem',
        background: 'linear-gradient(135deg, #fff1f2 0%, #fee2e2 100%)',
        borderTop: '1px solid #fecaca',
        fontSize: '11px', color: '#dc2626',
      }}>
        Singapore Indian Association · Season 2025 · Static Data (updated ~15 days)
      </div>
    </div>
  );
}

function SGIATournamentEntry({ entry, isLast, d }) {
  const { tournamentName, year, status, batting: b, bowling: bwl } = entry;
  const [battingOpen, setBattingOpen] = useState(false);
  const [bowlingOpen, setBowlingOpen] = useState(false);

  const hasBatting = !!b;
  const hasBowling = !!bwl;

  return (
    <div style={{
      marginBottom: isLast ? 0 : '1rem',
      paddingBottom: isLast ? 0 : '1rem',
      borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
    }}>
      {/* Tournament badge row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{
          backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
          padding: '0.2rem 0.6rem', borderRadius: '5px', fontSize: '11px', fontWeight: '700',
        }}>{tournamentName}</span>
        <span style={{
          backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
          padding: '0.2rem 0.5rem', borderRadius: '5px', fontSize: '10px', fontWeight: '600',
        }}>{year}</span>
        <span style={{
          backgroundColor: status === 'completed' ? '#f0fdf4' : status === 'on-going' ? '#eff6ff' : '#fefce8',
          color: status === 'completed' ? '#15803d' : status === 'on-going' ? '#1d4ed8' : '#a16207',
          border: `1px solid ${status === 'completed' ? '#bbf7d0' : status === 'on-going' ? '#bfdbfe' : '#fef08a'}`,
          padding: '0.2rem 0.5rem', borderRadius: '5px', fontSize: '10px', fontWeight: '600',
        }}>{status === 'completed' ? '✓ Completed' : status === 'on-going' ? '● On-going' : '⏳ In Progress'}</span>
        {status === 'on-going' && (
          <span style={{
            fontSize: '10px', color: '#64748b', fontStyle: 'italic', marginLeft: '0.25rem',
          }}>Stats updated every 15 days. Last update: 4th June.</span>
        )}
      </div>

      {/* Summary stat boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <StatBox label="Matches" value={hasBatting ? b.mat : hasBowling ? bwl.mat : null} highlight />
        <StatBox label="Runs" value={hasBatting ? b.runs : null} highlight />
        <StatBox label="Bat Avg" value={hasBatting ? d(b.avg, 2) : '--'} highlight />
        <StatBox label="Wickets" value={hasBowling ? bwl.wickets : '--'} highlight color="#dc2626" />
      </div>

      {/* Batting detail */}
      {hasBatting && (
        <div style={{ marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.6rem' }}>
          <button onClick={() => setBattingOpen((o) => !o)} style={expandBtnStyle('#dc2626')}>
            <span style={{ ...arrowStyle, transform: battingOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
            🏏 Batting (Rank #{b.rank})
          </button>
          {battingOpen && (
            <div style={{ marginTop: '0.6rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(68px,1fr))', gap: '0.4rem' }}>
              <StatBox label="Inns" value={b.inns} small />
              <StatBox label="Balls" value={b.balls} small />
              <StatBox label="HS" value={b.highest} small />
              <StatBox label="NO" value={b.no} small />
              <StatBox label="SR" value={d(b.sr, 2)} small />
              <StatBox label="50s" value={b.fifties} small />
              <StatBox label="100s" value={b.hundreds} small />
              <StatBox label="4s" value={b.fours} small />
              <StatBox label="6s" value={b.sixes} small />
              <StatBox label="Hand" value={b.hand} small />
            </div>
          )}
        </div>
      )}

      {/* Bowling detail */}
      {hasBowling && (
        <div style={{ marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.6rem' }}>
          <button onClick={() => setBowlingOpen((o) => !o)} style={expandBtnStyle('#7c3aed')}>
            <span style={{ ...arrowStyle, transform: bowlingOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
            ⚡ Bowling (Rank #{bwl.rank})
          </button>
          {bowlingOpen && (
            <div style={{ marginTop: '0.6rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(68px,1fr))', gap: '0.4rem' }}>
              <StatBox label="Overs" value={bwl.overs} small />
              <StatBox label="Runs" value={bwl.runs} small />
              <StatBox label="Best" value={`${bwl.highest}`} small />
              <StatBox label="Mdns" value={bwl.maidens} small />
              <StatBox label="Avg" value={d(bwl.avg, 2)} small />
              <StatBox label="Econ" value={d(bwl.econ, 2)} small />
              <StatBox label="Style" value={bwl.style?.replace('Right-arm ', 'RA ').replace('Left-arm ', 'LA ')} small />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(val) {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? val : n.toFixed(2).replace(/\.?0+$/, '');
}

// ── BPL player card (static, no API fetch) ───────────────────────────────────
// Expects leaderboard format: batting/bowling use short field names
// (mat, inns, runs, avg, sr, highest, no, balls, hand, fours, sixes, fifties,
//  hundreds, wickets, econ, overs, maidens, style)

function BPLPlayerCard({ player, isLast }) {
  const { name, team, batting: b, bowling: bwl, tournament, lastUpdated } = player;
  const [battingOpen, setBattingOpen] = useState(false);
  const [bowlingOpen, setBowlingOpen] = useState(false);

  const d = (v, dec = 0) => (v === null || v === undefined ? '--' : dec > 0 ? Number(v).toFixed(dec) : String(v));

  const hasBatting = b && b.inns > 0;
  const hasBowling = bwl && bwl.inns > 0;

  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return iso; }
  };

  return (
    <div style={{
      marginBottom: isLast ? 0 : '1.5rem',
      backgroundColor: '#ffffff',
      border: '1px solid #d0dae8',
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(6, 28, 84, 0.06)',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.25rem',
        background: 'linear-gradient(135deg, #3b0764 0%, #7c3aed 100%)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '16px', fontWeight: '700', color: '#ffffff' }}>
            {name}
          </h4>
          <div style={{ fontSize: '12px', color: '#e9d5ff', fontWeight: '500' }}>{team}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
          <span style={{
            backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff',
            padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '10px', fontWeight: '700',
          }}>{tournament || 'BPL'}</span>
          <span style={{ fontSize: '9px', color: '#c4b5fd' }}>as of {fmtDate(lastUpdated)}</span>
        </div>
      </div>

      {/* Summary stat boxes */}
      <div style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <StatBox label="Matches"  value={hasBatting ? b.mat : hasBowling ? bwl.mat : null} highlight />
          <StatBox label="Runs"     value={hasBatting ? b.runs : null} highlight />
          <StatBox label="Bat Avg"  value={hasBatting ? d(b.avg, 2) : '--'} highlight />
          <StatBox label="Wickets"  value={hasBowling ? bwl.wickets : '--'} highlight color="#7c3aed" />
        </div>

        {/* Batting detail */}
        {hasBatting && (
          <div style={{ marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.6rem' }}>
            <button onClick={() => setBattingOpen((o) => !o)} style={expandBtnStyle('#7c3aed')}>
              <span style={{ ...arrowStyle, transform: battingOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
              🏏 Batting (Rank #{b.rank})
            </button>
            {battingOpen && (
              <div style={{ marginTop: '0.6rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(68px,1fr))', gap: '0.4rem' }}>
                <StatBox label="Inns"  value={b.inns}         small />
                <StatBox label="Balls" value={b.balls}        small />
                <StatBox label="HS"    value={b.highest}      small />
                <StatBox label="NO"    value={b.no}           small />
                <StatBox label="SR"    value={d(b.sr, 2)}     small />
                <StatBox label="50s"   value={b.fifties}      small />
                <StatBox label="100s"  value={b.hundreds}     small />
                <StatBox label="4s"    value={b.fours}        small />
                <StatBox label="6s"    value={b.sixes}        small />
                {b.hand && <StatBox label="Hand" value={b.hand} small />}
              </div>
            )}
          </div>
        )}

        {/* Bowling detail */}
        {hasBowling && (
          <div style={{ marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.6rem' }}>
            <button onClick={() => setBowlingOpen((o) => !o)} style={expandBtnStyle('#7c3aed')}>
              <span style={{ ...arrowStyle, transform: bowlingOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
              ⚡ Bowling (Rank #{bwl.rank})
            </button>
            {bowlingOpen && (
              <div style={{ marginTop: '0.6rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(68px,1fr))', gap: '0.4rem' }}>
                <StatBox label="Overs"  value={bwl.overs}         small />
                <StatBox label="Runs"   value={bwl.runs}          small />
                <StatBox label="Best"   value={bwl.highest}       small />
                <StatBox label="Mdns"   value={bwl.maidens}       small />
                <StatBox label="Avg"    value={d(bwl.avg, 2)}     small />
                <StatBox label="Econ"   value={d(bwl.econ, 2)}    small />
                {bwl.style && <StatBox label="Style" value={bwl.style?.replace('Right-arm ', 'RA ').replace('Left-arm ', 'LA ')} small />}
              </div>
            )}
          </div>
        )}

        {!hasBatting && !hasBowling && (
          <div style={{ fontSize: '12px', color: '#9ca3af', padding: '0.5rem 0' }}>No stats available</div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '0.5rem 1.25rem',
        background: 'linear-gradient(135deg, #3b0764 0%, #7c3aed 100%)',
        fontSize: '11px', color: '#c4b5fd',
      }}>
        BPL · Static Data
      </div>
    </div>
  );
}

// ── SCA Corporate player card (static, no API fetch) ─────────────────────────

function SCACorpPlayerCard({ player, isLast }) {
  const { name, team, seasons = [] } = player;
  const [expanded, setExpanded] = useState(false);

  const sortedSeasons = [...seasons].sort((a, b) => b.year - a.year);

  return (
    <div style={{
      marginBottom: isLast ? 0 : '1.5rem',
      backgroundColor: '#ffffff',
      border: '1px solid #d0dae8',
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(6, 28, 84, 0.06)',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.25rem',
        background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)',
        borderBottom: '1px solid #1e3a5f',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '16px', fontWeight: '700', color: '#ffffff' }}>
            {name}
          </h4>
          <div style={{ fontSize: '12px', color: '#93c5fd', fontWeight: '500' }}>
            {team} · SCA Corporate League
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff',
            padding: '0.2rem 0.6rem', borderRadius: '4px',
            fontSize: '10px', fontWeight: '600',
          }}>
            STATIC
          </span>
          <span style={{
            backgroundColor: 'rgba(255,255,255,0.15)', color: '#93c5fd',
            padding: '0.2rem 0.6rem', borderRadius: '4px',
            fontSize: '10px', fontWeight: '600',
          }}>
            {sortedSeasons.map(s => s.year).join(' · ')}
          </span>
        </div>
      </div>

      {/* Season entries */}
      <div style={{ padding: '1rem 1.25rem' }}>
        {sortedSeasons.map((season, si) => (
          <SCACorpSeasonEntry
            key={season.year}
            season={season}
            isLast={si === sortedSeasons.length - 1}
          />
        ))}

        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            marginTop: '0.75rem', width: '100%',
            padding: '0.5rem', backgroundColor: expanded ? '#e8f1ff' : '#f5f8fc',
            border: '1px solid #d0dae8', borderRadius: '6px',
            cursor: 'pointer', fontSize: '12px', color: '#0066cc', fontWeight: '600',
          }}
        >
          {expanded ? '▲ Hide detailed stats' : '▼ Show detailed stats'}
        </button>

        {expanded && (
          <div style={{ marginTop: '1rem' }}>
            {sortedSeasons.map((season) => (
              <SCACorpSeasonDetail key={season.year} season={season} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SCACorpSeasonEntry({ season, isLast }) {
  const { year, competition, batting, bowling } = season;
  return (
    <div style={{
      marginBottom: isLast ? 0 : '1rem',
      paddingBottom: isLast ? 0 : '1rem',
      borderBottom: isLast ? 'none' : '1px solid #e2e8f0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{
          backgroundColor: '#1e3a5f', color: '#ffffff',
          padding: '0.15rem 0.6rem', borderRadius: '4px',
          fontSize: '11px', fontWeight: '700',
        }}>{year}</span>
        <span style={{ fontSize: '12px', color: '#64748b' }}>{competition}</span>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {batting && (
          <div style={{ fontSize: '12px', color: '#374151' }}>
            🏏 <strong>{batting.runs}</strong> runs
            {batting.avg != null && <span style={{ color: '#64748b' }}> · avg {fmt(batting.avg)}</span>}
            {batting.hs > 0 && <span style={{ color: '#64748b' }}> · HS {batting.hs}</span>}
            {batting.mat > 0 && <span style={{ color: '#64748b' }}> · {batting.mat}M</span>}
          </div>
        )}
        {bowling && bowling.wkts > 0 && (
          <div style={{ fontSize: '12px', color: '#374151' }}>
            ⚽ <strong>{bowling.wkts}</strong> wkts
            {bowling.bbf && <span style={{ color: '#64748b' }}> · BB {bowling.bbf}</span>}
            {bowling.econ != null && <span style={{ color: '#64748b' }}> · econ {fmt(bowling.econ)}</span>}
          </div>
        )}
        {!batting && !bowling && (
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>No stats available</span>
        )}
      </div>
    </div>
  );
}

function SCACorpSeasonDetail({ season }) {
  const { year, batting, bowling } = season;
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e3a5f', marginBottom: '0.5rem' }}>
        {year} — Detailed
      </div>

      {batting && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '0.35rem' }}>BATTING</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.4rem' }}>
            {[
              ['Mat', batting.mat], ['Inns', batting.inns], ['NO', batting.not_outs],
              ['Runs', batting.runs], ['Balls', batting.balls], ['Avg', fmt(batting.avg)],
              ['SR', fmt(batting.sr)], ['HS', batting.hs],
              ['100s', batting.hundreds], ['50s', batting.fifties], ['25s', batting.twenty_fives],
              ['Ducks', batting.ducks], ['6s', batting.sixes], ['4s', batting.fours],
            ].map(([label, val]) => val != null && (
              <div key={label} style={{
                backgroundColor: '#f5f8fc', borderRadius: '4px',
                padding: '0.3rem 0.5rem', textAlign: 'center',
              }}>
                <div style={{ fontSize: '10px', color: '#64748b' }}>{label}</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{val ?? '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {bowling && bowling.inns > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '0.35rem' }}>BOWLING</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.4rem' }}>
            {[
              ['Mat', bowling.mat], ['Inns', bowling.inns], ['Overs', bowling.overs],
              ['Runs', bowling.runs], ['Wkts', bowling.wkts], ['BB', bowling.bbf],
              ['Econ', fmt(bowling.econ)], ['Ave', fmt(bowling.ave)], ['SR', fmt(bowling.sr)],
              ['Mdns', bowling.mdns],
            ].map(([label, val]) => val != null && (
              <div key={label} style={{
                backgroundColor: '#f5f8fc', borderRadius: '4px',
                padding: '0.3rem 0.5rem', textAlign: 'center',
              }}>
                <div style={{ fontSize: '10px', color: '#64748b' }}>{label}</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{val ?? '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Player Insights Section ───────────────────────────────────────────────────

function ScoreCard({ label, score, color, show }) {
  if (!show) return null;
  return (
    <div style={{ padding: '0.6rem', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>{label}</span>
        <span style={{ fontSize: '20px', fontWeight: '800', color }}>{score}</span>
      </div>
      <div style={{ backgroundColor: '#f1f5f9', borderRadius: '4px', height: '5px', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, backgroundColor: color, height: '100%', borderRadius: '4px' }} />
      </div>
    </div>
  );
}

function InsightChip({ icon, label, value, color }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.3rem 0.7rem', borderRadius: '20px',
      backgroundColor: color + '18', border: `1px solid ${color}35`,
    }}>
      <span style={{ fontSize: '12px' }}>{icon}</span>
      <span style={{ fontSize: '10px', color: '#64748b' }}>{label}:</span>
      <span style={{ fontSize: '12px', fontWeight: '700', color }}>{value}</span>
    </div>
  );
}

function InsightBlock({ title, accentColor, children }) {
  return (
    <div style={{ borderLeft: `3px solid ${accentColor}`, paddingLeft: '0.8rem', marginBottom: '1rem' }}>
      <div style={{ fontSize: '10px', fontWeight: '700', color: accentColor, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
      {children}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ textAlign: 'center', padding: '0.35rem 0.5rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e9eef5' }}>
      <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginTop: '1px' }}>{value ?? '—'}</div>
    </div>
  );
}

function InsightsPanel({ insights }) {
  const { battingProfile, bowlingProfile, suggestedRole, strengths, improvements,
          battingScore, bowlingScore, overallScore, confidence, leaguesContributed, limitedSample } = insights;
  const fmt1 = v => v != null && !isNaN(v) ? Number(v).toFixed(1) : '—';
  const fmt2 = v => v != null && !isNaN(v) ? Number(v).toFixed(2) : '—';

  return (
    <div style={{
      marginTop: '0.75rem', backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem',
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.1rem', alignItems: 'center' }}>
        <InsightChip icon="🎯" label="Suggested Role" value={suggestedRole} color="#0066cc" />
        <InsightChip icon="📊" label="Confidence" value={confidence.label} color={confidence.color} />
        {leaguesContributed.length > 0 && (
          <InsightChip icon="🏏" label="Leagues" value={leaguesContributed.join(', ')} color="#b45309" />
        )}
      </div>

      {limitedSample && (
        <div style={{
          fontSize: '11px', color: '#92400e', backgroundColor: '#fef9ec',
          padding: '0.45rem 0.75rem', borderRadius: '6px', marginBottom: '1rem',
        }}>
          ⚠ Limited sample — insights based on a small dataset. Interpret with caution.
        </div>
      )}

      <InsightBlock title="Impact Scores" accentColor="#0066cc">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.6rem' }}>
          <ScoreCard label="Batting Score" score={battingScore} color="#16a34a" show={battingScore > 0} />
          <ScoreCard label="Bowling Score" score={bowlingScore} color="#7c3aed" show={bowlingScore > 0} />
          <ScoreCard label="Overall Score" score={overallScore} color="#0066cc" show={overallScore > 0} />
        </div>
      </InsightBlock>

      {battingProfile && (
        <InsightBlock title="Batting Profile" accentColor="#16a34a">
          <div style={{ marginBottom: '0.6rem' }}>
            <span style={{
              backgroundColor: '#dcfce7', color: '#15803d',
              padding: '0.2rem 0.6rem', borderRadius: '12px',
              fontSize: '12px', fontWeight: '700',
            }}>{battingProfile.style}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))', gap: '0.4rem' }}>
            <MiniStat label="Avg" value={fmt1(battingProfile.average)} />
            <MiniStat label="SR" value={fmt1(battingProfile.strikeRate)} />
            <MiniStat label="50s" value={battingProfile.fifties} />
            <MiniStat label="100s" value={battingProfile.hundreds} />
            {battingProfile.highestScore && <MiniStat label="HS" value={battingProfile.highestScore} />}
          </div>
        </InsightBlock>
      )}

      {bowlingProfile && (
        <InsightBlock title="Bowling Profile" accentColor="#7c3aed">
          <div style={{ marginBottom: '0.6rem' }}>
            <span style={{
              backgroundColor: '#ede9fe', color: '#6d28d9',
              padding: '0.2rem 0.6rem', borderRadius: '12px',
              fontSize: '12px', fontWeight: '700',
            }}>{bowlingProfile.style}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))', gap: '0.4rem' }}>
            <MiniStat label="Wkts" value={bowlingProfile.wickets} />
            <MiniStat label="Econ" value={fmt2(bowlingProfile.economy)} />
            <MiniStat label="Avg" value={fmt1(bowlingProfile.average)} />
            <MiniStat label="SR" value={fmt1(bowlingProfile.strikeRate)} />
            {bowlingProfile.bestBowling && <MiniStat label="Best" value={bowlingProfile.bestBowling} />}
          </div>
        </InsightBlock>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <InsightBlock title="Strengths" accentColor="#16a34a">
          {strengths.map((s, i) => (
            <div key={i} style={{ fontSize: '12px', color: '#374151', marginBottom: '0.3rem', display: 'flex', gap: '0.4rem' }}>
              <span style={{ color: '#16a34a', fontWeight: '700' }}>✓</span>
              <span>{s}</span>
            </div>
          ))}
        </InsightBlock>
        <InsightBlock title="Areas to Improve" accentColor="#f59e0b">
          {improvements.map((imp, i) => (
            <div key={i} style={{ fontSize: '12px', color: '#374151', marginBottom: '0.3rem', display: 'flex', gap: '0.4rem' }}>
              <span style={{ color: '#f59e0b', fontWeight: '700' }}>↑</span>
              <span>{imp}</span>
            </div>
          ))}
        </InsightBlock>
      </div>

      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e9eef5', fontSize: '10px', color: '#94a3b8' }}>
        Calculated from aggregated data across: {leaguesContributed.join(' · ')}
      </div>
    </div>
  );
}

function PlayerInsightsSection({ results, scaStatsMap }) {
  const [open, setOpen] = useState(false);
  const [insights, setInsights] = useState(null);

  const allPlayers = Object.values(results).flatMap(p => p.players || []);
  const normalized = allPlayers.map(p => normalizeForAgg(p, scaStatsMap));
  const agg        = aggregateAll(normalized);

  if (!agg.hasBat && !agg.hasBowl) return null;

  const leaguesContributed = Object.entries(results)
    .filter(([, p]) => !p.noResults && (p.players?.length ?? 0) > 0)
    .map(([k]) => k);

  const dismissals = agg.batting.inns - agg.batting.notOuts;
  const battingForInsights = agg.hasBat ? {
    matches:    agg.batting.mat,
    innings:    agg.batting.inns,
    notOuts:    agg.batting.notOuts,
    runs:       agg.batting.runs,
    balls:      agg.batting.balls,
    average:    dismissals > 0 ? agg.batting.runs / dismissals : 0,
    strikeRate: agg.batting.balls > 0 ? (agg.batting.runs / agg.batting.balls) * 100 : 0,
    fifties: 0, hundreds: 0, sixes: 0, ducks: 0, highestScore: null,
  } : null;

  const oversNum  = parseFloat(agg.bowling.overs) || 0;
  const econNum   = agg.bowling.econ !== '—' ? parseFloat(agg.bowling.econ) : null;
  const bowlSRNum = agg.bowling.sr   !== '—' ? parseFloat(agg.bowling.sr)   : null;
  const bowlingForInsights = agg.hasBowl ? {
    innings:    Math.max(1, agg.bowling.wickets),
    overs:      oversNum,
    runs:       agg.bowling.runs,
    wickets:    agg.bowling.wickets,
    economy:    econNum,
    average:    agg.bowling.wickets > 0 ? agg.bowling.runs / agg.bowling.wickets : null,
    strikeRate: bowlSRNum,
    bestBowling: null,
  } : null;

  function handleClick() {
    if (!open) {
      setInsights(generatePlayerInsights(battingForInsights, bowlingForInsights, leaguesContributed));
    }
    setOpen(v => !v);
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <button
        onClick={handleClick}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.7rem 1.25rem', borderRadius: '8px',
          backgroundColor: open ? '#e8f1ff' : '#fff',
          border: `1px solid ${open ? '#0066cc' : '#d0dae8'}`,
          color: '#0066cc', fontSize: '13px', fontWeight: '600',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '15px' }}>✦</span>
        {open ? 'Hide Player Insights' : 'View Player Insights'}
        <span style={{ marginLeft: '0.5rem', fontSize: '11px', opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && insights && <InsightsPanel insights={insights} />}
    </div>
  );
}
