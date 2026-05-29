/**
 * @module sportygo.client
 * @description Playwright browser lifecycle for Sportygo scraping.
 * Maintains a singleton Chromium instance reused across requests.
 * Configure PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH for custom installs.
 */

const { chromium } = require('playwright');

let _browser = null;

function debug(...args) {
  if (process.env.DEBUG_SCRAPER === 'true') console.log('[Sportygo:client]', ...args);
}

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;

  const opts = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  };

  const exe = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (exe) {
    opts.executablePath = exe;
    debug('Using Chromium at', exe);
  }

  debug('Launching browser');
  _browser = await chromium.launch(opts);
  debug('Browser ready');
  return _browser;
}

/**
 * Run `fn(page)` inside an isolated browser context.
 * The context (and its cookies/storage) is destroyed after fn resolves or rejects.
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
