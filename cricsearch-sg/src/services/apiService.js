const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Search players on SCA platform via the backend proxy
 */
export async function searchSCAPlayers(params, signal) {
  const response = await fetch(`${API_BASE}/api/sca/players/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Search players on Sportygo platform via the backend proxy
 */
export async function searchSportygoPlayers(params, signal) {
  const response = await fetch(`${API_BASE}/api/sportygo/players/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch list of available SCA clubs
 */
export async function fetchSCAClubs() {
  const response = await fetch(`${API_BASE}/api/sca/clubs`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * Check backend API health
 */
export async function checkHealth() {
  const response = await fetch(`${API_BASE}/api/health`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * Fetch detailed player stats from SCA profile page.
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
 * Fetch detailed player stats from Sportygo profile page.
 * @param {string} playerId - Numeric player ID
 * @param {string} clubId   - Club ID extracted from the player's profileUrl
 */
export async function fetchSportygoPlayerStats(playerId, clubId) {
  const url = `${API_BASE}/api/sportygo/players/${encodeURIComponent(playerId)}/stats?clubId=${encodeURIComponent(clubId)}`;
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Route stats fetch to the correct backend endpoint based on player.source.
 * @param {{ id: string, source: string, clubId?: string }} player
 */
export async function fetchAnyPlayerStats(player) {
  if (player.source === 'sportygo') {
    return fetchSportygoPlayerStats(player.id, player.clubId);
  }
  return fetchPlayerStats(player.id);
}

/**
 * Multi-platform search — SCA (live) + Sportygo (live when SPORTYGO_CLUB_ID is set).
 * Splits multi-word queries into firstName + lastName for better CricClubs matching.
 */
export async function searchAcrossPlatforms(query, signal) {
  const platforms = {
    'CricClubs (SCA)': {
      platformName: 'CricClubs (SCA)',
      count: 0, players: [],
      icon: { emoji: '🏏', color: '#1e40af', code: 'CC' },
      noResults: true, loading: false, error: null,
    },
    'Sportygo': {
      platformName: 'Sportygo',
      count: 0, players: [],
      icon: { emoji: '🏟️', color: '#16a34a', code: 'SY' },
      noResults: true, loading: false, error: null,
    },
    'Stumps': {
      platformName: 'Stumps',
      count: 0, players: [],
      icon: { emoji: '🏑', color: '#2563eb', code: 'ST' },
      noResults: true, loading: false, error: null,
      disabled: true, disabledReason: 'Coming soon',
    },
    'Last Man Stands': {
      platformName: 'Last Man Stands',
      count: 0, players: [],
      icon: { emoji: '⚡', color: '#f59e0b', code: 'LMS' },
      noResults: true, loading: false, error: null,
      disabled: true, disabledReason: 'Coming soon',
    },
  };

  let totalFound = 0;

  // SCA has separate firstName/lastName fields — split the query
  const parts = query.trim().split(/\s+/);
  const scaParams = parts.length >= 2
    ? { firstName: parts[0], lastName: parts.slice(1).join(' ') }
    : { firstName: query };

  // Sportygo has a single "Name" field mapped to firstName — send full query
  const sportygoParams = { firstName: query.trim() };

  // ── SCA — LIVE ──────────────────────────────────────────────────
  try {
    const scaResult = await searchSCAPlayers(scaParams, signal);
    if (scaResult.players && scaResult.players.length > 0) {
      const seen = new Set();
      const uniquePlayers = scaResult.players.filter((p) => {
        if (!p.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      platforms['CricClubs (SCA)'] = {
        ...platforms['CricClubs (SCA)'],
        count: uniquePlayers.length,
        players: uniquePlayers.map((p) => ({
          id: p.id,
          name: p.name,
          team: p.teamName || 'Unknown',
          role: p.playerRole || 'Unknown',
          profileUrl: p.profileUrl,
          verified: p.verified,
          source: 'sca',
        })),
        noResults: false,
      };
      totalFound += uniquePlayers.length;
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    platforms['CricClubs (SCA)'].error = err.message;
    platforms['CricClubs (SCA)'].noResults = true;
  }

  // ── Sportygo — LIVE ─────────────────────────────────────────────
  try {
    const sgResult = await searchSportygoPlayers(sportygoParams, signal);
    if (sgResult.players && sgResult.players.length > 0) {
      const seen = new Set();
      const uniquePlayers = sgResult.players.filter((p) => {
        if (!p.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      platforms['Sportygo'] = {
        ...platforms['Sportygo'],
        count: uniquePlayers.length,
        players: uniquePlayers.map((p) => ({
          id: p.id,
          name: p.name,
          team: p.teamName || 'Unknown',
          role: p.playerRole || 'Unknown',
          profileUrl: p.profileUrl,
          verified: p.verified,
          source: 'sportygo',
          clubId: p.clubId,
        })),
        noResults: false,
      };
      totalFound += uniquePlayers.length;
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    platforms['Sportygo'].error = err.message;
    platforms['Sportygo'].noResults = true;
  }

  return {
    query,
    results: platforms,
    totalFound,
    platforms: Object.keys(platforms),
    meta: {
      live: ['CricClubs (SCA)', 'Sportygo'],
      disabled: ['Stumps', 'Last Man Stands'],
    },
  };
}
