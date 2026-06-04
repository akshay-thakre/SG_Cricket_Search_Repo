import bplStats from '../data/bplStats.json';

/**
 * Search BPL 2025 tournament static player data by name.
 *
 * @param {string} query  Partial or full player name, case-insensitive.
 * @returns {object[]}    Matching player records.
 */
export function searchBPLStats(query) {
  if (!query || query.trim().length < 2) return [];
  const words = query.trim().toLowerCase().split(/\s+/);

  return bplStats.players
    .filter((p) => {
      const name = p.name.toLowerCase();
      return words.every((w) => name.includes(w));
    })
    .map((p) => ({
      id: `bpl-${p.player_id}`,
      name: p.name,
      team: p.teams && p.teams.length > 0 ? p.teams[0].team_name : 'Unknown',
      source: 'bpl-static',
      tournament: bplStats.tournament,
      lastUpdated: '4th June 2026',
      batting: p.batting,
      bowling: p.bowling,
    }));
}
