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

  // Keep form submit as a fallback (Enter key / Search button click)
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
    <div style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '3.5rem 1.5rem',
      textAlign: 'center',
      marginBottom: '2rem',
      borderRadius: '16px',
      boxShadow: '0 10px 28px rgba(0, 102, 204, 0.16)'
    }}>
      <div style={{
        maxWidth: '700px',
        margin: '0 auto'
      }}>
        <div style={{
          fontSize: '36px',
          fontWeight: 'bold',
          marginBottom: '0.75rem',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem'
        }}>
          <span style={{ fontSize: '44px' }}>🏏</span>
          <span>CricSearch SG</span>
        </div>

        <div style={{
          fontSize: '15px',
          color: '#cbd5e1',
          marginBottom: '2.5rem',
          lineHeight: '1.6'
        }}>
          Search cricket player stats across Singapore platforms — aggregated in one place
        </div>

        <form onSubmit={handleSearch} style={{
          display: 'flex',
          gap: '0.75rem',
          marginBottom: '2rem'
        }}>
          <input
            type="text"
            placeholder="Enter player name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
              transition: 'all 0.2s'
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
              transition: 'all 0.2s'
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
              style={{
                padding: '1rem 1.5rem',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                border: '1.5px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: '600',
                transition: 'all 0.2s'
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

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '1.25rem',
          marginTop: '2.5rem'
        }}>
          <PlatformBadge code="CC" label="CricClubs" />
          <PlatformBadge code="LMS" label="Last Man Stands" />
          <PlatformBadge code="ST" label="Stumps" />
          <PlatformBadge code="CH" label="CricHeroes" />
        </div>
      </div>
    </div>
  );
}

function PlatformBadge({ code, label }) {
  return (
    <div style={{
      padding: '1.25rem',
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
      <div style={{
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '0.5rem',
        opacity: 0.95
      }}>
        {code}
      </div>
      <div style={{
        fontSize: '12px',
        opacity: 0.8,
        fontWeight: '500'
      }}>
        {label}
      </div>
    </div>
  );
}