import scaCorporateStats from '../data/scaCorporateStats.json';

/**
 * Search SCA Corporate (Cognizant) static player data by name.
 *
 * @param {string} query  Partial or full player name, case-insensitive.
 * @returns {object[]}    Matching player records.
 */
export function searchSCACorporateStats(query) {
  if (!query || query.trim().length < 2) return [];
  const words = query.trim().toLowerCase().split(/\s+/);
  const matches = (name) => words.every((w) => name.toLowerCase().includes(w));

  const matchMap = new Map(); // key: normalised player name → aggregated entry

  for (const [year, season] of Object.entries(scaCorporateStats.seasons)) {
    const { competition, batting = [], bowling = [] } = season;

    for (const batter of batting) {
      if (!matches(batter.player)) continue;
      const key = batter.player.toLowerCase();
      if (!matchMap.has(key)) {
        matchMap.set(key, {
          id: `sca-corp-${key.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
          name: batter.player,
          team: batter.team,
          source: 'sca-corporate',
          seasons: [],
        });
      }
      const entry = matchMap.get(key);
      let seasonEntry = entry.seasons.find((s) => s.year === year);
      if (!seasonEntry) {
        seasonEntry = { year, competition, batting: null, bowling: null };
        entry.seasons.push(seasonEntry);
      }
      seasonEntry.batting = batter;
    }

    for (const bowler of bowling) {
      if (!matches(bowler.player)) continue;
      const key = bowler.player.toLowerCase();
      if (!matchMap.has(key)) {
        matchMap.set(key, {
          id: `sca-corp-${key.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
          name: bowler.player,
          team: bowler.team,
          source: 'sca-corporate',
          seasons: [],
        });
      }
      const entry = matchMap.get(key);
      let seasonEntry = entry.seasons.find((s) => s.year === year);
      if (!seasonEntry) {
        seasonEntry = { year, competition, batting: null, bowling: null };
        entry.seasons.push(seasonEntry);
      }
      seasonEntry.bowling = bowler;
    }
  }

  return Array.from(matchMap.values());
}
