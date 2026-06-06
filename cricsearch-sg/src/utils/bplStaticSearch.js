import bplStats from '../data/bplStats.json';

/**
 * Search BPL tournament static data by player name.
 * Works with the leaderboard format: { competition, data: [{ tournamentName, batting: [], bowling: [] }] }
 *
 * @param {string} query  Partial or full player name, case-insensitive.
 * @returns {object[]}    Matching player records.
 */
export function searchBPLStats(query) {
  if (!query || query.trim().length < 2) return [];
  const words = query.trim().toLowerCase().split(/\s+/);

  const results = [];

  for (const tournament of bplStats.data || []) {
    for (const battingRecord of tournament.batting || []) {
      const name = battingRecord.player?.toLowerCase() || '';
      if (!words.every(w => name.includes(w))) continue;

      // Find a matching bowling record for the same player + team
      const bowlingRecord = (tournament.bowling || []).find(
        b => b.player === battingRecord.player && b.team === battingRecord.team
      ) || null;

      results.push({
        id: `bpl-${tournament.tournamentId}-${battingRecord.rank}`,
        name: battingRecord.player,
        team: battingRecord.team,
        source: 'bpl-static',
        tournament: tournament.tournamentName,
        lastUpdated: bplStats.lastUpdated,
        batting: battingRecord,
        bowling: bowlingRecord,
      });
    }
  }

  return results;
}
