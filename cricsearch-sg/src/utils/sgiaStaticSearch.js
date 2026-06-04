import sgiaStats from '../data/sgiaStats.json';

/**
 * Search SG IA (Singapore Indian Association) static player data by name.
 *
 * @param {string} query  Partial or full player name, case-insensitive.
 * @returns {object[]}    Matching player records in search-result shape.
 */
export function searchSGIAStats(query) {
  if (!query || query.trim().length < 2) return [];
  const words = query.trim().toLowerCase().split(/\s+/);
  const matches = (name) => words.every((w) => name.toLowerCase().includes(w));

  const matchMap = new Map(); // key: normalized player name → aggregated entry

  for (const tournament of sgiaStats.data) {
    const { tournamentName, tournamentId, year, status } = tournament;

    for (const batter of tournament.batting) {
      if (!matches(batter.player)) continue;
      const key = batter.player.toLowerCase();
      if (!matchMap.has(key)) {
        matchMap.set(key, {
          id: `sgia-${key.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
          name: batter.player,
          team: batter.team,
          source: 'sgia-static',
          lastUpdated: sgiaStats.lastUpdated,
          entries: [],
        });
      }
      const existing = matchMap.get(key);
      // Find or create entry for this tournament
      let entry = existing.entries.find((e) => e.tournamentId === tournamentId);
      if (!entry) {
        entry = { tournamentName, tournamentId, year, status, batting: null, bowling: null };
        existing.entries.push(entry);
      }
      entry.batting = batter;
    }

    for (const bowler of tournament.bowling) {
      if (!matches(bowler.player)) continue;
      const key = bowler.player.toLowerCase();
      if (!matchMap.has(key)) {
        matchMap.set(key, {
          id: `sgia-${key.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
          name: bowler.player,
          team: bowler.team,
          source: 'sgia-static',
          lastUpdated: sgiaStats.lastUpdated,
          entries: [],
        });
      }
      const existing = matchMap.get(key);
      let entry = existing.entries.find((e) => e.tournamentId === tournamentId);
      if (!entry) {
        entry = { tournamentName, tournamentId, year, status, batting: null, bowling: null };
        existing.entries.push(entry);
      }
      entry.bowling = bowler;
    }
  }

  return Array.from(matchMap.values());
}
