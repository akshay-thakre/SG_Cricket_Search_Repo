import React, { useState } from 'react';

export function AggregatedResults({ searchResults, onPlayerSelect }) {
  const { query, results, totalFound, meta } = searchResults;
  const [expandedPlatform, setExpandedPlatform] = useState(null);

  if (!results || Object.keys(results).length === 0) {
    return null;
  }

  if (totalFound === 0) {
    // Check if there was an error on any platform
    const errors = Object.values(results).filter(p => p.error);
    return (
      <div style={{
        padding: '3rem 1.5rem',
        textAlign: 'center',
        color: '#64748b',
        backgroundColor: '#eef2f9',
        borderRadius: '12px',
        border: '1px solid #d0dae8',
        marginTop: '2rem'
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
            onToggle={() => setExpandedPlatform(
              expandedPlatform === platformKey ? null : platformKey
            )}
            onPlayerSelect={onPlayerSelect}
          />
        ))}
      </div>
    </div>
  );
}

function PlatformSection({ platformData, isExpanded, onToggle, onPlayerSelect }) {
  const { platformName, count, players, noResults, icon, disabled, disabledReason, error } = platformData;
  const isLive = !disabled;

  return (
    <div style={{
      backgroundColor: '#f5f8fc',
      border: `1px solid ${error ? '#fecaca' : '#d0dae8'}`,
      borderRadius: '12px',
      overflow: 'hidden',
      transition: 'all 0.3s',
      boxShadow: '0 2px 6px rgba(6, 28, 84, 0.08)',
      opacity: disabled ? 0.6 : 1,
    }}>
      <button
        onClick={disabled ? undefined : onToggle}
        style={{
          width: '100%',
          padding: '1.5rem',
          backgroundColor: error ? '#fef2f2' : '#f5f8fc',
          border: 'none',
          borderBottom: isExpanded ? '1px solid #d0dae8' : 'none',
          cursor: disabled ? 'default' : 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'all 0.2s'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: isLive ? '#e8f1ff' : '#f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isLive ? '#0066cc' : '#9ca3af',
            fontWeight: 'bold',
            fontSize: '16px'
          }}>
            {icon.code}
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: '600', fontSize: '15px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {platformName}
              {isLive && <span style={{ fontSize: '8px', color: '#16a34a' }}>●</span>}
              {isLive && <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: '500' }}>LIVE</span>}
              {disabled && <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: '500', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>{disabledReason}</span>}
            </div>
            {error && <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px' }}>Error: {error}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {noResults && !error && !disabled ? (
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
              No results
            </span>
          ) : !disabled && !error && count > 0 ? (
            <span style={{
              backgroundColor: '#e8f1ff',
              color: '#0066cc',
              padding: '0.375rem 0.875rem',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              {count} found
            </span>
          ) : null}
          {!disabled && (
            <span style={{
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
              fontSize: '16px',
              color: '#0066cc',
              fontWeight: 'bold'
            }}>
              ▼
            </span>
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
              onSelect={onPlayerSelect}
              isLast={idx === players.length - 1}
            />
          ))}
        </div>
      )}

      {isExpanded && noResults && !disabled && !error && (
        <div style={{
          padding: '2.5rem',
          textAlign: 'center',
          color: '#64748b',
          fontSize: '14px',
          backgroundColor: '#eef2f9'
        }}>
          No players found matching your search on {platformName}.
        </div>
      )}
    </div>
  );
}

function PlayerCard({ player, platformName, onSelect, isLast }) {
  const { name, team, role, profileUrl, verified, overallStats } = player;

  return (
    <div style={{
      marginBottom: isLast ? 0 : '1rem',
      padding: '1rem',
      backgroundColor: '#eef2f9',
      border: '1px solid #d0dae8',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'start',
        marginBottom: '0.75rem'
      }}>
        <div>
          <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '15px', fontWeight: '600', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {name}
            {verified !== undefined && (
              <span title={verified ? 'Verified Player' : 'Not Verified'} style={{ fontSize: '14px' }}>
                {verified ? '✅' : '❓'}
              </span>
            )}
          </h4>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
            {team}
          </div>
        </div>
        {role && (
          <span style={{
            backgroundColor: '#e8f1ff',
            color: '#0066cc',
            padding: '0.25rem 0.75rem',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '600',
            whiteSpace: 'nowrap'
          }}>
            {role}
          </span>
        )}
      </div>

      {overallStats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.75rem',
          marginBottom: '1rem'
        }}>
          <StatBox label="Matches" value={overallStats.matches} />
          <StatBox label="Runs" value={overallStats.runs} />
          <StatBox label="Average" value={overallStats.average} />
          <StatBox label="Wickets" value={overallStats.wickets} />
        </div>
      )}

      {!overallStats && (
        <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '0.75rem', fontStyle: 'italic' }}>
          Detailed stats available on player profile page
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        {profileUrl && (
          <a href={profileUrl} target="_blank" rel="noopener noreferrer" style={{
            fontSize: '12px',
            color: '#0066cc',
            textDecoration: 'none',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}>
            View on CricClubs →
          </a>
        )}
        <button
          onClick={() => onSelect && onSelect(player, platformName)}
          style={{
            fontSize: '12px',
            color: '#64748b',
            background: 'none',
            border: '1px solid #d0dae8',
            padding: '0.25rem 0.75rem',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Select Player
        </button>
      </div>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div style={{
      backgroundColor: '#f5f8fc',
      padding: '0.75rem',
      borderRadius: '6px',
      textAlign: 'center',
      border: '1px solid #d0dae8'
    }}>
      <div style={{ fontSize: '15px', fontWeight: '700', color: '#0066cc' }}>{value}</div>
      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '500', marginTop: '0.25rem' }}>
        {label}
      </div>
    </div>
  );
}