/**
 * @module sportygo.client
 * @description Playwright browser lifecycle for Sportygo scraping.
 *
 * Browser-path strategy
 * ─────────────────────
 * On Render (and similar PaaS), the build container and the runtime container
 * have different $HOME values, so browsers installed to $HOME/.cache during
 * build are MISSING at runtime.  We fix this by pointing PLAYWRIGHT_BROWSERS_PATH
 * at a directory INSIDE the project root (cricsearch-backend/.playwright-browsers/)
 * which IS part of the deployed image.  The path is derived from __dirname so it
 * works on any machine without hard-coded paths.
 *
 * If the binary is still absent at runtime (e.g. first boot after a fresh deploy
 * that did not have the postinstall change), ensureBrowser() installs it on-demand
 * before the first launch.
 */

'use strict';

const path = require('path');
const fs   = require('fs');

// ── 1. Pin browser storage to the project root ────────────────────────────────
// __dirname = <repo>/cricsearch-backend/src/services/sportygo
// four levels up = <repo>/cricsearch-backend  (the npm package root / Render rootDir)
const PROJECT_ROOT  = path.resolve(__dirname, '../../../../');
const BROWSERS_DIR  = path.join(PROJECT_ROOT, '.playwright-browsers');

// Set BEFORE requiring playwright so it picks up the correct path immediately.
// If the env var is already set (e.g. PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH override),
// we honour it and skip our default.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = BROWSERS_DIR;
}

const { chromium } = require('playwright');

// ── 2. Auto-install if the binary is absent ───────────────────────────────────
let _installPromise = null;

async function ensureBrowser() {
  let exePath;
  try {
    exePath = chromium.executablePath();
  } catch (e) {
    exePath = null;
  }

  if (exePath && fs.existsSync(exePath)) return; // already present

  // Serialise concurrent install attempts into one promise
  if (_installPromise) return _installPromise;

  _installPromise = (async () => {
    console.log(
      '[Sportygo:client] Chromium not found%s — installing (one-time, ~2 min)…',
      exePath ? ` at ${exePath}` : ''
    );
    const { execSync } = require('child_process');
    execSync('npx playwright install chromium', {
      stdio:   'inherit',
      timeout: 300_000, // 5 minutes
      env:     { ...process.env }, // inherits PLAYWRIGHT_BROWSERS_PATH
    });
    console.log('[Sportygo:client] Chromium installed at', chromium.executablePath());
  })();

  return _installPromise;
}

// ── 3. Singleton browser instance ─────────────────────────────────────────────
let _browser = null;

function debug(...args) {
  if (process.env.DEBUG_SCRAPER === 'true') console.log('[Sportygo:client]', ...args);
}

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;

  await ensureBrowser();

  const opts = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  };

  // Allow explicit override (e.g. for local dev pointing at system Chrome)
  const exe = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (exe) {
    opts.executablePath = exe;
    debug('Using explicit Chromium at', exe);
  }

  debug('Launching browser (browsers dir:', process.env.PLAYWRIGHT_BROWSERS_PATH, ')');
  _browser = await chromium.launch(opts);
  debug('Browser ready');
  return _browser;
}

// ── 4. Page helper ────────────────────────────────────────────────────────────

/**
 * Run `fn(page)` inside an isolated browser context.
 * The context (cookies/storage) is destroyed after fn resolves or rejects.
 * @template T
 * @param {(page: import('playwright').Page) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withPage(fn) {
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();
  try {
    return await fn(page);
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ── 5. Cleanup ────────────────────────────────────────────────────────────────
async function closeBrowser() {
  if (_browser) {
    try { await _browser.close(); } catch (_) {}
    _browser = null;
    debug('Browser closed');
  }
}

['exit', 'SIGTERM', 'SIGINT'].forEach((sig) => {
  process.on(sig, () => closeBrowser().catch(() => {}));
});

module.exports = { withPage, closeBrowser };
