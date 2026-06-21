import { searchAssasinsStats } from '../utils/yplStaticSearch';
import { searchSGIAStats } from '../utils/sgiaStaticSearch';
import { searchSCACorporateStats } from '../utils/scaCorporateSearch';
import { searchBPLStats } from '../utils/bplStaticSearch';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ── YPL (Sportygo) batting stats ─────────────────────────────────────────────

/**
 * Fetch YPL batting stats for a team/year from the backend static JSON store.
 * @param {string} year   e.g. '2026'
 * @param {string} team   '211' | '120' | 'consolidated'
 */
export async function fetchYPLBatting(year, team) {
  const res = await fetch(`${API_BASE}/api/ypl/batting?year=${encodeURIComponent(year)}&team=${encodeURIComponent(team)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Fetch available years with YPL data. */
export async function fetchYPLYears() {
  const res = await fetch(`${API_BASE}/api/ypl/years`);
  if (!res.ok) return { years: [new Date().getFullYear().toString()] };
  return res.json();
}

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
 * Multi-platform search — SCA (live) + YPL (static client-side).
 * Splits multi-word queries into firstName + lastName for better CricClubs matching.
 */
export async function searchAcrossPlatforms(query, signal) {
  const platforms = {
    'SCA': {
      platformName: 'SCA',
      count: 0, players: [],
      icon: { emoji: '🏏', color: '#1e40af', code: 'SCA' },
      noResults: true, loading: false, error: null,
    },
    'YPL': {
      platformName: 'YPL',
      count: 0, players: [],
      icon: { emoji: '🏆', color: '#b45309', code: 'YPL' },
      noResults: true, loading: false, error: null,
    },
    'SG IA': {
      platformName: 'SG IA',
      count: 0, players: [],
      icon: { emoji: '🇸🇬', color: '#dc2626', code: 'SIA' },
      noResults: true, loading: false, error: null,
    },
    'BPL': {
      platformName: 'BPL',
      count: 0, players: [],
      icon: { emoji: '🏟️', color: '#7c3aed', code: 'BPL' },
      noResults: true, loading: false, error: null,
    },
  };

  let totalFound = 0;

  // SCA has separate firstName/lastName fields — build a set of param combinations
  // to handle middle names and varied registration patterns.
  const parts = query.trim().split(/\s+/);
  const scaParamCandidates = [];

  if (parts.length === 1) {
    scaParamCandidates.push({ firstName: parts[0] });
  } else if (parts.length === 2) {
    scaParamCandidates.push({ firstName: parts[0], lastName: parts[1] });
  } else {
    // 3+ words: try multiple splits so middle names don't block a match.
    // e.g. "Vikram Singh Salaria" → try (Vikram, Singh Salaria) AND (Vikram, Salaria)
    scaParamCandidates.push({ firstName: parts[0], lastName: parts.slice(1).join(' ') }); // all after first
    scaParamCandidates.push({ firstName: parts[0], lastName: parts[parts.length - 1] });  // first + last word only
    scaParamCandidates.push({ firstName: parts[0], lastName: parts[1] });                 // first two words
  }

  // ── SCA — LIVE (parallel searches, deduplicated) ─────────────────
  let scaLivePlayers = [];
  try {
    const scaResponses = await Promise.all(
      scaParamCandidates.map((params) =>
        searchSCAPlayers(params, signal).catch((err) => {
          if (err.name === 'AbortError') throw err;
          return { players: [] };
        })
      )
    );

    const seen = new Set();
    for (const scaResult of scaResponses) {
      for (const p of scaResult.players || []) {
        if (!p.id || seen.has(p.id)) continue;
        seen.add(p.id);
        scaLivePlayers.push({
          id: p.id,
          name: p.name,
          team: p.teamName || 'Unknown',
          role: p.playerRole || 'Unknown',
          profileUrl: p.profileUrl,
          verified: p.verified,
          source: 'sca',
        });
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    platforms['SCA'].error = err.message;
  }

  // ── SCA Corporate — STATIC (client-side) ────────────────────────
  const scaCorpMatches = searchSCACorporateStats(query);

  const allScaPlayers = [...scaLivePlayers, ...scaCorpMatches];
  if (allScaPlayers.length > 0) {
    platforms['SCA'] = {
      ...platforms['SCA'],
      count: allScaPlayers.length,
      players: allScaPlayers,
      noResults: false,
    };
    totalFound += allScaPlayers.length;
  }

  // ── YPL — STATIC (client-side, no network call) ─────────────────
  const yplMatches = searchAssasinsStats(query);
  if (yplMatches.length > 0) {
    platforms['YPL'] = {
      ...platforms['YPL'],
      count: yplMatches.length,
      players: yplMatches,
      noResults: false,
    };
    totalFound += yplMatches.length;
  }

  // ── SG IA — STATIC (client-side, no network call) ────────────────
  const sgiaMatches = searchSGIAStats(query);
  if (sgiaMatches.length > 0) {
    platforms['SG IA'] = {
      ...platforms['SG IA'],
      count: sgiaMatches.length,
      players: sgiaMatches,
      noResults: false,
    };
    totalFound += sgiaMatches.length;
  }

  // ── BPL — STATIC (client-side, no network call) ──────────────────
  const bplMatches = searchBPLStats(query);
  if (bplMatches.length > 0) {
    platforms['BPL'] = {
      ...platforms['BPL'],
      count: bplMatches.length,
      players: bplMatches,
      noResults: false,
    };
    totalFound += bplMatches.length;
  }

  return {
    query,
    results: platforms,
    totalFound,
    platforms: Object.keys(platforms),
    meta: {
      live:   ['SCA'],
      static: ['YPL', 'SG IA', 'BPL'],
    },
  };
}
