'use strict';

const { parsePlayerProfile } = require('../sca.profile');

// ── Fixture HTML (mimics a CricClubs player profile page) ────────────────────

const FULL_PROFILE_HTML = `
<!DOCTYPE html>
<html>
<body>
<div class="holder point">
  <div class="container">
    <h3>Kintul Mistry</h3>
    <h4>IIT ALUMNI</h4>

    <div class="border-heading"><h5>Batting</h5></div>
    <table class="table table-striped">
      <thead>
        <tr>
          <th>M</th><th>Inn</th><th>NO</th><th>Runs</th><th>HS</th>
          <th>Avg</th><th>SR</th><th>100s</th><th>50s</th><th>4s</th><th>6s</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>24</td><td>22</td><td>3</td><td>456</td><td>89</td>
          <td>24.0</td><td>78.3</td><td>0</td><td>3</td><td>48</td><td>12</td>
        </tr>
      </tbody>
    </table>

    <div class="border-heading"><h5>Bowling</h5></div>
    <table class="table table-striped">
      <thead>
        <tr>
          <th>M</th><th>O</th><th>Mdns</th><th>R</th><th>Wkt</th>
          <th>Avg</th><th>Eco</th><th>Best</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>24</td><td>42</td><td>4</td><td>280</td><td>15</td>
          <td>18.67</td><td>6.67</td><td>3/22</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
</body>
</html>
`;

// Profile where stats are identified by headers alone (no "Batting"/"Bowling" headings)
const HEADERLESS_SECTIONS_HTML = `
<!DOCTYPE html>
<html>
<body>
  <h3>Another Player</h3>
  <table>
    <thead>
      <tr><th>M</th><th>Inn</th><th>NO</th><th>Runs</th><th>HS</th><th>Avg</th><th>SR</th></tr>
    </thead>
    <tbody>
      <tr><td>10</td><td>9</td><td>1</td><td>200</td><td>55</td><td>25.0</td><td>90.0</td></tr>
    </tbody>
  </table>
  <table>
    <thead>
      <tr><th>M</th><th>O</th><th>Wkts</th><th>Avg</th><th>Eco</th><th>Best</th></tr>
    </thead>
    <tbody>
      <tr><td>10</td><td>18</td><td>8</td><td>12.5</td><td>5.56</td><td>3/15</td></tr>
    </tbody>
  </table>
</body>
</html>
`;

// Duplicate "M" header (Matches + Maidens in bowling table)
const DUPLICATE_M_HTML = `
<html>
<body>
  <div class="border-heading"><h5>Bowling</h5></div>
  <table>
    <thead>
      <tr><th>M</th><th>O</th><th>M</th><th>R</th><th>Wkt</th><th>Avg</th><th>Eco</th></tr>
    </thead>
    <tbody>
      <tr><td>20</td><td>30</td><td>5</td><td>200</td><td>12</td><td>16.7</td><td>6.67</td></tr>
    </tbody>
  </table>
</body>
</html>
`;

const EMPTY_HTML = '<html><body></body></html>';
const NO_STATS_HTML = '<html><body><h3>Ghost Player</h3><h4>Unknown Club</h4></body></html>';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('parsePlayerProfile — player identity', () => {
  test('extracts player name from h3', () => {
    const r = parsePlayerProfile(FULL_PROFILE_HTML, '1077340');
    expect(r.playerName).toBe('Kintul Mistry');
  });

  test('extracts team from h4', () => {
    const r = parsePlayerProfile(FULL_PROFILE_HTML, '1077340');
    expect(r.teamName).toBe('IIT ALUMNI');
  });

  test('always sets profileFetched to true', () => {
    expect(parsePlayerProfile(EMPTY_HTML, '999').profileFetched).toBe(true);
  });

  test('returns null name on empty page', () => {
    expect(parsePlayerProfile(EMPTY_HTML, '999').playerName).toBeNull();
  });
});

describe('parsePlayerProfile — batting stats (Strategy 1: section headings)', () => {
  let batting;
  beforeAll(() => {
    batting = parsePlayerProfile(FULL_PROFILE_HTML, '1077340').batting;
  });

  test('extracts match count', () => expect(batting.matches).toBe(24));
  test('extracts innings', () => expect(batting.innings).toBe(22));
  test('extracts not outs', () => expect(batting.notOuts).toBe(3));
  test('extracts runs', () => expect(batting.runs).toBe(456));
  test('extracts highest score', () => expect(batting.highestScore).toBe('89'));
  test('extracts average', () => expect(batting.average).toBe(24.0));
  test('extracts strike rate', () => expect(batting.strikeRate).toBe(78.3));
  test('extracts centuries', () => expect(batting.centuries).toBe(0));
  test('extracts fifties', () => expect(batting.fifties).toBe(3));
  test('extracts fours', () => expect(batting.fours).toBe(48));
  test('extracts sixes', () => expect(batting.sixes).toBe(12));
});

