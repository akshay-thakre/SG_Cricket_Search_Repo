const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Search players on SCA platform via the backend proxy
 * @param {Object} params - Search parameters
 * @param {string} [params.firstName] - Player first name
 * @param {string} [params.teamName] - Team name
 * @param {string} [params.playerCCId] - CricClubs player ID
 * @param {string} [params.internalClub] - Club name
 * @param {string} [params.battingStyle] - Batting style
 * @param {string} [params.bowlingStyle] - Bowling style
 * @param {string} [params.gender] - Gender filter
 * @param {string} [params.playerStatus] - Status filter
 * @returns {Promise<Object>} Search results
 */
export async function searchSCAPlayers(params) {
  const response = await fetch(`${API_BASE}/api/sca/players/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch list of available SCA clubs
 * @returns {Promise<Object>} Club list
 */
export async function fetchSCAClubs() {
  const response = await fetch(`${API_BASE}/api/sca/clubs`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * Check backend API health
 * @returns {Promise<Object>} Health status
 */
export async function checkHealth() {
  const response = await fetch(`${API_BASE}/api/health`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * Multi-platform search - currently only SCA is live.
 * Wraps SCA results in the multi-platform format the UI expects.
 * @param {string} query - Search query (player name)
 * @returns {Promise<Object>} Aggregated results across platforms
 */
export async function searchAcrossPlatforms(query) {
  const platforms = {
    'CricClubs (SCA)': { platformName: 'CricClubs (SCA)', count: 0, players: [], icon: { emoji: '🏏', color: '#1e40af', code: 'CC' }, noResults: true, loading: false, error: null },
    'Stumps': { platformName: 'Stumps', count: 0, players: [], icon: { emoji: '🏑', color: '#2563eb', code: 'ST' }, noResults: true, loading: false, error: null, disabled: true, disabledReason: 'Coming soon' },
    'Last Man Stands': { platformName: 'Last Man Stands', count: 0, players: [], icon: { emoji: '⚡', color: '#f59e0b', code: 'LMS' }, noResults: true, loading: false, error: null, disabled: true, disabledReason: 'Coming soon' },
    'CricHeroes': { platformName: 'CricHeroes', count: 0, players: [], icon: { emoji: '🌟', color: '#ef4444', code: 'CH' }, noResults: true, loading: false, error: null, disabled: true, disabledReason: 'Coming soon' },
  };

  let totalFound = 0;

  // SCA - LIVE
  try {
    const scaResult = await searchSCAPlayers({ firstName: query });
    if (scaResult.players && scaResult.players.length > 0) {
      platforms['CricClubs (SCA)'] = {
        ...platforms['CricClubs (SCA)'],
        count: scaResult.players.length,
        players: scaResult.players.map(p => ({
          id: p.id || `sca_${Math.random().toString(36).slice(2)}`,
          name: p.name,
          team: p.teamName || 'Unknown',
          role: p.playerRole || 'Unknown',
          profileUrl: p.profileUrl,
          verified: p.verified,
          overallStats: null,  // Stats require profile page scraping (Phase 2)
          tournaments: [],
        })),
        noResults: false,
      };
      totalFound += scaResult.players.length;
    }
  } catch (err) {
    platforms['CricClubs (SCA)'].error = err.message;
    platforms['CricClubs (SCA)'].noResults = true;
  }

  return {
    query,
    results: platforms,
    totalFound,
    platforms: Object.keys(platforms),
    meta: { live: ['CricClubs (SCA)'], disabled: ['Stumps', 'Last Man Stands', 'CricHeroes'] },
  };
}
