/**
 * Aggregates batting and bowling stats for a player across all league sources.
 *
 * Each source stores fields under different names and shapes. This utility
 * normalises each source into a canonical form, accumulates raw counts, then
 * derives averages / rates from the totals (never from averages of averages).
 *
 * Returns { batting, bowling } where either may be null if no data exists.
 */

// ── Safe numeric coercion ─────────────────────────────────────────────────────

function n(v) {
  if (v === null || v === undefined || v === '' || v === '-' || v === '--') return null;
  const num = Number(v);
  return isNaN(num) ? null : num;
}

// ── Batting accumulator ───────────────────────────────────────────────────────

function emptyBat() {
  return {
    matches: 0, innings: 0, notOuts: 0, runs: 0, balls: 0,
    fours: 0, sixes: 0, fifties: 0, hundreds: 0, ducks: 0,
    highestScore: null,          // string — keep the best
    _hasAny: false,
  };
}

function addBat(acc, src) {
  if (!src) return;
  acc._hasAny = true;
  acc.matches  += n(src.matches  ?? src.mat)  ?? 0;
  acc.innings  += n(src.innings  ?? src.inns) ?? 0;
  acc.notOuts  += n(src.notOuts  ?? src.not_outs ?? src.no) ?? 0;
  acc.runs     += n(src.runs)    ?? 0;
  acc.balls    += n(src.balls    ?? src.balls_faced) ?? 0;
  acc.fours    += n(src.fours    ?? src['4s'])  ?? 0;
  acc.sixes    += n(src.sixes    ?? src['6s'])  ?? 0;
  acc.fifties  += n(src.fifties  ?? src['50s']) ?? 0;
  acc.hundreds += n(src.hundreds ?? src.centuries ?? src['100s']) ?? 0;
  acc.ducks    += n(src.ducks)   ?? 0;

  // Highest score: compare numerically, keep raw value as string
  const hs = src.highestScore ?? src.highest_score ?? src.hs ?? src.highest;
  if (hs !== null && hs !== undefined && hs !== '' && hs !== '--') {
    const hsNum = parseInt(String(hs).replace(/\*/g, ''), 10);
    const curNum = acc.highestScore
      ? parseInt(String(acc.highestScore).replace(/\*/g, ''), 10)
      : -1;
    if (!isNaN(hsNum) && hsNum > curNum) acc.highestScore = String(hs);
  }
}

function finaliseBat(acc) {
  if (!acc._hasAny) return null;
  const dismissals = acc.innings - acc.notOuts;
  const avg = dismissals > 0 ? acc.runs / dismissals : null;
  const sr  = acc.balls > 0  ? (acc.runs / acc.balls) * 100 : null;
  return {
    matches:      acc.matches  || null,
    innings:      acc.innings  || null,
    notOuts:      acc.notOuts  || null,
    runs:         acc.runs     || null,
    balls:        acc.balls    || null,
    fours:        acc.fours    || null,
    sixes:        acc.sixes    || null,
    fifties:      acc.fifties  || null,
    hundreds:     acc.hundreds || null,
    ducks:        acc.ducks    || null,
    highestScore: acc.highestScore,
    average:      avg,
    strikeRate:   sr,
  };
}

// ── Bowling accumulator ───────────────────────────────────────────────────────

function emptyBwl() {
  return {
    matches: 0, innings: 0, balls: 0, runs: 0, wickets: 0, maidens: 0,
    bestBowling: null,   // string — keep the best figure
    _hasAny: false,
  };
}

// Parse "W/R" bowling figure, return {w, r} for comparison
function parseBB(bb) {
  if (!bb) return null;
  const parts = String(bb).split('/');
  if (parts.length < 2) return null;
  const w = parseInt(parts[0], 10);
  const r = parseInt(parts[1], 10);
  if (isNaN(w) || isNaN(r)) return null;
  return { w, r };
}

function isBetterBB(challenger, current) {
  const c = parseBB(challenger);
  const cur = parseBB(current);
  if (!c) return false;
  if (!cur) return true;
  if (c.w !== cur.w) return c.w > cur.w;
  return c.r < cur.r; // same wickets — fewer runs is better
}

// Convert overs (e.g. "12.3") to integer balls
function oversToBalls(overs) {
  const v = n(overs);
  if (v === null) return 0;
  const complete = Math.floor(v);
  const partial  = Math.round((v - complete) * 10); // tenths = extra balls
  return complete * 6 + partial;
}

// Convert total balls back to overs string e.g. "12.3"
function ballsToOvers(balls) {
  const complete = Math.floor(balls / 6);
  const extra    = balls % 6;
  return extra === 0 ? String(complete) : `${complete}.${extra}`;
}

