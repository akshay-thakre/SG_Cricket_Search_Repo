import React, { useState, useEffect, useRef } from 'react';
import { searchAcrossPlatforms, checkHealth } from './services/apiService';
import { AggregatedResults } from './components/AggregatedResults';
import { MultiPlatformSearchBar } from './components/MultiPlatformSearchBar';
import { RisersLegacy } from './components/RisersLegacy';

export default function CricSearchApp() {
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [searchQuery, setSearchQuery]   = useState('');
  const [activePage, setActivePage]     = useState('legacy');
  const abortControllerRef = useRef(null);

  useEffect(() => {
    checkHealth()
      .then(() => setBackendStatus('online'))
      .catch(() => setBackendStatus('offline'));
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) setLoading(true);
  }, [searchQuery]);

  const handleSearch = async (query) => {
    if (!query.trim()) return;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setSearchQuery(query);
    setLoading(true);
    setError(null);
    setSearchResults(null);

    try {
      const results = await searchAcrossPlatforms(query, controller.signal);
      setSearchResults(results);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Search failed. Please check if the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setSearchResults(null);
    setError(null);
  };

  const statusBadgeClass = backendStatus === 'online'
    ? 'badge badge-success'
    : backendStatus === 'offline'
    ? 'badge badge-danger'
    : 'badge badge-warning';

  const statusLabel = backendStatus === 'online'
    ? 'API Online'
    : backendStatus === 'offline'
    ? 'API Offline'
    : 'Checking...';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--app-bg)' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'var(--surface-dark)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '1rem 1.5rem',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="app-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text-on-dark)', lineHeight: '1.3', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--primary)', fontSize: '22px' }}>🏏</span>
                <span>Changi Risers Cricket | Club &amp; Stats</span>
              </h1>
              <div style={{ fontSize: '12px', color: 'var(--text-on-dark-muted)', marginTop: '0.2rem', paddingLeft: '30px' }}>
                Singapore Cricket Player Search — Live Data
              </div>
            </div>
            <div className="app-header-badges" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span className={statusBadgeClass}>
                <span style={{ fontSize: '8px' }}>●</span>
                {statusLabel}
              </span>
              <span className="badge badge-info">
                🇸🇬 Only
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ backgroundColor: '#f4f7fb', borderBottom: '2px solid #e2e8f0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', paddingLeft: '1.5rem', display: 'flex' }}>
          {[
            { id: 'legacy', label: '🏆 Everything about Changi Risers' },
            { id: 'search', label: '🔍 Player Search' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActivePage(tab.id)}
              style={{
                padding: '0.8rem 1.25rem',
                border: 'none',
                borderBottom: `2px solid ${activePage === tab.id ? '#0066cc' : 'transparent'}`,
                marginBottom: '-2px',
                backgroundColor: 'transparent',
                color: activePage === tab.id ? '#0066cc' : '#64748b',
                fontWeight: activePage === tab.id ? '700' : '500',
                fontSize: '13px', cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activePage === 'legacy' && <RisersLegacy />}

      {/* Main Content */}
      {activePage === 'search' && (
      <div className="app-main-content" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1.5rem 2rem' }}>

        {/* Backend Offline Warning */}
        {backendStatus === 'offline' && (
          <div style={{
            padding: '1.25rem', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
          }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: '600', color: 'var(--danger)', fontSize: '14px' }}>Backend API is offline</div>
              <div style={{ color: '#7f1d1d', fontSize: '13px', marginTop: '2px' }}>
                Start the backend: <code style={{ backgroundColor: 'var(--data-red-light)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>cd cricsearch-backend && npm start</code>
              </div>
            </div>
          </div>
        )}

        <MultiPlatformSearchBar onSearch={handleSearch} onClear={handleClear} initialQuery={searchQuery} />

        {/* Stats Can Mislead, Commitment Cannot */}
        <div style={{ maxWidth: '700px', margin: '1.75rem auto 0', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '1rem' }}>📊</div>
          <div style={{ fontSize: 'clamp(18px, 3vw, 24px)', fontWeight: '800', color: '#1e293b', marginBottom: '1.25rem', letterSpacing: '-0.01em' }}>
            Stats Can Mislead, Commitment Cannot
          </div>
          <div style={{ backgroundColor: '#f8fafd', borderRadius: '14px', padding: '1.75rem 2rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(6,28,84,0.06)', textAlign: 'left' }}>
            <p style={{ fontSize: '15px', color: '#374151', lineHeight: '1.9', marginBottom: '1rem' }}>
              The numbers on this site are not meant to reduce a player to statistics. They exist to <strong>preserve effort, contribution, and memories</strong>.
            </p>
            <p style={{ fontSize: '15px', color: '#374151', lineHeight: '1.9', marginBottom: '1rem' }}>
              Every run, wicket, catch, match, and season is part of the Changi Risers story.
            </p>
            <p style={{ fontSize: '15px', color: '#374151', lineHeight: '1.9' }}>
              Behind every number is a player who showed up, gave their best, and added a page to the Changi Risers chapter.
            </p>
            <div style={{ marginTop: '1.25rem', paddingTop: '1.1rem', borderTop: '1px solid #e9eef5', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center' }}>
              {[
                { icon: '🏏', label: 'Every run matters' },
                { icon: '🎯', label: 'Every wicket counts' },
                { icon: '🤝', label: 'Every match remembered' },
              ].map((item, i) => (
                <div key={i}>
                  <div style={{ fontSize: '22px', marginBottom: '0.3rem' }}>{item.icon}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {loading && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '40px', marginBottom: '1rem', display: 'inline-block', animation: 'spin 1s linear infinite' }}>🏏</div>
            <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-primary)' }}>Searching live cricket databases...</div>
            <div style={{ fontSize: '13px', marginTop: '0.5rem', color: 'var(--text-muted)' }}>Querying SCA — stats will load automatically after results are found</div>
          </div>
        )}

        {error && (
          <div style={{
            padding: '1.5rem', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-lg)', marginTop: '1.5rem', textAlign: 'center',
          }}>
            <div style={{ fontSize: '28px', marginBottom: '0.5rem' }}>❌</div>
            <div style={{ fontWeight: '600', color: 'var(--danger)', marginBottom: '0.5rem' }}>Search Error</div>
            <div style={{ color: '#7f1d1d', fontSize: '14px' }}>{error}</div>
            <button
              onClick={() => handleSearch(searchQuery)}
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
            >
              Retry Search
            </button>
          </div>
        )}

        {searchResults && !loading && <AggregatedResults searchResults={searchResults} />}
      </div>
      )}

      {/* Footer */}
      <div style={{
        backgroundColor: 'var(--surface-dark)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '2rem 1.5rem', marginTop: '3rem', textAlign: 'center',
      }}>
        <div style={{ fontSize: '12px', color: 'var(--text-on-dark-muted)' }}>
          Changi Risers Cricket | Club &amp; Stats &bull; Singapore Cricket Search &bull; Live data from SCA
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '11px', color: 'rgba(203,213,225,0.7)', fontStyle: 'italic', maxWidth: '700px', margin: '0.75rem auto 0' }}>
          Certain figures are applicable for players who have represented Team Changi Risers, Cognizant Corporate and Assassins at one point of time.
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '11px', color: 'rgba(203,213,225,0.7)', maxWidth: '700px', margin: '0.75rem auto 0', lineHeight: '1.7' }}>
          This platform uses AI-driven insights to standardize player stats, reduce bias, and enable fair, transparent decision-making.
          It supports both the skipper and Changi Risers management with reliable, data-backed insights.
          By fostering trust, healthy competition, and a performance mindset, it helps the Risers achieve consistent success.
        </div>
      </div>
    </div>
  );
}
