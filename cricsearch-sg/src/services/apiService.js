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
 * Fetch detailed player stats from the backend (which scrapes the profile page).
 * @param {string} playerId - Numeric player ID
 * @returns {Promise<Object>} Player stats including batting/bowling data
 */
export async function fetchPlayerStats(playerId) {
  const response = await fetch(`${API_BASE}/api/sca/players/${encodeURIComponent(playerId)}/stats`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Multi-platform search - currently only SCA is live.
 * Splits multi-word queries into firstName + lastName for better SCA matching.
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

  // Split "First Last" into separate fields for more accurate SCA matching
  const parts = query.trim().split(/\s+/);
  const searchParams = parts.length >= 2
    ? { firstName: parts[0], lastName: parts.slice(1).join(' ') }
    : { firstName: query };

  // SCA - LIVE
  try {
    const scaResult = await searchSCAPlayers(searchParams);
    if (scaResult.players && scaResult.players.length > 0) {
      // Deduplicate by player ID to avoid showing the same player twice
      const seen = new Set();
      const uniquePlayers = scaResult.players.filter(p => {
        if (!p.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      platforms['CricClubs (SCA)'] = {
        ...platforms['CricClubs (SCA)'],
        count: uniquePlayers.length,
        players: uniquePlayers.map(p => ({
          id: p.id,
          name: p.name,
          team: p.teamName || 'Unknown',
          role: p.playerRole || 'Unknown',
          profileUrl: p.profileUrl,
          verified: p.verified,
        })),
        noResults: false,
      };
      totalFound += uniquePlayers.length;
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
