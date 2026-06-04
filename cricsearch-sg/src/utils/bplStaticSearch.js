import bplStats from '../data/bplStats.json';

/**
 * Format an ISO-8601 timestamp as "4th June 2026" for display in player cards.
 * Falls back to the raw string if parsing fails.
 */
function formatLastUpdated(iso) {
  try {
    const d = new Date(iso);
    const day = d.getDate();
    const v = day % 100;
    const suffix = (v >= 11 && v <= 13)
      ? 'th'
      : (['th', 'st', 'nd', 'rd'][day % 10] || 'th');
    const month = d.toLocaleString('en-US', { month: 'long' });
    return `${day}${suffix} ${month} ${d.getFullYear()}`;
  } catch {
    return iso;
  }
}

/**
 * Search BPL 2025 tournament static player data by name.
 *
 * @param {string} query  Partial or full player name, case-insensitive.
 * @returns {object[]}    Matching player records.
 */
export function searchBPLStats(query) {
  if (!query || query.trim().length < 2) return [];
  const words = query.trim().toLowerCase().split(/\s+/);
  const lastUpdated = bplStats.lastUpdated
    ? formatLastUpdated(bplStats.lastUpdated)
    : 'Unknown';

  return bplStats.players
    .filter((p) => {
      const name = p.name.toLowerCase();
      return words.every((w) => name.includes(w));
    })
    .map((p) => ({
      id: p.player_id > 0
        ? `bpl-${p.player_id}`
        : `bpl-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: p.name,
      team: p.teams && p.teams.length > 0 ? p.teams[0].team_name : 'Unknown',
      source: 'bpl-static',
      tournament: bplStats.tournament,
      lastUpdated,
      batting: p.batting,
      bowling: p.bowling,
    }));
}