describe('parsePlayerProfile — bowling stats (Strategy 1: section headings)', () => {
  let bowling;
  beforeAll(() => {
    bowling = parsePlayerProfile(FULL_PROFILE_HTML, '1077340').bowling;
  });

  test('extracts match count', () => expect(bowling.matches).toBe(24));
  test('extracts overs', () => expect(bowling.overs).toBe(42));
  test('extracts maidens', () => expect(bowling.maidens).toBe(4));
  test('extracts runs', () => expect(bowling.runs).toBe(280));
  test('extracts wickets', () => expect(bowling.wickets).toBe(15));
  test('extracts average', () => expect(bowling.average).toBe(18.67));
  test('extracts economy', () => expect(bowling.economy).toBe(6.67));
  test('extracts best bowling', () => expect(bowling.bestBowling).toBe('3/22'));
});

describe('parsePlayerProfile — Strategy 2: header-based detection (no section headings)', () => {
  test('detects batting table by column names', () => {
    const r = parsePlayerProfile(HEADERLESS_SECTIONS_HTML, '999');
    expect(r.batting).not.toBeNull();
    expect(r.batting.runs).toBe(200);
    expect(r.batting.average).toBe(25.0);
  });

  test('detects bowling table by column names', () => {
    const r = parsePlayerProfile(HEADERLESS_SECTIONS_HTML, '999');
    expect(r.bowling).not.toBeNull();
    expect(r.bowling.wickets).toBe(8);
    expect(r.bowling.bestBowling).toBe('3/15');
  });
});

describe('parsePlayerProfile — duplicate M header in bowling', () => {
  test('correctly maps maidens when M appears twice', () => {
    const r = parsePlayerProfile(DUPLICATE_M_HTML, '999');
    expect(r.bowling).not.toBeNull();
    expect(r.bowling.matches).toBe(20);
    expect(r.bowling.maidens).toBe(5);
    expect(r.bowling.wickets).toBe(12);
  });
});

describe('parsePlayerProfile — graceful fallback', () => {
  test('returns null batting when no stats table present', () => {
    const r = parsePlayerProfile(NO_STATS_HTML, '999');
    expect(r.batting).toBeNull();
  });

  test('returns null bowling when no stats table present', () => {
    const r = parsePlayerProfile(NO_STATS_HTML, '999').bowling;
    expect(r).toBeNull();
  });

  test('still extracts name even with no stats', () => {
    const r = parsePlayerProfile(NO_STATS_HTML, '999');
    expect(r.playerName).toBe('Ghost Player');
    expect(r.teamName).toBe('Unknown Club');
  });
});

// ── Aggregation / deduplication helpers ──────────────────────────────────────

describe('player deduplication logic', () => {
  function deduplicate(players) {
    const seen = new Set();
    return players.filter((p) => {
      if (!p.id || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }

  test('removes duplicate player IDs', () => {
    const players = [
      { id: '123', name: 'Alpha' },
      { id: '456', name: 'Beta' },
      { id: '123', name: 'Alpha' }, // duplicate
    ];
    expect(deduplicate(players)).toHaveLength(2);
  });

  test('keeps unique players intact', () => {
    const players = [
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
      { id: '3', name: 'C' },
    ];
    expect(deduplicate(players)).toHaveLength(3);
  });

  test('handles missing IDs by skipping them', () => {
    const players = [
      { id: '1', name: 'A' },
      { id: null, name: 'B' }, // no ID — excluded
      { id: '', name: 'C' },   // empty ID — excluded
    ];
    expect(deduplicate(players)).toHaveLength(1);
  });
});

describe('stats aggregation across sources', () => {
  function aggregateBatting(sources) {
    const valid = sources.filter((s) => s && s.batting && s.batting.runs !== null);
    if (valid.length === 0) return null;

    return {
      matches: valid.reduce((s, p) => s + (p.batting.matches || 0), 0),
      runs: valid.reduce((s, p) => s + (p.batting.runs || 0), 0),
      innings: valid.reduce((s, p) => s + (p.batting.innings || 0), 0),
    };
  }

  test('sums runs across multiple sources', () => {
    const sources = [
      { batting: { matches: 10, runs: 200, innings: 9 } },
      { batting: { matches: 14, runs: 256, innings: 13 } },
    ];
    const agg = aggregateBatting(sources);
    expect(agg.runs).toBe(456);
    expect(agg.matches).toBe(24);
  });

  test('returns null when no sources have batting data', () => {
    expect(aggregateBatting([{ batting: null }])).toBeNull();
    expect(aggregateBatting([])).toBeNull();
  });
});
