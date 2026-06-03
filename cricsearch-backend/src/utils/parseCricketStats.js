'use strict';

/**
 * Parse a numeric cricket stat value; returns null for blanks/dashes.
 * @param {*} val
 * @returns {number|null}
 */
function parseNumber(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (s === '' || s === '-' || s === 'N/A' || s === 'n/a') return null;
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : n;
}

/**
 * Parse highest score (e.g. "67*" → { display: "67*", numeric: 67, isNotOut: true }).
 * @param {*} val
 * @returns {{ display: string, numeric: number|null, isNotOut: boolean }}
 */
function parseHighestScore(val) {
  if (!val || String(val).trim() === '-' || String(val).trim() === '') {
    return { display: '-', numeric: null, isNotOut: false };
  }
  const s = String(val).trim();
  const isNotOut = s.endsWith('*');
  const numeric = parseFloat(s.replace(/[^0-9.]/g, ''));
  return { display: s, numeric: isNaN(numeric) ? null : numeric, isNotOut };
}

/**
 * Calculate batting average. Returns null when dismissals = 0 (display as '-').
 * @param {number|null} runs
 * @param {number|null} innings
 * @param {number|null} notOuts
 * @returns {number|null}
 */
function calcAverage(runs, innings, notOuts) {
  const dismissals = (innings || 0) - (notOuts || 0);
  if (dismissals <= 0) return null;
  return Math.round(((runs || 0) / dismissals) * 100) / 100;
}

/**
 * Calculate strike rate (runs / ballsFaced * 100). Returns null when ballsFaced = 0.
 * @param {number|null} runs
 * @param {number|null} ballsFaced
 * @returns {number|null}
 */
function calcStrikeRate(runs, ballsFaced) {
  if (!ballsFaced || ballsFaced <= 0) return null;
  return Math.round(((runs || 0) / ballsFaced) * 10000) / 100;
}

/**
 * Format a numeric stat for display: show '-' for null, 2 decimal places for floats.
 * @param {number|null} val
 * @param {boolean} [isFloat]
 * @returns {string}
 */
function formatStat(val, isFloat = false) {
  if (val === null || val === undefined) return '-';
  if (isFloat) return val.toFixed(2);
  return String(val);
}

module.exports = { parseNumber, parseHighestScore, calcAverage, calcStrikeRate, formatStat };