function addBwl(acc, src) {
  if (!src) return;
  acc._hasAny = true;
  acc.matches  += n(src.matches  ?? src.mat)  ?? 0;
  acc.innings  += n(src.innings  ?? src.inns) ?? 0;
  acc.runs     += n(src.runs     ?? src.runs_conceded) ?? 0;
  acc.wickets  += n(src.wickets  ?? src.wkts) ?? 0;
  acc.maidens  += n(src.maidens  ?? src.mdns) ?? 0;

  // Accumulate balls from overs field (different names per source)
  const overs = src.overs;
  acc.balls += oversToBalls(overs);

  // Best bowling
  const bb = src.bestBowling ?? src.best_bowling ?? src.best_wickets ?? src.bbf ?? src.bbi ?? src.highest;
  if (isBetterBB(bb, acc.bestBowling)) acc.bestBowling = String(bb);
}

function finaliseBwl(acc) {
  if (!acc._hasAny) return null;
  const economy   = acc.balls > 0 ? (acc.runs / acc.balls) * 6 : null;
  const avg       = acc.wickets > 0 ? acc.runs / acc.wickets : null;
  const strikeRate = acc.wickets > 0 ? acc.balls / acc.wickets : null;
  return {
    matches:     acc.matches  || null,
    innings:     acc.innings  || null,
    overs:       ballsToOvers(acc.balls),
    balls:       acc.balls    || null,
    runs:        acc.runs     || null,
    wickets:     acc.wickets  || null,
    maidens:     acc.maidens  || null,
    bestBowling: acc.bestBowling,
    economy:     economy,
    average:     avg,
    strikeRate:  strikeRate,
  };
}

// ── Per-source extractors ─────────────────────────────────────────────────────

function extractFromYPL(player, batAcc, bwlAcc) {
  const { batting, bowling } = player.inlineStats || {};
  addBat(batAcc, batting);
  addBwl(bwlAcc, bowling);
}

function extractFromSGIA(player, batAcc, bwlAcc) {
  for (const entry of player.entries || []) {
    addBat(batAcc, entry.batting);
    addBwl(bwlAcc, entry.bowling);
  }
}

function extractFromBPL(player, batAcc, bwlAcc) {
  addBat(batAcc, player.batting);
  addBwl(bwlAcc, player.bowling);
}

function extractFromSCACorp(player, batAcc, bwlAcc) {
  for (const season of player.seasons || []) {
    addBat(batAcc, season.batting);
    addBwl(bwlAcc, season.bowling);
  }
}

