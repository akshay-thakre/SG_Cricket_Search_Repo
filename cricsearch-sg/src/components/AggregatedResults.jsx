import React, { useState, useEffect } from 'react';
import { fetchAnyPlayerStats } from '../services/apiService';
import { calculatePerformanceAcrossAllLeagues } from '../utils/aggregatePlayerStats';

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

// ── Main aggregated results component ────────────────────────────────────────

export function AggregatedResults({ searchResults }) {
  const { query, results, totalFound, meta } = searchResults;

  const [expandedPlatform, setExpandedPlatform] = useState(null);

  // Track SCA live stats together with the query they belong to so we never
  // show stale stats from a previous search during the brief gap before the
  // new query's useEffect fires.
  const [scaLiveState, setScaLiveState] = useState({ fetchedQuery: null, loading: false, stats: [] });

  useEffect(() => {
    let cancelled = false;
    const scaPlatform = results?.['SCA'];
    const livePlayers = scaPlatform?.players?.filter((p) => p.source === 'sca') || [];

    if (livePlayers.length === 0) {
      setScaLiveState({ fetchedQuery: query, loading: false, stats: [] });
      return () => { cancelled = true; };
    }

    // Mark in-flight — fetchedQuery intentionally left as previous value so
    // the stale-check below triggers the loading indicator immediately.
    setScaLiveState((prev) => ({ ...prev, loading: true }));

    Promise.allSettled(
      livePlayers.map((p) => fetchAnyPlayerStats(p).then((data) => normalizeStats(data)))
    ).then((outcomes) => {
      if (cancelled) return;
      const resolved = outcomes
        .filter((o) => o.status === 'fulfilled' && o.value)
        .map((o) => o.value);
      setScaLiveState({ fetchedQuery: query, loading: false, stats: resolved });
    });

    return () => { cancelled = true; };
  // results is stable for a given query; omitting it avoids re-fetching on every parent re-render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Derive loading state and stats for the current query.
  // If fetchedQuery !== query the previous search's data is stale — treat as loading.
  const hasScaLivePlayers = !!(
    results?.['SCA'] &&
    !results['SCA'].noResults &&
    results['SCA'].players?.some((p) => p.source === 'sca')
  );
  const scaIsStale        = scaLiveState.fetchedQuery !== query;
  const scaLiveLoading    = hasScaLivePlayers && (scaIsStale || scaLiveState.loading);
  const scaLiveStatsArray = scaIsStale ? [] : scaLiveState.stats;

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

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {Object.entries(results)
          .filter(([, p]) => !p.noResults || p.error)
          .sort(([a], [b]) => {
            const order = ['YPL', 'BPL', 'SG IA', 'SCA'];
            const ai = order.indexOf(a);
            const bi = order.indexOf(b);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          })
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
        <PerformanceAcrossAllLeagues
          results={results}
          scaLiveStatsArray={scaLiveStatsArray}
          scaLiveLoading={scaLiveLoading}
        />
      </div>
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
      .then((data) => {
        setStats(normalizeStats(data));
        setStatsLoading(false);
      })
      .catch((err) => {
        setStatsError(err.message || 'Could not load player statistics.');
        setStatsLoading(false);
      });
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
  const { name, team, entries } = player;

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
        Singapore Indian Association · Season 2025 · Updated daily at 6:00 AM SGT
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
          }}>Updated daily at 6:00 AM SGT</span>
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

// ── BPL 2025 player card (static, no API fetch) ───────────────────────────────

function BPLPlayerCard({ player, isLast }) {
  const { name, team, batting, bowling } = player;
  const [expanded, setExpanded] = useState(false);

  const hasBatting = batting && batting.innings > 0;
  const hasBowling = bowling && bowling.innings > 0;

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
          <div style={{ fontSize: '12px', color: '#e9d5ff', fontWeight: '500' }}>
            {team}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
          <span style={{
            backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff',
            padding: '0.2rem 0.6rem', borderRadius: '4px',
            fontSize: '10px', fontWeight: '700',
          }}>BPL 2025</span>
          <span style={{ fontSize: '9px', color: '#c4b5fd' }}>Updated daily at 6:00 AM SGT</span>
        </div>
      </div>

      {/* Summary */}
      <div style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {hasBatting && (
            <div style={{ fontSize: '12px', color: '#374151' }}>
              🏏 <strong>{batting.runs}</strong> runs
              {batting.average != null && <span style={{ color: '#64748b' }}> · avg {fmt(batting.average)}</span>}
              {batting.highest_score > 0 && <span style={{ color: '#64748b' }}> · HS {batting.highest_score}</span>}
              <span style={{ color: '#64748b' }}> · {batting.matches}M</span>
              {batting.batting_hand && <span style={{ color: '#9ca3af' }}> · {batting.batting_hand}</span>}
            </div>
          )}
          {hasBowling && (
            <div style={{ fontSize: '12px', color: '#374151' }}>
              ⚽ <strong>{bowling.wickets}</strong> wkts
              {bowling.economy != null && <span style={{ color: '#64748b' }}> · econ {fmt(bowling.economy)}</span>}
              {bowling.bowling_style && <span style={{ color: '#9ca3af' }}> · {bowling.bowling_style}</span>}
            </div>
          )}
          {!hasBatting && !hasBowling && (
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>No innings data yet</span>
          )}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            width: '100%', padding: '0.5rem',
            backgroundColor: expanded ? '#f3e8ff' : '#f5f8fc',
            border: '1px solid #d0dae8', borderRadius: '6px',
            cursor: 'pointer', fontSize: '12px', color: '#7c3aed', fontWeight: '600',
          }}
        >
          {expanded ? '▲ Hide stats' : '▼ Show full stats'}
        </button>

        {expanded && (
          <div style={{ marginTop: '1rem' }}>
            {hasBatting && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '0.35rem' }}>BATTING</div>
                <div className="stats-cell-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.4rem' }}>
                  {[
                    ['Mat', batting.matches], ['Inns', batting.innings], ['NO', batting.not_outs],
                    ['Runs', batting.runs], ['Balls', batting.balls_faced], ['Avg', fmt(batting.average)],
                    ['SR', fmt(batting.strike_rate)], ['HS', batting.highest_score],
                    ['50s', batting.fifties], ['100s', batting.hundreds],
                    ['4s', batting.fours], ['6s', batting.sixes],
                  ].map(([label, val]) => val != null && (
                    <div key={label} style={{
                      backgroundColor: '#f5f8fc', borderRadius: '4px',
                      padding: '0.3rem 0.4rem', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{label}</div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{val ?? '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasBowling && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '0.35rem' }}>BOWLING</div>
                <div className="stats-cell-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.4rem' }}>
                  {[
                    ['Mat', bowling.matches], ['Inns', bowling.innings], ['Overs', bowling.overs],
                    ['Runs', bowling.runs_conceded], ['Wkts', bowling.wickets],
                    ['BB', bowling.best_wickets], ['Econ', fmt(bowling.economy)],
                    ['Ave', fmt(bowling.average)], ['SR', fmt(bowling.strike_rate)],
                    ['Mdns', bowling.maidens], ['Dots', bowling.dot_balls],
                  ].map(([label, val]) => val != null && (
                    <div key={label} style={{
                      backgroundColor: '#f5f8fc', borderRadius: '4px',
                      padding: '0.3rem 0.4rem', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{label}</div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{val ?? '—'}</div>
                    </div>
                  ))}
                </div>
                {bowling.bowling_style && (
                  <div style={{ marginTop: '0.5rem', fontSize: '11px', color: '#64748b' }}>
                    Style: {bowling.bowling_style}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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

// ── Performance across all leagues panel ──────────────────────────────────────

function PerformanceAcrossAllLeagues({ results, scaLiveStatsArray, scaLiveLoading }) {
  const hasScaLivePlayers = !!(
    results?.['SCA'] &&
    !results['SCA'].noResults &&
    results['SCA'].players?.some((p) => p.source === 'sca')
  );
  const awaitingSca = hasScaLivePlayers && scaLiveLoading;

  const agg = awaitingSca ? null : calculatePerformanceAcrossAllLeagues(results, scaLiveStatsArray);

  const totalRuns       = agg?.totalRuns    ?? 0;
  const totalMatches    = agg?.totalMatches ?? 0;
  const totalInnings    = agg?.totalInnings ?? 0;
  const totalWickets    = agg?.totalWickets ?? 0;
  const ambiguousLeagues = agg?.ambiguousLeagues ?? [];

  const hasAnyData = totalRuns > 0 || totalMatches > 0 || totalInnings > 0 || totalWickets > 0;

  return (
    <div style={{
      backgroundColor: '#f5f8fc',
      border: '2px solid #c7d5e8',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(6, 28, 84, 0.10)',
    }}>
      {/* Header */}
      <div style={{
        padding: '1.25rem 1.5rem',
        backgroundColor: '#e8f0fb',
        borderBottom: '1px solid #c7d5e8',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '50%',
          backgroundColor: '#dbeafe',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', flexShrink: 0,
        }}>📊</div>
        <div>
          <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b' }}>
            Performance across all leagues
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            YPL · BPL · SG IA · SCA
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '1.25rem 1.5rem' }}>
        {awaitingSca ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1rem', backgroundColor: '#fefce8',
            border: '1px solid #fef08a', borderRadius: '8px',
            color: '#92400e', fontSize: '13px', fontWeight: '500',
          }}>
            <span style={{ fontSize: '16px', display: 'inline-block', animation: 'statspin 1s linear infinite' }}>⟳</span>
            Calculating — awaiting stats from SCA to calculate.
          </div>
        ) : !hasAnyData ? (
          <div style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', padding: '0.5rem 0' }}>
            No aggregated stats available for this search.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '0.75rem',
          }}>
            <AggStatBox label="Total Runs"    value={totalRuns}    color="#0066cc" />
            <AggStatBox label="Total Matches" value={totalMatches} color="#16a34a" />
            <AggStatBox label="Total Innings" value={totalInnings} color="#1e293b" />
            <AggStatBox label="Total Wickets" value={totalWickets} color="#7c3aed" />
          </div>
        )}

        {!awaitingSca && agg?.leaguesContributed?.length > 0 && (
          <div style={{ marginTop: '0.75rem', fontSize: '11px', color: '#94a3b8' }}>
            Leagues contributing: {agg.leaguesContributed.join(' · ')}
          </div>
        )}

        {!awaitingSca && ambiguousLeagues.length > 0 && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.6rem 0.875rem',
            backgroundColor: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#92400e',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.4rem',
          }}>
            <span style={{ flexShrink: 0 }}>⚠️</span>
            <span>
              <strong>{ambiguousLeagues.join(', ')}</strong> not included — multiple players match.
              Refine your search for accurate aggregation.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function AggStatBox({ label, value, color }) {
  return (
    <div style={{
      backgroundColor: '#ffffff',
      border: '1px solid #d0dae8',
      borderRadius: '8px',
      padding: '0.875rem 0.5rem',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '22px', fontWeight: '800', color }}>
        {value}
      </div>
      <div style={{
        fontSize: '9px', color: '#64748b', fontWeight: '600',
        marginTop: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {label}
      </div>
    </div>
  );
}
