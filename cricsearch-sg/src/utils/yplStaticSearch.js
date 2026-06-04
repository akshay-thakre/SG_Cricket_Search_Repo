import assasinsStats from '../data/assasinsStats.json';

/**
 * Search Assasins CC YPL Elite (2017–2018) static player data by name.
 *
 * @param {string} query  Partial or full player name, case-insensitive.
 * @returns {object[]}    Matching player records in search-result shape.
 */
export function searchAssasinsStats(query) {
  if (!query || query.trim().length < 2) return [];
  const words = query.trim().toLowerCase().split(/\s+/);

  return assasinsStats.players
    .filter((p) => {
      const name = p.player.toLowerCase();
      return words.every((w) => name.includes(w));
    })
    .map((p) => ({
      // Stable ID so React keys don't collide across re-renders
      id: `ypl-assassins-${p.player.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
      name:        p.player,
      team:        assasinsStats.team,
      role:        null,
      source:      'ypl-static',
      seasons:     assasinsStats.seasons,
      competition: assasinsStats.competition,
      // Embed full stats so the card renders without any API call
      inlineStats: {
        batting: p.batting,
        bowling: p.bowling,
      },
    }));
}