// SCA live stats come in already-normalised shape (via normalizeStats in AggregatedResults)
function extractFromSCALive(stats, batAcc, bwlAcc) {
  if (!stats) return;
  addBat(batAcc, stats.batting);
  addBwl(bwlAcc, stats.bowling);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Collect batting + bowling contributions from all static league sources.
 *
 * @param {object} results  searchResults.results (keyed by platform name)
 * @returns {{ batting: object|null, bowling: object|null, leaguesContributed: string[] }}
 */
export function aggregateStaticPlayerStats(results) {
  const batAcc = emptyBat();
  const bwlAcc = emptyBwl();
  const leaguesContributed = [];

  const sgia = results?.['SG IA'];
  if (sgia && !sgia.noResults && sgia.players?.length > 0) {
    sgia.players.forEach((p) => extractFromSGIA(p, batAcc, bwlAcc));
    leaguesContributed.push('SG IA');
  }

  const ypl = results?.['YPL'];
  if (ypl && !ypl.noResults && ypl.players?.length > 0) {
    ypl.players.forEach((p) => extractFromYPL(p, batAcc, bwlAcc));
    leaguesContributed.push('YPL');
  }

  const bpl = results?.['BPL'];
  if (bpl && !bpl.noResults && bpl.players?.length > 0) {
    bpl.players.forEach((p) => extractFromBPL(p, batAcc, bwlAcc));
    leaguesContributed.push('BPL');
  }

  // SCA corporate players are mixed into the SCA platform list
  const sca = results?.['SCA'];
  if (sca && !sca.noResults && sca.players?.length > 0) {
    sca.players
      .filter((p) => p.source === 'sca-corporate')
      .forEach((p) => extractFromSCACorp(p, batAcc, bwlAcc));
    if (sca.players.some((p) => p.source === 'sca-corporate')) {
      leaguesContributed.push('SCA Corp');
    }
  }

  return {
    batting: finaliseBat(batAcc),
    bowling: finaliseBwl(bwlAcc),
    leaguesContributed,
  };
}

// ── calculatePerformanceAcrossAllLeagues ──────────────────────────────────────
//
// Purpose: produce the four headline totals shown in the "Performance across
// all leagues" panel.  Each league's player records are flattened into a list
// of immutable "contribution" objects that are deduplicated before summing, so
// the same competition record can never inflate the totals.
//
// Field reading uses the exact field names from each source's data shape rather
// than the generic alias chains in addBat/addBwl, which can silently fall back
// to unintended fields.

function safeAdd(v) {
  // Coerce a value to a non-negative integer (0 for missing/null/NaN).
  if (v === null || v === undefined || v === '' || v === '-' || v === '--') return 0;
  const num = Number(v);
  return Number.isNaN(num) || num < 0 ? 0 : Math.floor(num);
}

/**
 * Aggregate headline stats across all four leagues.
 *
 * @param {object} platforms      searchResults.results (keyed by platform)
 * @param {Array}  scaLiveStats   Normalised SCA live player stats (from fetch)
 * @returns {{ totalRuns, totalMatches, totalInnings, totalWickets, leaguesContributed }}
 */
export function calculatePerformanceAcrossAllLeagues(platforms, scaLiveStats = []) {
  const contributions = [];
  const seen = new Set();

  function push(league, dedupeKey, matches, innings, runs, wickets) {
    const key = `${league}||${dedupeKey}`;
    if (seen.has(key)) return;
    seen.add(key);
    contributions.push({
      league,
      matches: safeAdd(matches),
      innings: safeAdd(innings),
      runs:    safeAdd(runs),
      wickets: safeAdd(wickets),
    });
  }

  // ── YPL — inlineStats.batting / .bowling ────────────────────────────────────
  // Field names: batting.{matches, innings, runs} · bowling.{wickets}
  const ypl = platforms?.['YPL'];
  if (ypl && !ypl.noResults && ypl.players?.length > 0) {
    ypl.players.forEach((p) => {
      const b   = p.inlineStats?.batting;
      const bwl = p.inlineStats?.bowling;
      push('YPL', `${p.name}||ypl-static`,
        b?.matches,
        b?.innings,
        b?.runs,
        bwl?.wickets,
      );
    });
  }

  // ── BPL — player.batting / .bowling ─────────────────────────────────────────
  // Field names: batting.{matches, innings, runs} · bowling.{wickets}
  const bpl = platforms?.['BPL'];
  if (bpl && !bpl.noResults && bpl.players?.length > 0) {
    bpl.players.forEach((p) => {
      push('BPL', `${p.name}||bpl-static`,
        p.batting?.matches,
        p.batting?.innings,
        p.batting?.runs,
        p.bowling?.wickets,
      );
    });
  }

  // ── SG IA — player.entries[].batting / .bowling ──────────────────────────────
  // Field names: batting.{mat, inns, runs} · bowling.{wickets}
  // One record per tournament entry (different competitions are separate).
  const sgia = platforms?.['SG IA'];
  if (sgia && !sgia.noResults && sgia.players?.length > 0) {
    sgia.players.forEach((player) => {
      (player.entries || []).forEach((entry) => {
        const b   = entry.batting;
        const bwl = entry.bowling;
        const entryKey = `${player.name}||${entry.tournamentName || ''}||${entry.year || ''}||sgia-static`;
        push('SG IA', entryKey,
          b?.mat,     // SGIA uses mat (not matches)
          b?.inns,    // SGIA uses inns (not innings)
          b?.runs,
          bwl?.wickets,
        );
      });
    });
  }

  // ── SCA Corporate — player.seasons[].batting / .bowling ─────────────────────
  // Field names: batting.{mat, inns, runs} · bowling.{wkts}
  // One record per season (different years are separate).
  // Seasons where the player had zero batting innings AND zero bowling innings
  // are squad-registration entries only — exclude them so they don't inflate
  // the match count without contributing any real activity.
  const sca = platforms?.['SCA'];
  if (sca && !sca.noResults && sca.players?.length > 0) {
    sca.players
      .filter((p) => p.source === 'sca-corporate')
      .forEach((player) => {
        (player.seasons || []).forEach((season) => {
          const batInns = safeAdd(season.batting?.inns);
          const bwlInns = safeAdd(season.bowling?.inns);
          if (batInns === 0 && bwlInns === 0) return; // no real activity — skip
          const seasonKey = `${player.name}||${season.year || ''}||${season.competition || ''}||sca-corporate`;
          push('SCA', seasonKey,
            season.batting?.mat,
            season.batting?.inns,
            season.batting?.runs,
            season.bowling?.wkts,
          );
        });
      });
  }

  // ── SCA Live — normalised stats from async fetch ─────────────────────────────
  // Field names: batting.{matches, innings, runs} · bowling.{wickets}
  scaLiveStats.forEach((stats) => {
    const name = stats?.playerName || '';
    push('SCA', `${name}||sca-live`,
      stats?.batting?.matches,
      stats?.batting?.innings,
      stats?.batting?.runs,
      stats?.bowling?.wickets,
    );
  });

  const totalRuns    = contributions.reduce((s, r) => s + r.runs,    0);
  const totalMatches = contributions.reduce((s, r) => s + r.matches, 0);
  const totalInnings = contributions.reduce((s, r) => s + r.innings, 0);
  const totalWickets = contributions.reduce((s, r) => s + r.wickets, 0);
  const leaguesContributed = [...new Set(contributions.map((r) => r.league))];

  return { totalRuns, totalMatches, totalInnings, totalWickets, leaguesContributed };
}

/**
 * Full aggregation across all leagues.
 *
 * staticResults  — searchResults.results keyed by platform name
 * scaLiveStats   — array of normalised SCA live player stats objects
 *
 * Returns { batting, bowling, leaguesContributed }
 */
export function aggregateAllStats(staticResults, scaLiveStats = []) {
  const batAcc = emptyBat();
  const bwlAcc = emptyBwl();
  const leaguesContributed = [];

  const ypl = staticResults?.['YPL'];
  if (ypl && !ypl.noResults && ypl.players?.length > 0) {
    ypl.players.forEach((p) => extractFromYPL(p, batAcc, bwlAcc));
    leaguesContributed.push('YPL');
  }

  const bpl = staticResults?.['BPL'];
  if (bpl && !bpl.noResults && bpl.players?.length > 0) {
    bpl.players.forEach((p) => extractFromBPL(p, batAcc, bwlAcc));
    leaguesContributed.push('BPL');
  }

  const sgia = staticResults?.['SG IA'];
  if (sgia && !sgia.noResults && sgia.players?.length > 0) {
    sgia.players.forEach((p) => extractFromSGIA(p, batAcc, bwlAcc));
    leaguesContributed.push('SG IA');
  }

  const sca = staticResults?.['SCA'];
  if (sca && !sca.noResults && sca.players?.length > 0) {
    sca.players
      .filter((p) => p.source === 'sca-corporate')
      .forEach((p) => extractFromSCACorp(p, batAcc, bwlAcc));
    if (sca.players.some((p) => p.source === 'sca-corporate')) {
      leaguesContributed.push('SCA Corp');
    }
  }

  if (scaLiveStats.length > 0) {
    scaLiveStats.forEach((stats) => extractFromSCALive(stats, batAcc, bwlAcc));
    leaguesContributed.push('SCA');
  }

  return {
    batting: finaliseBat(batAcc),
    bowling: finaliseBwl(bwlAcc),
    leaguesContributed,
  };
}

/**
 * Merge live SCA stats (fetched asynchronously in the card) into an existing
 * aggregated result so the panel can update once live data arrives.
 */
export function mergeWithLiveStats(existingAgg, liveStats) {
  const batAcc = emptyBat();
  const bwlAcc = emptyBwl();

  // Re-seed from existing aggregated counts
  if (existingAgg.batting) {
    const b = existingAgg.batting;
    Object.assign(batAcc, {
      matches: b.matches ?? 0, innings: b.innings ?? 0, notOuts: b.notOuts ?? 0,
      runs: b.runs ?? 0, balls: b.balls ?? 0,
      fours: b.fours ?? 0, sixes: b.sixes ?? 0,
      fifties: b.fifties ?? 0, hundreds: b.hundreds ?? 0, ducks: b.ducks ?? 0,
      highestScore: b.highestScore ?? null,
      _hasAny: true,
    });
  }
  if (existingAgg.bowling) {
    const bwl = existingAgg.bowling;
    Object.assign(bwlAcc, {
      matches: bwl.matches ?? 0, innings: bwl.innings ?? 0,
      balls: bwl.balls ?? 0, runs: bwl.runs ?? 0,
      wickets: bwl.wickets ?? 0, maidens: bwl.maidens ?? 0,
      bestBowling: bwl.bestBowling ?? null,
      _hasAny: true,
    });
  }

  extractFromSCALive(liveStats, batAcc, bwlAcc);

  return {
    batting: finaliseBat(batAcc),
    bowling: finaliseBwl(bwlAcc),
    leaguesContributed: [
      ...existingAgg.leaguesContributed,
      ...(!existingAgg.leaguesContributed.includes('SCA') ? ['SCA'] : []),
    ],
  };
}
