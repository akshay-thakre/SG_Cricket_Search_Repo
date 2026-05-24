import React, { useState, useEffect } from 'react';
import { fetchPlayerStats } from '../services/apiService';

// ── Main aggregated results component ────────────────────────────────────────

export function AggregatedResults({ searchResults }) {
  const { query, results, totalFound, meta } = searchResults;

  // Auto-expand the first live platform that has results
  const firstLiveWithResults = Object.keys(results).find(
    (k) => !results[k].disabled && !results[k].noResults && results[k].count > 0
  );
  const [expandedPlatform, setExpandedPlatform] = useState(firstLiveWithResults || null);

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
          {meta?.disabled && <span style={{ marginLeft: '0.5rem', fontSize: '12px', color: '#9ca3af' }}>● {meta.disabled.length} coming soon</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {Object.entries(results).map(([platformKey, platformData]) => (
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
          {players.map((player, idx) => (
            <PlayerCard
              key={player.id || idx}
              player={player}
              platformName={platformName}
              isLast={idx === players.length - 1}
            />
          ))}
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
  const [statsLoading, setStatsLoading] = useState(!!id); // true if we have an id to fetch
  const [statsError, setStatsError] = useState(!id ? 'Player ID unavailable — cannot load stats.' : null);

  useEffect(() => {
    if (!id) return;

    setStatsLoading(true);
    setStatsError(null);

    fetchPlayerStats(id)
      .then((data) => {
        setStats(data);
        setStatsLoading(false);
      })
      .catch((err) => {
        setStatsError(err.message || 'Could not load player statistics.');
        setStatsLoading(false);
      });
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(val) {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? val : n.toFixed(2).replace(/\.?0+$/, '');
}
