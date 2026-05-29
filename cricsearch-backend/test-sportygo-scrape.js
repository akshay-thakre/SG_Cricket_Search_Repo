/**
 * Smoke test for the Playwright-based Sportygo scraper.
 * Searches for "Akshay Thakre" and validates known stats.
 *
 * Usage:
 *   node test-sportygo-scrape.js
 *
 * Optional env vars:
 *   PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH  — path to a pre-installed Chromium binary
 *   DEBUG_SCRAPER=true                   — verbose logs
 */

require('dotenv').config();

const { searchPlayers } = require('./src/services/sportygo/sportygo.service');
const { fetchSportygoPlayerStats } = require('./src/services/sportygo/sportygo.profile');
const { closeBrowser } = require('./src/services/sportygo/sportygo.client');

const KNOWN_PLAYER_ID = '2731374';
const KNOWN_CLUB_ID   = '4263';

// Expected values for Akshay Thakre on Sportygo
const EXPECTED = {
  name:    'Akshay Thakre',
  matches: 4,
  runs:    39,
  wickets: 5,
};

function ok(label, value) {
  console.log(`  ✅  ${label}: ${JSON.stringify(value)}`);
}

function fail(label, expected, actual) {
  console.error(`  ❌  ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  process.exitCode = 1;
}

function check(label, expected, actual) {
  if (actual === expected || (expected === null && actual == null)) {
    ok(label, actual);
  } else {
    fail(label, expected, actual);
  }
}

async function testSearch() {
  console.log('\n══════════════════════════════════════════');
  console.log('STEP 1 — Search: "Akshay Thakre"');
  console.log('══════════════════════════════════════════');

  const result = await searchPlayers({ firstName: 'Akshay Thakre' });

  console.log(`  source:       ${result.source}`);
  console.log(`  totalResults: ${result.totalResults}`);
  console.log(`  method:       ${result.meta.method}`);

  if (result.players.length === 0) {
    fail('players found', '>0', 0);
    return null;
  }

  // Find the known player
  const player = result.players.find((p) => p.id === KNOWN_PLAYER_ID)
              || result.players[0];

  console.log(`\n  First player:`);
  console.log(`    id:         ${player.id}`);
  console.log(`    name:       ${player.name}`);
  console.log(`    team:       ${player.teamName}`);
  console.log(`    role:       ${player.playerRole}`);
  console.log(`    clubId:     ${player.clubId}`);
  console.log(`    profileUrl: ${player.profileUrl}`);

  if (player.name && player.name.toLowerCase().includes('akshay')) {
    ok('name contains "akshay"', player.name);
  } else {
    fail('name contains "akshay"', 'Akshay*', player.name);
  }

  return player;
}

async function testProfile(player) {
  const playerId = player ? player.id : KNOWN_PLAYER_ID;
  const clubId   = player ? (player.clubId || KNOWN_CLUB_ID) : KNOWN_CLUB_ID;

  console.log('\n══════════════════════════════════════════');
  console.log(`STEP 2 — Profile: playerId=${playerId}, clubId=${clubId}`);
  console.log('══════════════════════════════════════════');

  const stats = await fetchSportygoPlayerStats(playerId, clubId);

  console.log('\n  player:');
  console.log('   ', JSON.stringify(stats.player, null, 2).replace(/\n/g, '\n    '));

  console.log('\n  batting rows:', stats.batting.length);
  stats.batting.forEach((r, i) => {
    console.log(`    [${i}] ${r.seriesType} | mat=${r.mat} | runs=${r.runs} | inns=${r.inns} | hs=${r.hs}`);
  });

  console.log('\n  bowling rows:', stats.bowling.length);
  stats.bowling.forEach((r, i) => {
    console.log(`    [${i}] ${r.seriesType} | mat=${r.mat} | wkts=${r.wkts} | eco=${r.eco}`);
  });

  console.log('\n  meta:', JSON.stringify(stats.meta));

  console.log('\n  Validating expected values…');

  const { totals } = stats.player;
  check('player.name',         EXPECTED.name,    stats.player.name);
  check('totals.matches',      EXPECTED.matches, totals && totals.matches);
  check('totals.runs',         EXPECTED.runs,    totals && totals.runs);
  check('totals.wickets',      EXPECTED.wickets, totals && totals.wickets);
  check('batting is array',    true, Array.isArray(stats.batting));
  check('source === sportygo', 'sportygo', stats.source);

  return stats;
}

async function main() {
  try {
    const player = await testSearch();
    await testProfile(player);
    console.log('\n══════════════════════════════════════════');
    console.log(process.exitCode === 1 ? '❌  Some checks FAILED' : '✅  All checks PASSED');
    console.log('══════════════════════════════════════════\n');
  } catch (err) {
    console.error('\n❌  Test error:', err.message);
    if (process.env.DEBUG_SCRAPER === 'true') console.error(err.stack);
    process.exitCode = 1;
  } finally {
    await closeBrowser();
  }
}

main();
