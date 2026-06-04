import React, { useState, useEffect, useRef } from 'react';
import { searchAcrossPlatforms, checkHealth } from './services/apiService';
import { AggregatedResults } from './components/AggregatedResults';
import { MultiPlatformSearchBar } from './components/MultiPlatformSearchBar';

export default function CricSearchApp() {
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [searchQuery, setSearchQuery]   = useState('');
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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#dfe7f0' }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#f5f8fc',
        borderBottom: '1px solid #d0dae8',
        padding: '1.5rem',
        boxShadow: '0 2px 8px rgba(6, 28, 84, 0.06)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#0066cc' }}>
                🏏 CricSearch SG
              </h1>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '0.25rem' }}>
                Singapore Cricket Player Search — Live Data
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                backgroundColor: backendStatus === 'online' ? '#f0fdf4' : backendStatus === 'offline' ? '#fef2f2' : '#fefce8',
                padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                color: backendStatus === 'online' ? '#16a34a' : backendStatus === 'offline' ? '#dc2626' : '#ca8a04',
                border: `1px solid ${backendStatus === 'online' ? '#bbf7d0' : backendStatus === 'offline' ? '#fecaca' : '#fef08a'}`,
              }}>
                <span style={{ fontSize: '8px' }}>●</span>
                {backendStatus === 'online' ? 'API Online' : backendStatus === 'offline' ? 'API Offline' : 'Checking...'}
              </div>
              <div style={{
                backgroundColor: '#e8f1ff', padding: '0.5rem 1rem', borderRadius: '6px',
                fontSize: '12px', fontWeight: '600', color: '#0066cc', border: '1px solid #d0dae8',
              }}>
                🇸🇬 SG Only
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1.5rem 2rem' }}>

        {/* Backend Offline Warning */}
        {backendStatus === 'offline' && (
          <div style={{
            padding: '1.25rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
          }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: '600', color: '#dc2626', fontSize: '14px' }}>Backend API is offline</div>
              <div style={{ color: '#7f1d1d', fontSize: '13px', marginTop: '2px' }}>
                Start the backend: <code style={{ backgroundColor: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>cd cricsearch-backend && npm start</code>
              </div>
            </div>
          </div>
        )}

        <MultiPlatformSearchBar onSearch={handleSearch} onClear={handleClear} initialQuery={searchQuery} />

        {loading && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '40px', marginBottom: '1rem', animation: 'spin 1s linear infinite' }}>🏏</div>
            <div style={{ fontSize: '16px', fontWeight: '500' }}>Searching live cricket databases...</div>
            <div style={{ fontSize: '13px', marginTop: '0.5rem', color: '#9ca3af' }}>Querying SCA — stats will load automatically after results are found</div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && (
          <div style={{
            padding: '1.5rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '10px', marginTop: '1.5rem', textAlign: 'center',
          }}>
            <div style={{ fontSize: '28px', marginBottom: '0.5rem' }}>❌</div>
            <div style={{ fontWeight: '600', color: '#dc2626', marginBottom: '0.5rem' }}>Search Error</div>
            <div style={{ color: '#7f1d1d', fontSize: '14px' }}>{error}</div>
            <button
              onClick={() => handleSearch(searchQuery)}
              style={{
                marginTop: '1rem', padding: '0.5rem 1.5rem', backgroundColor: '#dc2626',
                color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
              }}
            >
              Retry Search
            </button>
          </div>
        )}

        {searchResults && !loading && <AggregatedResults searchResults={searchResults} />}
      </div>

      {/* Footer */}
      <div style={{
        backgroundColor: '#f5f8fc', borderTop: '1px solid #d0dae8',
        padding: '1.5rem', marginTop: '3rem', fontSize: '12px', color: '#64748b', textAlign: 'center',
      }}>
        <div>CricSearch SG • Singapore Cricket Search • Live data from SCA</div>
        <div style={{ marginTop: '0.25rem', fontSize: '11px' }}>YPL Batting Stats • Stumps, Last Man Stands — coming soon</div>
      </div>
    </div>
  );
}
