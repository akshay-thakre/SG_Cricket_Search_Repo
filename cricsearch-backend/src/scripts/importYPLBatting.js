#!/usr/bin/env node
'use strict';

/**
 * @script importYPLBatting
 * @description Fetches YPL team batting stats from Sportygo and saves static JSON files.
 *
 * Usage: node src/scripts/importYPLBatting.js [--year=2026] [--team=211,120]
 *
 * Output files:
 *   data/sportygo/ypl/batting/{year}/team-211.json
 *   data/sportygo/ypl/batting/{year}/team-120.json
 *   data/sportygo/ypl/batting/{year}/consolidated.json
 *
 * If the Sportygo host is blocked (403 / "Host not in allowlist"), the script
 * logs a clear message and exits without overwriting any existing data files.
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const { fetchTeamBatting, DISPLAY_NAME } = require('../dataSources/sportygo/YPLBattingAdapter');
const { consolidatePlayers, DATA_ROOT, teamFile, consolidatedFile } = require('../services/battingAggregationService');

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const yearArg  = (args.find((a) => a.startsWith('--year='))  || '').split('=')[1];
const teamArg  = (args.find((a) => a.startsWith('--team='))  || '').split('=')[1];

const YEAR     = yearArg || new Date().getFullYear().toString();
const TEAM_IDS = teamArg ? teamArg.split(',').map((t) => t.trim()) : ['211', '120'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function saveJson(filePath, data) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function log(msg)  { console.log(msg); }
function warn(msg) { console.warn(`⚠️  ${msg}`); }
function ok(msg)   { console.log(`✅ ${msg}`); }
function err(msg)  { console.error(`❌ ${msg}`); }

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('');
  log(`═══════════════════════════════════════════`);
  log(`  ${DISPLAY_NAME} Batting Import — Year ${YEAR}`);
  log(`═══════════════════════════════════════════`);
  log('');

  const teamDatasets = [];
  let anyBlocked = false;
  let anyError   = false;

  for (const teamId of TEAM_IDS) {
    log(`Fetching ${DISPLAY_NAME} Team ${teamId} batting stats...`);

    const result = await fetchTeamBatting(teamId);

    if (result.blocked) {
      warn(`${DISPLAY_NAME} Team ${teamId}: ${result.blockedMessage}`);
      warn(`  Technical detail: HTTP 403 / Host not in allowlist at ${result.sourceUrl}`);
      warn(`  Tip: Run this script locally (not on Render) to access the live data.`);
      anyBlocked = true;
      continue;
    }

    if (result.error || result.players.length === 0) {
      err(`${DISPLAY_NAME} Team ${teamId}: ${result.error || 'No data found in page.'}`);
      anyError = true;
      continue;
    }

    ok(`Parsed ${result.players.length} player(s) from ${DISPLAY_NAME} Team ${teamId}.`);

    const envelope = {
      source:      'sportygo-ypl',
      displayName: DISPLAY_NAME,
      clubId:      result.clubId,
      teamId,
      year:        YEAR,
      sourceUrl:   result.sourceUrl,
      importedAt:  new Date().toISOString(),
      isSample:    false,
      players:     result.players.map((p) => ({ ...p, year: YEAR })),
    };

    const outPath = teamFile(YEAR, teamId, false);
    saveJson(outPath, envelope);
    ok(`Saved ${path.relative(process.cwd(), outPath)}`);
    log('');

    teamDatasets.push(envelope.players);
  }

  // ── Consolidated ──────────────────────────────────────────────────────────
  if (teamDatasets.length > 0) {
    log(`Generating ${DISPLAY_NAME} consolidated batting stats...`);

    const players = consolidatePlayers(teamDatasets);

    const consolidated = {
      source:      'sportygo-ypl',
      displayName: DISPLAY_NAME,
      clubId:      process.env.SPORTYGO_CLUB_ID || '4263',
      teamId:      'consolidated',
      year:        YEAR,
      sourceUrl:   null,
      importedAt:  new Date().toISOString(),
      isSample:    false,
      players,
    };

    const consolidatedPath = consolidatedFile(YEAR, false);
    saveJson(consolidatedPath, consolidated);
    ok(`Saved ${path.relative(process.cwd(), consolidatedPath)}`);
    log('');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  log('───────────────────────────────────────────');
  if (anyBlocked) {
    warn(`Some team pages were blocked. To import blocked teams:`);
    warn(`  1. Run this script from a local machine (not a cloud server).`);
    warn(`  2. Or copy-paste the batting table via the app's Manual Import feature.`);
  }
  if (anyError) {
    err('Some imports failed. Check the errors above.');
  }
  if (!anyBlocked && !anyError) {
    ok(`All ${DISPLAY_NAME} teams imported successfully for year ${YEAR}.`);
  }
  log('───────────────────────────────────────────');
  log('');
}

main().catch((e) => {
  console.error('[importYPLBatting] Fatal error:', e.message);
  process.exit(1);
});
