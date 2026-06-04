'use strict';

const {
  parseNumber,
  parseHighestScore,
  calcAverage,
  calcStrikeRate,
} = require('../../../utils/parseCricketStats');

const { parseBattingHtml, DISPLAY_NAME } = require('../YPLBattingAdapter');
const { consolidatePlayers } = require('../../../services/battingAggregationService');

// ── parseCricketStats ─────────────────────────────────────────────────────────

describe('parseNumber', () => {
  test('parses integer string', () => expect(parseNumber('42')).toBe(42));
  test('parses float string', () => expect(parseNumber('39.17')).toBe(39.17));
  test('returns null for dash', () => expect(parseNumber('-')).toBeNull());
  test('returns null for empty string', () => expect(parseNumber('')).toBeNull());
  test('returns null for null', () => expect(parseNumber(null)).toBeNull());
  test('strips non-numeric chars', () => expect(parseNumber('39.1x')).toBe(39.1));
});

describe('parseHighestScore', () => {
  test('plain number', () => {
    const r = parseHighestScore('67');
    expect(r).toEqual({ display: '67', numeric: 67, isNotOut: false });
  });
  test('not-out with asterisk', () => {
    const r = parseHighestScore('67*');
    expect(r).toEqual({ display: '67*', numeric: 67, isNotOut: true });
    expect(r.display).toBe('67*');
  });
  test('dash returns nulls', () => {
    const r = parseHighestScore('-');
    expect(r.numeric).toBeNull();
    expect(r.isNotOut).toBe(false);
  });
  test('empty string', () => {
    const r = parseHighestScore('');
    expect(r.display).toBe('-');
    expect(r.numeric).toBeNull();
  });
});

describe('calcAverage', () => {
  test('normal dismissals', () => expect(calcAverage(312, 8, 1)).toBe(44.57));
  test('zero dismissals returns null (display as -)', () => {
    expect(calcAverage(50, 3, 3)).toBeNull();
  });
  test('no innings returns null', () => {
    expect(calcAverage(0, 0, 0)).toBeNull();
  });
  test('rounds to 2 decimal places', () => {
    expect(calcAverage(100, 7, 0)).toBe(14.29);
  });
});

describe('calcStrikeRate', () => {
  test('normal strike rate', () => expect(calcStrikeRate(198, 155)).toBe(127.74));
  test('zero balls returns null', () => expect(calcStrikeRate(50, 0)).toBeNull());
  test('null balls returns null', () => expect(calcStrikeRate(50, null)).toBeNull());
  test('rounds to 2 decimal places', () => {
    expect(calcStrikeRate(100, 90)).toBe(111.11);
  });
});

// ── parseBattingHtml ──────────────────────────────────────────────────────────

describe('parseBattingHtml', () => {
  const SAMPLE_HTML = `
    <html><body>
    <table>
      <thead>
        <tr>
          <th>#</th><th>Player</th><th>Mat</th><th>Inn</th><th>NO</th>
          <th>Runs</th><th>HS</th><th>Ave</th><th>BF</th><th>SR</th>
          <th>100s</th><th>50s</th><th>4s</th><th>6s</th><th>0s</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td><a href="/sportygo/viewPlayer.do?playerId=111&clubId=4263">Akshay Thakre</a></td>
          <td>8</td><td>7</td><td>1</td><td>235</td><td>58</td>
          <td>39.17</td><td>198</td><td>118.69</td>
          <td>0</td><td>2</td><td>22</td><td>8</td><td>0</td>
        </tr>
        <tr>
          <td>2</td>
          <td><a href="/sportygo/viewPlayer.do?playerId=222&clubId=4263">Priya Nair</a></td>
          <td>7</td><td>6</td><td>2</td><td>198</td><td>67*</td>
          <td>49.50</td><td>155</td><td>127.74</td>
          <td>0</td><td>2</td><td>18</td><td>6</td><td>0</td>
        </tr>
      </tbody>
    </table>
    </body></html>
  `;

  let players;
  beforeAll(() => {
    players = parseBattingHtml(SAMPLE_HTML, '211', '4263', 'https://cricclubs.com/sportygo/teamBatting.do?teamId=211&clubId=4263');
  });

  test('parses correct number of players', () => expect(players).toHaveLength(2));

  test('extracts player name from link text', () => {
    expect(players[0].playerName).toBe('Akshay Thakre');
  });

  test('parses numeric stats correctly', () => {
    expect(players[0].matches).toBe(8);
    expect(players[0].innings).toBe(7);
    expect(players[0].notOuts).toBe(1);
    expect(players[0].runs).toBe(235);
  });

  test('preserves not-out asterisk in highestScore display', () => {
    expect(players[1].highestScore).toBe('67*');
    expect(players[1].highestScoreNumeric).toBe(67);
  });

  test('sets correct teamId and clubId', () => {
    expect(players[0].teamId).toBe('211');
    expect(players[0].clubId).toBe('4263');
  });

  test('sets sourceName to sportygo-ypl', () => {
    expect(players[0].sourceName).toBe('sportygo-ypl');
  });
});

