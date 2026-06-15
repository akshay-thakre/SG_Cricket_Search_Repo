import React, { useState, useEffect } from 'react';

export function MultiPlatformSearchBar({ onSearch, onClear, initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery);

  // Live search: fire onSearch after 400ms of inactivity; clear when query is too short
  useEffect(() => {
    if (query.trim().length < 2) {
      onClear();
      return;
    }
    const timer = setTimeout(() => {
      onSearch(query);
    }, 400);
    return () => clearTimeout(timer);
    // onSearch / onClear are stable across renders; omitting them avoids resetting
    // the debounce timer on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  const handleClear = () => {
    setQuery('');
    onClear();
  };

  return (
    <div
      className="search-hero"
      style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 55%, #1E3A5F 100%)',
        padding: '3.5rem 1.5rem',
        textAlign: 'center',
        marginBottom: '2rem',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-hero)',
      }}
    >
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <div
          className="search-title"
          style={{
            fontSize: '28px',
            fontWeight: 'bold',
            marginBottom: '0.75rem',
            color: 'var(--text-on-dark)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
            lineHeight: '1.3',
          }}
        >
          <span style={{ fontSize: '40px', flexShrink: 0 }}>🏏</span>
          <span>Changi Risers Cricket | Club &amp; Stats</span>
        </div>

        <div style={{
          fontSize: '15px',
          color: 'var(--text-on-dark-muted)',
          marginBottom: '2.5rem',
          lineHeight: '1.6',
        }}>
          Search cricket player stats across Singapore platforms — aggregated in one place
        </div>

        <form
          onSubmit={handleSearch}
          className="search-form"
          style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}
        >
          <input
            type="text"
            placeholder="Enter player name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
          />
          <button
            type="submit"
            disabled={!query.trim()}
            aria-label="Search players"
            className="btn btn-primary search-btn search-btn-submit"
          >
            Search
          </button>

          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="btn btn-ghost-light search-btn search-btn-clear"
            >
              Clear
            </button>
          )}
        </form>

        <div
          className="platform-badge-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '1rem',
            marginTop: '2.5rem',
          }}
        >
          <PlatformBadge code="SCA" label="SCA" />
          <PlatformBadge code="YPL" label="YPL" />
          <PlatformBadge code="SIA" label="SG IA" />
          <PlatformBadge code="BPL" label="BPL 2025" />
        </div>
      </div>
    </div>
  );
}

function PlatformBadge({ code, label }) {
  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: 'rgba(255,255,255,0.07)',
        border: '1.5px solid rgba(255,255,255,0.15)',
        borderRadius: 'var(--radius-md)',
        textAlign: 'center',
        color: 'var(--text-on-dark)',
        transition: 'background-color 0.2s, border-color 0.2s',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.13)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.30)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
      }}
    >
      <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '0.35rem', opacity: 0.95 }}>
        {code}
      </div>
      <div style={{ fontSize: '11px', opacity: 0.75, fontWeight: '500' }}>
        {label}
      </div>
    </div>
  );
}
