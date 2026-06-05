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
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '3.5rem 1.5rem',
        textAlign: 'center',
        marginBottom: '2rem',
        borderRadius: '16px',
        boxShadow: '0 10px 28px rgba(0, 102, 204, 0.16)'
      }}
    >
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <div
          className="search-title"
          style={{
            fontSize: '28px',
            fontWeight: 'bold',
            marginBottom: '0.75rem',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
            lineHeight: '1.3',
          }}
        >
          <span style={{ fontSize: '40px', flexShrink: 0 }}>🏏</span>
          <span>Changi Risers Cricket Search SG</span>
        </div>

        <div style={{
          fontSize: '15px',
          color: '#cbd5e1',
          marginBottom: '2.5rem',
          lineHeight: '1.6'
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
            style={{
              flex: 1,
              padding: '1rem 1.25rem',
              borderRadius: '8px',
              border: '2px solid #0066cc',
              fontSize: '15px',
              backgroundColor: '#ffffff',
              color: '#1e293b',
              outline: 'none',
              fontWeight: '500',
              transition: 'all 0.2s',
              minWidth: 0,
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#003d99';
              e.target.style.boxShadow = '0 0 0 4px rgba(0, 102, 204, 0.15)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#0066cc';
              e.target.style.boxShadow = 'none';
            }}
          />
          <button
            type="submit"
            disabled={!query.trim()}
            className="search-btn search-btn-submit"
            style={{
              padding: '1rem 2rem',
              backgroundColor: '#0066cc',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: query.trim() ? 'pointer' : 'not-allowed',
              fontSize: '15px',
              fontWeight: '600',
              opacity: query.trim() ? 1 : 0.6,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (query.trim()) {
                e.target.style.backgroundColor = '#003d99';
                e.target.style.boxShadow = '0 4px 12px rgba(0, 102, 204, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#0066cc';
              e.target.style.boxShadow = 'none';
            }}
          >
            Search
          </button>

          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="search-btn search-btn-clear"
              style={{
                padding: '1rem 1.5rem',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                border: '1.5px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: '600',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
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
            marginTop: '2.5rem'
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
        backgroundColor: 'rgba(0, 102, 204, 0.08)',
        border: '1.5px solid rgba(0, 102, 204, 0.2)',
        borderRadius: '10px',
        textAlign: 'center',
        color: '#ffffff',
        transition: 'all 0.3s',
        cursor: 'default'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(0, 102, 204, 0.15)';
        e.currentTarget.style.borderColor = '#0066cc';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(0, 102, 204, 0.08)';
        e.currentTarget.style.borderColor = 'rgba(0, 102, 204, 0.2)';
      }}
    >
      <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '0.35rem', opacity: 0.95 }}>
        {code}
      </div>
      <div style={{ fontSize: '11px', opacity: 0.8, fontWeight: '500' }}>
        {label}
      </div>
    </div>
  );
}