describe('parseBattingHtml — no batting table', () => {
  test('returns empty array when no matching table found', () => {
    const html = '<html><body><p>No data</p></body></html>';
    const result = parseBattingHtml(html, '211', '4263', 'http://example.com');
    expect(result).toEqual([]);
  });
});

// ── consolidatePlayers ────────────────────────────────────────────────────────

describe('consolidatePlayers', () => {
  const team211 = [
    { playerName: 'Rajesh Kumar', matches: 8, innings: 8, notOuts: 0, runs: 142, ballsFaced: 156,
      highestScore: '34', highestScoreNumeric: 34, hundreds: 0, fifties: 0, fours: 11, sixes: 5, ducks: 1, teamId: '211' },
    { playerName: 'Unique Player', matches: 5, innings: 5, notOuts: 0, runs: 88, ballsFaced: 90,
      highestScore: '30', highestScoreNumeric: 30, hundreds: 0, fifties: 0, fours: 8, sixes: 2, ducks: 0, teamId: '211' },
  ];

  const team120 = [
    { playerName: 'Rajesh Kumar', matches: 6, innings: 5, notOuts: 0, runs: 89, ballsFaced: 96,
      highestScore: '36', highestScoreNumeric: 36, hundreds: 0, fifties: 0, fours: 8, sixes: 3, ducks: 0, teamId: '120' },
    { playerName: 'Another Player', matches: 4, innings: 4, notOuts: 1, runs: 60, ballsFaced: 55,
      highestScore: '25', highestScoreNumeric: 25, hundreds: 0, fifties: 0, fours: 5, sixes: 1, ducks: 1, teamId: '120' },
  ];

  let consolidated;
  beforeAll(() => { consolidated = consolidatePlayers([team211, team120]); });

  test('deduplicates player appearing in both teams', () => {
    const rajesh = consolidated.filter((p) => p.playerName === 'Rajesh Kumar');
    expect(rajesh).toHaveLength(1);
  });

  test('sums runs across teams', () => {
    const rajesh = consolidated.find((p) => p.playerName === 'Rajesh Kumar');
    expect(rajesh.runs).toBe(142 + 89);
  });

  test('sums matches across teams', () => {
    const rajesh = consolidated.find((p) => p.playerName === 'Rajesh Kumar');
    expect(rajesh.matches).toBe(8 + 6);
  });

  test('takes max highest score', () => {
    const rajesh = consolidated.find((p) => p.playerName === 'Rajesh Kumar');
    expect(rajesh.highestScoreNumeric).toBe(36); // 36 > 34
  });

  test('recalculates average correctly', () => {
    const rajesh = consolidated.find((p) => p.playerName === 'Rajesh Kumar');
    // runs=231, dismissals=13-0=13 → 231/13 = 17.77
    expect(rajesh.average).toBe(17.77);
  });

  test('recalculates strike rate correctly', () => {
    const rajesh = consolidated.find((p) => p.playerName === 'Rajesh Kumar');
    // 231/252*100 = 91.67
    expect(rajesh.strikeRate).toBe(91.67);
  });

  test('records teams array for merged player', () => {
    const rajesh = consolidated.find((p) => p.playerName === 'Rajesh Kumar');
    expect(rajesh.teams).toContain('211');
    expect(rajesh.teams).toContain('120');
  });

  test('unique players are not duplicated', () => {
    expect(consolidated.find((p) => p.playerName === 'Unique Player')).toBeDefined();
    expect(consolidated.find((p) => p.playerName === 'Another Player')).toBeDefined();
  });

  test('sorts by runs descending', () => {
    const runs = consolidated.map((p) => p.runs);
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i - 1]).toBeGreaterThanOrEqual(runs[i]);
    }
  });

  test('handles case-insensitive name matching', () => {
    const upper = [{ playerName: 'ALICE', matches: 5, innings: 5, notOuts: 0, runs: 50, ballsFaced: 40,
      highestScore: '20', highestScoreNumeric: 20, hundreds: 0, fifties: 0, fours: 4, sixes: 1, ducks: 0, teamId: '211' }];
    const lower = [{ playerName: 'alice', matches: 3, innings: 3, notOuts: 0, runs: 30, ballsFaced: 25,
      highestScore: '15', highestScoreNumeric: 15, hundreds: 0, fifties: 0, fours: 2, sixes: 0, ducks: 1, teamId: '120' }];
    const result = consolidatePlayers([upper, lower]);
    expect(result).toHaveLength(1);
    expect(result[0].runs).toBe(80);
  });
});

// ── Blocked-response handling ─────────────────────────────────────────────────

describe('YPL display naming', () => {
  test('DISPLAY_NAME is YPL (not CricClubs)', () => {
    expect(DISPLAY_NAME).toBe('YPL');
    expect(DISPLAY_NAME).not.toMatch(/cricclubs/i);
  });
});
