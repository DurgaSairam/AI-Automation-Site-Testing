/**
 * FANTASY WORLD TOYS — AUTOMATED TEST SUITE v3
 * Changes: 1000-page deep crawl, sitemap seeding, LIGHT theme report
 *
 * npm test               → staging
 * npm run test:prod      → production
 * npm run report         → open latest report
 */
const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');
const http  = require('http');
const https = require('https');

const CONFIG = {
  baseUrl            : process.env.TEST_URL || 'https://mcstaging.fantasyworldtoys.com',
  timeout            : 60000,
  slowPageThreshold  : 8000,
  fastPageThreshold  : 3000,
  maxCrawlPages      : 1000,
  screenshotsDir     : 'screenshots',
  reportDir          : 'reports',
  delayBetweenPages  : 150,
  useSitemap         : true,
  skipPatterns : [
    '/stores/store/redirect','/checkout/cart/add','uenc=','___store=',
    'SID=','/review/product/post','/wishlist/index/add','/compare/product/add',
    '/catalog/product_compare','/sendfriend/','/newsletter/subscriber',
    'form_key=','___from_store',
  ],
  ignoredErrors : [
    'initialised','jQueryUI','ScrollReveal','sitekey','CORB','deprecated',
    'fbevents','gtag','clarity','cookieconsent','tawk','hotjar','Moe Triggered','fallback',
  ],
};

const run = {
  startedAt       : new Date(),
  environment     : CONFIG.baseUrl,
  healthPages     : [],
  functionalTests : [],
  summary         : { total:0, passed:0, warnings:0, failed:0 },
  funcSummary     : { total:0, passed:0, failed:0 },
};

function isCriticalError(msg) {
  const low = msg.toLowerCase();
  return !CONFIG.ignoredErrors.some(kw => low.includes(kw.toLowerCase()));
}
function classify(loadTime, critErrors, statusCode) {
  if (statusCode >= 400)                   return 'failed';
  if (critErrors > 0)                      return 'failed';
  if (loadTime > CONFIG.slowPageThreshold) return 'warning';
  if (loadTime > CONFIG.fastPageThreshold) return 'warning';
  return 'passed';
}
function normaliseUrl(raw) {
  try {
    const u = new URL(raw);
    u.hash = '';
    ['___store','SID','uenc','form_key','___from_store'].forEach(p => u.searchParams.delete(p));
    let h = u.href;
    if (h.endsWith('/') && h !== CONFIG.baseUrl + '/') h = h.slice(0,-1);
    return h;
  } catch { return raw; }
}
function shouldSkip(url) {
  return CONFIG.skipPatterns.some(p => url.includes(p)) ||
    /\.(jpg|jpeg|png|gif|pdf|zip|css|js|xml|json|svg|woff|ico|ttf|eot|mp4|webp)$/i.test(url);
}
async function safeScreenshot(page, name) {
  try {
    fs.mkdirSync(CONFIG.screenshotsDir, { recursive: true });
    const file = path.join(CONFIG.screenshotsDir, `${name.replace(/[^\w-]/g,'_')}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return file;
  } catch { return null; }
}
async function newPage(browser) {
  const ctx = await browser.newContext({
    viewport  : { width: 1440, height: 900 },
    userAgent : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  });
  return ctx.newPage();
}

// ─── SITEMAP SEEDER ───────────────────────────────────────────
async function fetchSitemapUrls() {
  const urls = new Set();
  const fetchRaw = (url) => new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    let body = '';
    const req = lib.get(url, { timeout: 15000 }, res => {
      res.on('data', d => body += d);
      res.on('end', () => resolve(body));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });

  try {
    const sitemapUrl = CONFIG.baseUrl + '/sitemap.xml';
    console.log(`  🗺  Fetching sitemap: ${sitemapUrl}`);
    const xml = await fetchRaw(sitemapUrl);

    // Handle sitemap index
    const sitemapRefs = [...xml.matchAll(/<loc>(.*?)<\/loc>/gs)]
      .map(m => m[1].trim())
      .filter(u => u.includes('sitemap') && u.endsWith('.xml'));

    if (sitemapRefs.length > 0) {
      for (const ref of sitemapRefs.slice(0, 15)) {
        const sub = await fetchRaw(ref);
        [...sub.matchAll(/<loc>(.*?)<\/loc>/gs)]
          .map(m => m[1].trim())
          .filter(u => u.startsWith(CONFIG.baseUrl) && !shouldSkip(u))
          .forEach(u => urls.add(normaliseUrl(u)));
      }
    } else {
      [...xml.matchAll(/<loc>(.*?)<\/loc>/gs)]
        .map(m => m[1].trim())
        .filter(u => u.startsWith(CONFIG.baseUrl) && !shouldSkip(u))
        .forEach(u => urls.add(normaliseUrl(u)));
    }
    console.log(`  🗺  Sitemap seeded ${urls.size} URLs`);
  } catch(e) {
    console.log(`  ⚠️  Sitemap fetch failed: ${e.message}`);
  }
  return [...urls];
}

// ─── PHASE 1: DEEP HEALTH CRAWL ───────────────────────────────
async function runHealthCrawl(browser) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 1 — DEEP PAGE HEALTH CRAWL (up to 1000 pages)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const visited = new Set();
  const sitemapUrls = CONFIG.useSitemap ? await fetchSitemapUrls() : [];
  const queue = [CONFIG.baseUrl, ...sitemapUrls];
  const page = await newPage(browser);

  while (queue.length && visited.size < CONFIG.maxCrawlPages) {
    const rawUrl = queue.shift();
    const url    = normaliseUrl(rawUrl);

    if (visited.has(url)) continue;
    if (shouldSkip(url))  continue;
    try {
      const u = new URL(url);
      const b = new URL(CONFIG.baseUrl);
      if (u.hostname !== b.hostname) continue;
    } catch { continue; }

    visited.add(url);

    const result = {
      url, status:'unknown', statusCode:null, loadTime:null, fcp:null,
      errors:[], allErrors:[], criticalErrorCount:0, accessibility:{},
    };

    const errHandler = e => result.allErrors.push(e.message);
    page.on('pageerror', errHandler);

    try {
      const t0   = Date.now();
      const resp = await page.goto(url, { waitUntil:'domcontentloaded', timeout:CONFIG.timeout });
      result.loadTime   = Date.now() - t0;
      result.statusCode = resp ? resp.status() : 0;

      result.fcp = await page.evaluate(() => {
        const e = performance.getEntriesByType('paint').find(p => p.name==='first-contentful-paint');
        return e ? Math.round(e.startTime) : null;
      }).catch(() => null);

      result.accessibility = await page.evaluate(() => ({
        hasH1           : !!document.querySelector('h1'),
        hasTitle        : document.title.trim().length > 0,
        hasMetaDesc     : !!document.querySelector('meta[name="description"]'),
        imagesWithoutAlt: document.querySelectorAll('img:not([alt])').length,
      })).catch(() => ({}));

      const links = await page.$$eval('a[href]', (as, base) =>
        as.map(a => { try { return new URL(a.href, base).href; } catch { return null; } }).filter(Boolean),
        CONFIG.baseUrl
      ).catch(() => []);

      for (const link of links) {
        const nl = normaliseUrl(link);
        if (!visited.has(nl) && !queue.includes(nl) && !shouldSkip(nl)) {
          try {
            const u = new URL(nl), b = new URL(CONFIG.baseUrl);
            if (u.hostname === b.hostname) queue.push(nl);
          } catch { /**/ }
        }
      }

      result.criticalErrorCount = result.allErrors.filter(isCriticalError).length;
      result.errors  = result.allErrors.filter(isCriticalError);
      result.status  = classify(result.loadTime, result.criticalErrorCount, result.statusCode);

    } catch(err) {
      result.status             = 'failed';
      result.errors.push(err.message);
      result.criticalErrorCount = 1;
    } finally {
      page.off('pageerror', errHandler);
    }

    run.healthPages.push(result);
    run.summary.total++;
    if      (result.status === 'passed')  run.summary.passed++;
    else if (result.status === 'warning') run.summary.warnings++;
    else                                  run.summary.failed++;

    const icon  = result.status==='passed' ? '✅' : result.status==='warning' ? '⚠️ ' : '❌';
    const label = url.replace(CONFIG.baseUrl,'') || '/';
    console.log(`${icon} [${visited.size}/${queue.length+visited.size}] ${label.substring(0,65).padEnd(65)} ${result.statusCode??'---'} ${result.loadTime??0}ms`);
    await page.waitForTimeout(CONFIG.delayBetweenPages);
  }

  await page.context().close();
  console.log(`\n✔  Crawl complete — ${visited.size} pages visited`);
}

// PHASE 2 — FUNCTIONAL TESTS
// ─────────────────────────────────────────────
async function runFunctionalTests(browser) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 2 — FUNCTIONAL TESTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const tests = [
    // CORE
    { group: 'Core',     name: 'Homepage loads & key elements visible',   fn: testHomepage },
    { group: 'Core',     name: 'Main navigation links are clickable',      fn: testNavigation },
    { group: 'Core',     name: 'Category page displays products',          fn: testCategoryPage },
    { group: 'Core',     name: 'Product detail page loads correctly',      fn: testProductDetail },

    // SHOPPING
    { group: 'Shopping', name: 'Search returns results',                   fn: testSearch },
    { group: 'Shopping', name: 'Add to cart works',                        fn: testAddToCart },
    { group: 'Shopping', name: 'Cart page shows added items',              fn: testCartPage },
    { group: 'Shopping', name: 'Mini-cart updates after add',              fn: testMiniCart },

    // ACCOUNT
    { group: 'Account',  name: 'Login page loads with form fields',        fn: testLoginPage },
    { group: 'Account',  name: 'Registration page loads correctly',        fn: testRegistrationPage },
    { group: 'Account',  name: 'Wishlist page accessible',                 fn: testWishlistPage },

    // CHECKOUT
    { group: 'Checkout', name: 'Checkout page loads (guest)',              fn: testCheckoutPage },
    { group: 'Checkout', name: 'Proceed to checkout button is present',    fn: testCheckoutButton },

    // REGRESSION
    { group: 'Regression', name: 'Mobile viewport renders correctly',      fn: testMobileView },
    { group: 'Regression', name: 'Language switcher is present',           fn: testLanguageSwitcher },
    { group: 'Regression', name: '404 page handled gracefully',            fn: test404Page },
    { group: 'Regression', name: 'Footer links are present',               fn: testFooter },
  ];

  for (const t of tests) {
    run.funcSummary.total++;
    const page = await newPage(browser);
    const startTime = Date.now();
    const record = {
      group: t.group,
      name: t.name,
      status: 'passed',
      duration: 0,
      steps: [],
      error: null,
      screenshot: null,
    };

    try {
      await t.fn(page, record);
      record.duration = Date.now() - startTime;
      const passed = record.steps.every(s => s.passed);
      record.status = passed ? 'passed' : 'failed';
    } catch (err) {
      record.status = 'failed';
      record.error = err.message;
      record.duration = Date.now() - startTime;
      record.screenshot = await safeScreenshot(page, `FAIL-${t.name.replace(/\s+/g, '-')}`);
    }

    run.funcSummary[record.status === 'passed' ? 'passed' : 'failed']++;
    run.functionalTests.push(record);

    const icon = record.status === 'passed' ? '✅' : '❌';
    console.log(`${icon} [${t.group}] ${t.name} (${record.duration}ms)`);
    record.steps.forEach(s => {
      console.log(`     ${s.passed ? '✓' : '✗'} ${s.name}${s.detail ? ' — ' + s.detail : ''}`);
    });

    await page.context().close();
  }
}

// ─────────────────────────────────────────────
// FUNCTIONAL TEST IMPLEMENTATIONS
// ─────────────────────────────────────────────

function step(record, name, passed, detail = '') {
  record.steps.push({ name, passed, detail });
}

async function testHomepage(page, record) {
  await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });

  const hasLogo = await page.locator('.logo, [class*="logo"] img, header img').count() > 0;
  step(record, 'Logo is visible', hasLogo);

  const hasSearch = await page.locator('input[name="q"], input[type="search"]').count() > 0;
  step(record, 'Search input is present', hasSearch);

  const hasNav = await page.locator('nav, .navigation, .nav').count() > 0;
  step(record, 'Navigation menu present', hasNav);

  const hasProducts = await page.locator('[class*="product"]').count() > 0;
  step(record, 'Products shown on homepage', hasProducts, `${await page.locator('[class*="product"]').count()} items`);

  const hasHeader = await page.locator('header').count() > 0;
  step(record, 'Header section present', hasHeader);
}

async function testNavigation(page, record) {
  await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });

  const navLinks = await page.locator('nav a, .navigation a').all();
  step(record, `Navigation links found`, navLinks.length > 0, `${navLinks.length} links`);

  // Try clicking first nav link
  if (navLinks.length > 0) {
    const href = await navLinks[0].getAttribute('href').catch(() => null);
    if (href && !href.startsWith('#')) {
      await navLinks[0].click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      const loaded = page.url().includes(CONFIG.baseUrl.replace('https://', '').replace('http://', ''));
      step(record, 'Navigation link navigates correctly', loaded, `Went to: ${page.url().replace(CONFIG.baseUrl, '') || '/'}`);
    }
  }
}

async function testCategoryPage(page, record) {
  // Try known category pages
  const categories = ['/boys-world', '/girls-world', '/early-years', '/lego-world', '/outdoor-sports'];
  let loaded = false;
  let productCount = 0;

  for (const cat of categories) {
    try {
      const resp = await page.goto(CONFIG.baseUrl + cat + '.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (resp && resp.status() === 200) {
        productCount = await page.locator('[class*="product-item"], [class*="product-card"]').count();
        step(record, `Category page loads (${cat})`, true, `HTTP 200`);
        loaded = true;
        break;
      }
    } catch { continue; }
  }

  if (!loaded) {
    step(record, 'Category page loads', false, 'No category page responded with 200');
    return;
  }

  step(record, 'Products listed on category', productCount > 0, `${productCount} product items found`);

  const hasFilters = await page.locator('[class*="filter"], [class*="sidebar"], .layered-navigation').count() > 0;
  step(record, 'Filters/sidebar present', hasFilters);

  const hasToolbar = await page.locator('[class*="toolbar"], .pager, [class*="sort"]').count() > 0;
  step(record, 'Sort/toolbar present', hasToolbar);
}

async function testProductDetail(page, record) {
  await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });

  // Click a product
  const productLink = page.locator('[class*="product"] a, .product-item a').first();
  const found = await productLink.count() > 0;
  step(record, 'Product link found on homepage', found);

  if (!found) return;

  await productLink.click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});

  const hasTitle = await page.locator('h1').count() > 0;
  step(record, 'Product title (H1) visible', hasTitle);

  const hasPrice = await page.locator('[class*="price"], .price').count() > 0;
  step(record, 'Price is displayed', hasPrice);

  const hasImages = await page.locator('[class*="gallery"] img, .product-media img').count() > 0;
  step(record, 'Product images present', hasImages);

  const hasAddToCart = await page.locator('button:has-text("Add to Cart"), button[id*="cart"], .tocart').count() > 0;
  step(record, '"Add to Cart" button visible', hasAddToCart);

  const hasDescription = await page.locator('[class*="description"], [class*="detail"]').count() > 0;
  step(record, 'Product description present', hasDescription);
}

async function testSearch(page, record) {
  await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });

  const input = page.locator('input[name="q"], input[type="search"]').first();
  const found = await input.count() > 0;
  step(record, 'Search input found', found);
  if (!found) return;

  await input.fill('LEGO');
  step(record, 'Typed "LEGO" in search box', true);

  await input.press('Enter');
  await page.waitForLoadState('domcontentloaded').catch(() => {});

  const resultCount = await page.locator('[class*="product-item"], [class*="product-card"]').count();
  step(record, 'Search results returned', resultCount > 0, `${resultCount} results for "LEGO"`);

  const hasResultHeading = await page.locator('h1, h2, [class*="result"]').count() > 0;
  step(record, 'Results heading displayed', hasResultHeading);
}

async function testAddToCart(page, record) {
  await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });

  const productLink = page.locator('[class*="product"] a, .product-item a').first();
  if (await productLink.count() === 0) {
    step(record, 'Find product to add', false, 'No products on homepage');
    return;
  }

  await productLink.click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  step(record, 'Navigate to product page', true);

  const addBtn = page.locator('button:has-text("Add to Cart"), button[id*="cart"], .tocart').first();
  const hasButton = await addBtn.count() > 0;
  step(record, '"Add to Cart" button present', hasButton);
  if (!hasButton) return;

  const isEnabled = await addBtn.isEnabled().catch(() => false);
  step(record, '"Add to Cart" button enabled', isEnabled);
  if (!isEnabled) return;

  await addBtn.click();
  step(record, 'Clicked "Add to Cart"', true);

  // Wait for cart to update
  await page.waitForTimeout(3000);

  // Check for success message or cart counter change
  const successMsg = await page.locator('.message-success, [class*="success"], [data-ui-id*="message"]').count() > 0;
  const cartQty = await page.locator('.counter-qty, [class*="cart"] .count, .header-cart-qty').count() > 0;

  step(record, 'Cart updated after add', successMsg || cartQty,
    successMsg ? 'Success message shown' : cartQty ? 'Cart counter updated' : 'No confirmation visible');
}

async function testCartPage(page, record) {
  await page.goto(CONFIG.baseUrl + '/checkout/cart', { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });

  const statusOk = await page.evaluate(() => document.readyState) === 'complete' ||
                   await page.evaluate(() => document.readyState) === 'interactive';

  const pageLoaded = !page.url().includes('404') && !page.url().includes('error');
  step(record, 'Cart page URL accessible', pageLoaded, page.url().replace(CONFIG.baseUrl, ''));

  const hasCartContent = await page.locator('[class*="cart"], .cart-container, #shopping-cart-table').count() > 0;
  step(record, 'Cart content area visible', hasCartContent);

  const hasCheckoutBtn = await page.locator('button:has-text("Proceed"), button:has-text("Checkout"), .checkout').count() > 0;
  step(record, 'Checkout button present', hasCheckoutBtn);

  const hasContinueShopping = await page.locator('a:has-text("Continue"), a:has-text("Shop")').count() > 0;
  step(record, 'Continue shopping link present', hasContinueShopping);
}

async function testMiniCart(page, record) {
  await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });

  const miniCart = page.locator('[class*="minicart"], [data-block="minicart"], .block-minicart, .action.showcart').first();
  const found = await miniCart.count() > 0;
  step(record, 'Mini-cart widget found', found);

  if (found) {
    try {
      await miniCart.click();
      await page.waitForTimeout(1500);
      const expanded = await page.locator('.block-minicart, [class*="minicart-items"]').count() > 0;
      step(record, 'Mini-cart opens on click', expanded);
    } catch {
      step(record, 'Mini-cart opens on click', false, 'Click failed');
    }
  }
}

async function testLoginPage(page, record) {
  await page.goto(CONFIG.baseUrl + '/customer/account/login', { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });

  const hasEmail = await page.locator('input[type="email"], input[name*="email"]').count() > 0;
  step(record, 'Email field present', hasEmail);

  const hasPassword = await page.locator('input[type="password"]').count() > 0;
  step(record, 'Password field present', hasPassword);

  const hasSubmit = await page.locator('button[type="submit"], .action.login').count() > 0;
  step(record, 'Login submit button present', hasSubmit);

  const hasForgot = await page.locator('a:has-text("Forgot"), [href*="forgotpassword"]').count() > 0;
  step(record, '"Forgot Password" link present', hasForgot);

  const hasCreate = await page.locator('a:has-text("Create"), a:has-text("Register"), [href*="create"]').count() > 0;
  step(record, '"Create Account" link present', hasCreate);
}

async function testRegistrationPage(page, record) {
  await page.goto(CONFIG.baseUrl + '/customer/account/create', { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });

  const hasFirst = await page.locator('input[name*="firstname"], input[id*="firstname"]').count() > 0;
  step(record, 'First name field present', hasFirst);

  const hasLast = await page.locator('input[name*="lastname"], input[id*="lastname"]').count() > 0;
  step(record, 'Last name field present', hasLast);

  const hasEmail = await page.locator('input[type="email"], input[name*="email"]').count() > 0;
  step(record, 'Email field present', hasEmail);

  const hasPassword = await page.locator('input[type="password"]').count() > 0;
  step(record, 'Password field present', hasPassword);

  const hasSubmit = await page.locator('button[type="submit"], .action.submit').count() > 0;
  step(record, 'Submit button present', hasSubmit);
}

async function testWishlistPage(page, record) {
  await page.goto(CONFIG.baseUrl + '/wishlist', { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });

  const redirectedToLogin = page.url().includes('login');
  const pageOk = page.url().includes('wishlist') || redirectedToLogin;
  step(record, 'Wishlist URL resolves', pageOk, redirectedToLogin ? 'Redirected to login (expected for guests)' : 'Wishlist page loaded');

  if (redirectedToLogin) {
    const hasLoginForm = await page.locator('input[type="email"]').count() > 0;
    step(record, 'Login form shown after redirect', hasLoginForm);
  }
}

async function testCheckoutPage(page, record) {
  await page.goto(CONFIG.baseUrl + '/checkout', { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });

  const url = page.url();
  const isCheckout = url.includes('checkout') && !url.includes('cart');
  const isCart = url.includes('cart');
  const isLogin = url.includes('login');

  step(record, 'Checkout page resolves', isCheckout || isCart || isLogin,
    isCheckout ? 'Checkout loaded' : isCart ? 'Redirected to cart (empty cart)' : isLogin ? 'Redirected to login (guest)' : url);

  const hasContent = await page.locator('main, .page-main, #checkout').count() > 0;
  step(record, 'Checkout page has content', hasContent);
}

async function testCheckoutButton(page, record) {
  await page.goto(CONFIG.baseUrl + '/checkout/cart', { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });
  await page.waitForTimeout(2500); // Wait for Magento JS to render buttons

  const checkoutBtn = await page.locator(
    'button:has-text("Proceed to Checkout"), button:has-text("Checkout"), ' +
    '.btn-proceed-checkout, [data-role="proceed-to-checkout"], a:has-text("Proceed"), .action.primary.checkout'
  ).count();
  step(record, 'Checkout button present on cart page', checkoutBtn > 0,
    checkoutBtn > 0 ? `Found ${checkoutBtn} button(s)` : 'Not found — expected when cart has items');

  const hasCartBlock = await page.locator('#shopping-cart-table, .cart-container, [class*="cart"], .cart.table-wrapper').count() > 0;
  step(record, 'Cart page structure loads correctly', hasCartBlock);
}

async function testMobileView(page, record) {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });

  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  step(record, 'No horizontal overflow on mobile', bodyWidth <= 380, `Body scrollWidth: ${bodyWidth}px`);

  const hasMobileMenu = await page.locator('.nav-toggle, .hamburger, [class*="mobile-menu"], [class*="menu-toggle"]').count() > 0;
  step(record, 'Mobile menu toggle visible', hasMobileMenu);

  const hasLogo = await page.locator('.logo, header img').count() > 0;
  step(record, 'Logo visible on mobile', hasLogo);

  await page.setViewportSize({ width: 1440, height: 900 });
}

async function testLanguageSwitcher(page, record) {
  await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });

  const langSwitcher = await page.locator('[class*="language"], [class*="switcher"], .language-switcher, select[id*="store"]').count() > 0;
  step(record, 'Language switcher present', langSwitcher);

  if (langSwitcher) {
    const options = await page.locator('[class*="language"] a, [class*="switcher"] a, [class*="switcher"] option, [class*="switcher"] li').count();
    // Pass if at least 1 option found (site may have EN only or EN+AR)
    step(record, 'Language options are accessible', options >= 1, `${options} option(s) found`);
  }
}

async function test404Page(page, record) {
  const resp = await page.goto(CONFIG.baseUrl + '/this-page-does-not-exist-xyz123', {
    waitUntil: 'domcontentloaded', timeout: CONFIG.timeout,
  }).catch(() => null);

  const status = resp ? resp.status() : null;
  step(record, '404 page returns proper status', status === 404 || status === 200, `Status: ${status}`);

  const has404Content = await page.locator('h1, [class*="404"], [class*="not-found"]').count() > 0;
  step(record, '404 page has helpful content', has404Content);
}

async function testFooter(page, record) {
  await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });

  const hasFooter = await page.locator('footer, .footer').count() > 0;
  step(record, 'Footer element present', hasFooter);

  const footerLinks = await page.locator('footer a, .footer a').count();
  step(record, 'Footer contains links', footerLinks > 0, `${footerLinks} links in footer`);

  const hasContactOrAbout = await page.locator('footer a:has-text("Contact"), footer a:has-text("About"), .footer a:has-text("Contact")').count() > 0;
  step(record, 'Key footer links present (Contact/About)', hasContactOrAbout);
}

// ─────────────────────────────────────────────

// ─── REPORT (LIGHT THEME) ─────────────────────────────────────
async function generateReport() {
  fs.mkdirSync(CONFIG.reportDir, { recursive: true });

  const avgLoad     = run.healthPages.length ? Math.round(run.healthPages.reduce((s,p)=>s+(p.loadTime||0),0)/run.healthPages.length) : 0;
  const passedPages = run.healthPages.filter(p=>p.status==='passed');
  const warnPages   = run.healthPages.filter(p=>p.status==='warning');
  const failedPages = run.healthPages.filter(p=>p.status==='failed');
  const slowPages   = run.healthPages.filter(p=>(p.loadTime||0)>CONFIG.slowPageThreshold);
  const healthRate  = run.summary.total ? Math.round((run.summary.passed/run.summary.total)*100) : 0;
  const funcRate    = run.funcSummary.total ? Math.round((run.funcSummary.passed/run.funcSummary.total)*100) : 0;
  const duration    = Math.round((Date.now()-run.startedAt)/1000);

  const errMap = {};
  run.healthPages.forEach(p=>p.errors.forEach(e=>{ const k=e.substring(0,80); errMap[k]=(errMap[k]||0)+1; }));
  const topErrors = Object.entries(errMap).sort((a,b)=>b[1]-a[1]).slice(0,8);

  const funcGroups = {};
  run.functionalTests.forEach(t=>{ if(!funcGroups[t.group]) funcGroups[t.group]=[]; funcGroups[t.group].push(t); });

  const slowest20 = [...run.healthPages].sort((a,b)=>(b.loadTime||0)-(a.loadTime||0)).slice(0,20);
  const maxLoad   = slowest20.length ? (slowest20[0].loadTime||1) : 1;

  const pageRows = run.healthPages.map((p,i) => {
    const st = p.status==='passed'?'pill-pass':p.status==='warning'?'pill-warn':'pill-fail';
    const lt = (p.loadTime||0)<CONFIG.fastPageThreshold?'lf':(p.loadTime||0)<CONFIG.slowPageThreshold?'lw':'ls';
    const htc= (p.statusCode||0)>=400?'var(--fail)':'var(--muted)';
    const ec = p.criticalErrorCount>0?'var(--fail)':'var(--pass)';
    const ac = (p.accessibility?.imagesWithoutAlt||0)>0?'var(--warn)':'var(--muted)';
    return `
<tr class="page-row" data-status="${p.status}" data-url="${p.url.toLowerCase()}" data-load="${p.loadTime||0}">
  <td class="url-cell"><a href="${p.url}" target="_blank">${p.url.replace(CONFIG.baseUrl,'')||'/'}</a></td>
  <td><span class="pill ${st}">${p.status}</span></td>
  <td><span class="${lt}">${p.loadTime??'—'}ms</span></td>
  <td style="font-family:var(--mono);font-size:12px;color:${htc}">${p.statusCode??'—'}</td>
  <td style="font-family:var(--mono);font-size:12px;font-weight:600;color:${ec}">${p.criticalErrorCount}</td>
  <td style="font-family:var(--mono);font-size:12px;color:${ac}">${p.accessibility?.imagesWithoutAlt??'—'}</td>
  <td><button class="expand-btn" onclick="toggleRow(${i})">Details</button></td>
</tr>
<tr class="row-detail" id="detail-${i}">
  <td colspan="7">
    <div class="det-inner">
      <div class="det-grid">
        <div class="det-item"><div class="det-label">Load Time</div><div class="det-val" style="color:${(p.loadTime||0)<CONFIG.fastPageThreshold?'var(--pass)':(p.loadTime||0)<CONFIG.slowPageThreshold?'var(--warn)':'var(--fail)'}">${p.loadTime}ms</div></div>
        <div class="det-item"><div class="det-label">First Contentful Paint</div><div class="det-val" style="color:var(--info)">${p.fcp??'N/A'}ms</div></div>
        <div class="det-item"><div class="det-label">HTTP Status</div><div class="det-val" style="color:${(p.statusCode||0)>=400?'var(--fail)':'var(--pass)'}">${p.statusCode}</div></div>
        <div class="det-item"><div class="det-label">Critical JS Errors</div><div class="det-val" style="color:${p.criticalErrorCount>0?'var(--fail)':'var(--pass)'}">${p.criticalErrorCount}</div></div>
      </div>
      <div class="a11y-row">
        <div class="a11y-item">${p.accessibility?.hasH1?'✅':'❌'} H1 tag</div>
        <div class="a11y-item">${p.accessibility?.hasTitle?'✅':'❌'} Page title</div>
        <div class="a11y-item">${p.accessibility?.hasMetaDesc?'✅':'❌'} Meta desc</div>
        <div class="a11y-item" style="color:${(p.accessibility?.imagesWithoutAlt||0)>0?'var(--warn)':'inherit'}">⚠️ ${p.accessibility?.imagesWithoutAlt??0} images missing alt</div>
      </div>
      ${p.errors.length>0?`<div>${p.errors.map(e=>`<div class="err-item">→ ${e.substring(0,200)}</div>`).join('')}</div>`:''}
    </div>
  </td>
</tr>`;
  }).join('');

  const funcCards = Object.entries(funcGroups).map(([grp,tests])=>`
<div class="func-group">
  <div class="func-group-title">${grp}</div>
  ${tests.map((t,i)=>`
  <div class="fc ${t.status==='passed'?'pass-card':'fail-card'}" id="fc-${grp}-${i}">
    <div class="fc-hdr" onclick="toggleCard('fc-${grp}-${i}')">
      <div class="fc-dot ${t.status==='passed'?'dot-p':'dot-f'}"></div>
      <div class="fc-name">${t.name}</div>
      <span class="fc-tag">${grp}</span>
      <span class="pill ${t.status==='passed'?'pill-pass':'pill-fail'}" style="margin-right:8px">${t.status}</span>
      <span class="fc-dur">${t.duration}ms</span>
      <span class="fc-chevron" style="margin-left:8px">▶</span>
    </div>
    <div class="fc-body">
      ${t.steps.map(s=>`<div class="step-row"><span class="step-icon">${s.passed?'✅':'❌'}</span><span class="step-name">${s.name}</span>${s.detail?`<span class="step-detail">${s.detail}</span>`:''}</div>`).join('')}
      ${t.error?`<div class="fc-error">💥 Error: ${t.error}</div>`:''}
    </div>
  </div>`).join('')}
</div>`).join('');

  const perfBars = slowest20.map(p=>{
    const pct = Math.round(((p.loadTime||0)/maxLoad)*100);
    const clr = (p.loadTime||0)<CONFIG.fastPageThreshold?'var(--pass)':(p.loadTime||0)<CONFIG.slowPageThreshold?'var(--warn)':'var(--fail)';
    return `<div class="perf-bar-row"><div class="pb-label" title="${p.url.replace(CONFIG.baseUrl,'')}">${(p.url.replace(CONFIG.baseUrl,'')||'/').substring(0,55)}</div><div class="pb-track"><div class="pb-fill" style="width:${pct}%;background:${clr}"></div></div><div class="pb-val" style="color:${clr}">${p.loadTime}ms</div></div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FWT Test Report — ${new Date().toLocaleDateString()}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
:root{--bg:#f4f6fb;--surface:#fff;--surface2:#f9fafc;--border:#e2e6ef;--border2:#d0d5e2;--pass:#0d9e6e;--pass-bg:#eafaf3;--warn:#d97706;--warn-bg:#fffbeb;--fail:#dc2626;--fail-bg:#fef2f2;--info:#2563eb;--info-bg:#eff6ff;--text:#111827;--muted:#6b7280;--font:'Inter',sans-serif;--mono:'JetBrains Mono',monospace;--radius:10px;--shadow:0 1px 4px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.04)}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:var(--font);font-size:14px;line-height:1.6;min-height:100vh}
.topbar{background:#fff;border-bottom:1px solid var(--border);padding:0 32px;display:flex;align-items:center;gap:14px;height:54px;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.tb-brand{font-size:13px;font-weight:800;letter-spacing:.06em;color:var(--info)}
.tb-sep{color:var(--border2)}
.tb-env{font-family:var(--mono);font-size:11px;color:var(--muted);background:var(--surface2);padding:3px 10px;border-radius:6px;border:1px solid var(--border)}
.tb-right{margin-left:auto;display:flex;align-items:center;gap:12px}
.tb-time{font-size:12px;color:var(--muted)}
.tb-dur{font-family:var(--mono);font-size:12px;background:var(--info-bg);color:var(--info);padding:3px 10px;border-radius:6px;border:1px solid #bfdbfe}
.wrap{max-width:1380px;margin:0 auto;padding:28px 32px}
.hero{background:linear-gradient(135deg,#1e40af 0%,#1d4ed8 40%,#2563eb 100%);color:#fff;border-radius:14px;padding:36px 44px;margin-bottom:26px;position:relative;overflow:hidden;box-shadow:0 4px 24px rgba(37,99,235,.25)}
.hero::after{content:'';position:absolute;right:-40px;top:-40px;width:220px;height:220px;background:rgba(255,255,255,.06);border-radius:50%;pointer-events:none}
.hero-badge{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;background:rgba(255,255,255,.2);padding:3px 12px;border-radius:20px;display:inline-block;margin-bottom:12px}
.hero-title{font-size:28px;font-weight:800;margin-bottom:6px}
.hero-meta{font-size:13px;opacity:.85}.hero-meta b{opacity:1;font-weight:600}
.score-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:16px;margin-bottom:26px}
.sc{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:22px 20px;box-shadow:var(--shadow);position:relative;overflow:hidden}
.sc::before{content:'';position:absolute;top:0;left:0;right:0;height:4px}
.sc.pass::before{background:var(--pass)}.sc.warn::before{background:var(--warn)}.sc.fail::before{background:var(--fail)}.sc.info::before{background:var(--info)}
.sc-label{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
.sc-value{font-size:38px;font-weight:800;line-height:1}
.sc.pass .sc-value{color:var(--pass)}.sc.warn .sc-value{color:var(--warn)}.sc.fail .sc-value{color:var(--fail)}.sc.info .sc-value{color:var(--info)}
.sc-sub{font-size:12px;color:var(--muted);margin-top:5px}
.sec-hdr{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.sec-title{font-size:16px;font-weight:700}
.badge{font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px}
.badge-pass{background:var(--pass-bg);color:var(--pass);border:1px solid #a7f3d0}
.badge-fail{background:var(--fail-bg);color:var(--fail);border:1px solid #fecaca}
.badge-warn{background:var(--warn-bg);color:var(--warn);border:1px solid #fde68a}
.badge-info{background:var(--info-bg);color:var(--info);border:1px solid #bfdbfe}
.tabs{display:flex;gap:2px;margin-bottom:22px;border-bottom:2px solid var(--border)}
.tab{padding:9px 20px;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .15s;border-radius:6px 6px 0 0;font-family:var(--font)}
.tab:hover{color:var(--text);background:var(--surface2)}.tab.active{color:var(--info);border-bottom-color:var(--info);background:var(--surface)}
.tab-panel{display:none}.tab-panel.active{display:block}
.func-group{margin-bottom:20px}
.func-group-title{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--info);padding:5px 0;border-bottom:2px solid var(--info-bg);margin-bottom:8px}
.fc{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:8px;overflow:hidden;box-shadow:var(--shadow)}
.fc.fail-card{border-left:3px solid var(--fail)}.fc.pass-card{border-left:3px solid var(--pass)}
.fc-hdr{display:flex;align-items:center;gap:12px;padding:13px 18px;cursor:pointer;user-select:none}
.fc-hdr:hover{background:var(--surface2)}
.fc-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.dot-p{background:var(--pass)}.dot-f{background:var(--fail)}
.fc-name{flex:1;font-weight:600;font-size:13px}
.fc-tag{font-size:11px;color:var(--muted);background:var(--surface2);padding:2px 8px;border-radius:4px;border:1px solid var(--border)}
.fc-dur{font-family:var(--mono);font-size:11px;color:var(--muted)}
.fc-chevron{color:var(--muted);font-size:11px;transition:transform .2s}
.fc.open .fc-chevron{transform:rotate(90deg)}
.fc-body{display:none;padding:0 18px 14px;border-top:1px solid var(--border)}.fc.open .fc-body{display:block}
.step-row{display:flex;align-items:flex-start;gap:10px;padding:6px 0;border-bottom:1px solid var(--surface2);font-size:13px}
.step-row:last-child{border-bottom:none}.step-icon{font-size:13px;flex-shrink:0;margin-top:1px}.step-name{flex:1}.step-detail{font-family:var(--mono);font-size:11px;color:var(--muted)}
.fc-error{margin-top:8px;padding:10px 12px;background:var(--fail-bg);border:1px solid #fecaca;border-radius:6px;font-family:var(--mono);font-size:12px;color:var(--fail)}
.filters{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;box-shadow:var(--shadow)}
.f-label{font-size:12px;font-weight:600;color:var(--muted)}
.chip{font-size:12px;padding:4px 12px;border-radius:20px;border:1px solid var(--border);background:#fff;color:var(--muted);cursor:pointer;transition:all .15s;font-family:var(--font)}
.chip:hover,.chip.active{border-color:var(--info);color:var(--info);background:var(--info-bg)}
.s-input{margin-left:auto;background:#fff;border:1px solid var(--border);color:var(--text);padding:6px 12px;border-radius:8px;font-size:12px;font-family:var(--font);width:220px}
.s-input:focus{outline:none;border-color:var(--info)}.s-input::placeholder{color:var(--muted)}
.tbl-wrap{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow)}
.tbl{width:100%;border-collapse:collapse}
.tbl thead tr{background:var(--surface2);border-bottom:2px solid var(--border)}
.tbl th{padding:10px 14px;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);text-align:left;cursor:pointer;white-space:nowrap}
.tbl th:hover{color:var(--text)}.tbl td{padding:10px 14px;border-bottom:1px solid var(--surface2);font-size:12px}
.tbl tr:last-child td{border-bottom:none}.tbl tr.page-row:hover td{background:var(--surface2)}
.url-cell{font-family:var(--mono);font-size:11px;max-width:500px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.url-cell a{color:var(--info);text-decoration:none}.url-cell a:hover{text-decoration:underline}
.pill{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.pill-pass{background:var(--pass-bg);color:var(--pass);border:1px solid #a7f3d0}
.pill-warn{background:var(--warn-bg);color:var(--warn);border:1px solid #fde68a}
.pill-fail{background:var(--fail-bg);color:var(--fail);border:1px solid #fecaca}
.lf{color:var(--pass);font-family:var(--mono);font-size:12px;font-weight:600}
.lw{color:var(--warn);font-family:var(--mono);font-size:12px;font-weight:600}
.ls{color:var(--fail);font-family:var(--mono);font-size:12px;font-weight:600}
.expand-btn{background:var(--surface2);border:1px solid var(--border);color:var(--muted);padding:3px 10px;border-radius:6px;font-size:11px;cursor:pointer;font-family:var(--font)}
.expand-btn:hover{border-color:var(--info);color:var(--info)}
.row-detail{display:none;background:#f0f5ff}.row-detail.open{display:table-row}
.det-inner{padding:14px 18px}
.det-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:12px}
.det-item{background:#fff;border:1px solid var(--border);border-radius:8px;padding:12px}
.det-label{font-size:11px;color:var(--muted);margin-bottom:4px}.det-val{font-family:var(--mono);font-size:15px;font-weight:700}
.a11y-row{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px}.a11y-item{font-size:12px;display:flex;align-items:center;gap:5px}
.err-item{padding:7px 12px;background:var(--fail-bg);border:1px solid #fecaca;border-radius:6px;font-family:var(--mono);font-size:11px;color:var(--fail);margin-bottom:4px}
.err-table{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow)}
.err-row{display:flex;align-items:center;gap:14px;padding:12px 18px;border-bottom:1px solid var(--surface2)}
.err-row:last-child{border-bottom:none}.err-row:hover{background:var(--surface2)}
.err-count{background:var(--fail);color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;min-width:32px;text-align:center;flex-shrink:0}
.err-msg{font-family:var(--mono);font-size:12px;color:var(--text);flex:1}
.perf-bar-row{display:flex;align-items:center;gap:12px;margin-bottom:7px}
.pb-label{font-family:var(--mono);font-size:11px;color:var(--muted);width:280px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pb-track{flex:1;background:var(--surface2);border-radius:4px;height:18px;overflow:hidden;border:1px solid var(--border)}
.pb-fill{height:100%;border-radius:4px}.pb-val{font-family:var(--mono);font-size:11px;font-weight:600;width:65px}
.pagination{display:flex;align-items:center;gap:6px;margin-top:14px;justify-content:flex-end;flex-wrap:wrap}
.pg-btn{background:#fff;border:1px solid var(--border);color:var(--muted);padding:5px 12px;border-radius:6px;font-size:12px;cursor:pointer;font-family:var(--font)}
.pg-btn:hover{border-color:var(--info);color:var(--info)}
.pg-btn.active{border-color:var(--info);color:var(--info);background:var(--info-bg);font-weight:700}
.pg-info{font-size:12px;color:var(--muted)}
::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:var(--surface2)}::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}
</style>
</head>
<body>
<div class="topbar">
  <span class="tb-brand">FWT TEST SUITE</span><span class="tb-sep">|</span>
  <span class="tb-env">${CONFIG.baseUrl}</span>
  <div class="tb-right"><span class="tb-time">${run.startedAt.toLocaleString()}</span><span class="tb-dur">⏱ ${duration}s</span></div>
</div>
<div class="wrap">
  <div class="hero">
    <div class="hero-badge">Automated Test Report</div>
    <div class="hero-title">Fantasy World Toys</div>
    <div class="hero-meta">Environment: <b>${CONFIG.baseUrl}</b> &nbsp;·&nbsp; Date: <b>${run.startedAt.toLocaleDateString()}</b> &nbsp;·&nbsp; Duration: <b>${duration}s</b> &nbsp;·&nbsp; Pages: <b>${run.summary.total}</b></div>
  </div>

  <div style="margin-bottom:10px"><div class="sec-hdr"><div class="sec-title">Page Health</div><span class="badge badge-info">${run.summary.total} pages crawled</span></div></div>
  <div class="score-grid" style="margin-bottom:28px">
    <div class="sc pass"><div class="sc-label">Passed</div><div class="sc-value">${passedPages.length}</div><div class="sc-sub">${healthRate}% pass rate</div></div>
    <div class="sc warn"><div class="sc-label">Warnings</div><div class="sc-value">${warnPages.length}</div><div class="sc-sub">Slow or minor issues</div></div>
    <div class="sc fail"><div class="sc-label">Failed</div><div class="sc-value">${failedPages.length}</div><div class="sc-sub">Needs immediate fix</div></div>
    <div class="sc info"><div class="sc-label">Avg Load Time</div><div class="sc-value" style="font-size:30px">${avgLoad}ms</div><div class="sc-sub">${avgLoad<3000?'🟢 Fast':avgLoad<8000?'🟡 Moderate':'🔴 Slow'}</div></div>
  </div>

  <div style="margin-bottom:10px"><div class="sec-hdr"><div class="sec-title">Functional Tests</div><span class="badge badge-info">${run.funcSummary.total} scenarios</span></div></div>
  <div class="score-grid" style="margin-bottom:32px">
    <div class="sc pass"><div class="sc-label">Passed</div><div class="sc-value">${run.funcSummary.passed}</div><div class="sc-sub">${funcRate}% pass rate</div></div>
    <div class="sc fail"><div class="sc-label">Failed</div><div class="sc-value">${run.funcSummary.failed}</div><div class="sc-sub">Functionality broken</div></div>
  </div>

  <div class="tabs">
    <button class="tab active" onclick="switchTab('functional',this)">🧪 Functional Tests</button>
    <button class="tab" onclick="switchTab('health',this)">🌐 Page Health</button>
    <button class="tab" onclick="switchTab('errors',this)">⚠️ Error Summary</button>
    <button class="tab" onclick="switchTab('perf',this)">⚡ Performance</button>
  </div>

  <div id="tab-functional" class="tab-panel active">${funcCards}</div>

  <div id="tab-health" class="tab-panel">
    <div class="filters">
      <span class="f-label">Filter:</span>
      <button class="chip active" onclick="filterPages('all',this)">All (${run.summary.total})</button>
      <button class="chip" onclick="filterPages('passed',this)">✅ Passed (${passedPages.length})</button>
      <button class="chip" onclick="filterPages('warning',this)">⚠️ Warning (${warnPages.length})</button>
      <button class="chip" onclick="filterPages('failed',this)">❌ Failed (${failedPages.length})</button>
      <input class="s-input" type="text" placeholder="Search URLs…" oninput="searchPages(this.value)">
    </div>
    <div class="tbl-wrap">
      <table class="tbl"><thead><tr>
        <th onclick="sortTable(0)"># URL</th><th onclick="sortTable(1)">Status</th>
        <th onclick="sortTable(2)">Load Time</th><th onclick="sortTable(3)">HTTP</th>
        <th onclick="sortTable(4)">Errors</th><th>No-Alt</th><th></th>
      </tr></thead><tbody id="pageTableBody">${pageRows}</tbody></table>
    </div>
    <div class="pagination" id="pagination"></div>
  </div>

  <div id="tab-errors" class="tab-panel">
    <div class="sec-hdr" style="margin-bottom:16px"><div class="sec-title">Top Critical Errors</div><span class="badge badge-fail">${topErrors.length} types</span></div>
    ${topErrors.length===0?'<div style="padding:40px;text-align:center;color:var(--pass);font-size:16px;font-weight:600;background:var(--surface);border-radius:var(--radius);border:1px solid var(--border)">🎉 No critical errors!</div>':`<div class="err-table">${topErrors.map(([msg,c])=>`<div class="err-row"><span class="err-count">${c}×</span><span class="err-msg">${msg}</span></div>`).join('')}</div>`}
    <div style="margin-top:28px">
      <div class="sec-hdr"><div class="sec-title">Accessibility Overview</div></div>
      <div class="score-grid">
        <div class="sc warn"><div class="sc-label">Missing Alt Tags</div><div class="sc-value" style="font-size:30px">${run.healthPages.reduce((s,p)=>s+(p.accessibility?.imagesWithoutAlt||0),0)}</div><div class="sc-sub">Total across all pages</div></div>
        <div class="sc warn"><div class="sc-label">Missing H1</div><div class="sc-value" style="font-size:30px">${run.healthPages.filter(p=>!p.accessibility?.hasH1).length}</div><div class="sc-sub">Pages without H1</div></div>
        <div class="sc warn"><div class="sc-label">Missing Meta Desc</div><div class="sc-value" style="font-size:30px">${run.healthPages.filter(p=>!p.accessibility?.hasMetaDesc).length}</div><div class="sc-sub">SEO issue</div></div>
        <div class="sc fail"><div class="sc-label">Slow Pages</div><div class="sc-value" style="font-size:30px">${slowPages.length}</div><div class="sc-sub">Over ${CONFIG.slowPageThreshold/1000}s</div></div>
      </div>
    </div>
  </div>

  <div id="tab-perf" class="tab-panel">
    <div class="sec-hdr"><div class="sec-title">Slowest 20 Pages</div><span class="badge badge-warn">${slowPages.length} pages over ${CONFIG.slowPageThreshold/1000}s</span></div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;box-shadow:var(--shadow)">${perfBars}</div>
  </div>
</div>

<script>
const PAGE_SIZE=50;let currentPage=1;
function switchTab(n,b){document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));document.getElementById('tab-'+n).classList.add('active');b.classList.add('active');if(n==='health')updatePagination();}
function toggleCard(id){document.getElementById(id).classList.toggle('open');}
function toggleRow(i){document.getElementById('detail-'+i).classList.toggle('open');}
function filterPages(s,b){document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));b.classList.add('active');currentPage=1;document.querySelectorAll('.page-row').forEach(r=>{r._vis=s==='all'||r.dataset.status===s;r.style.display=r._vis?'':'none';const d=r.nextElementSibling;if(d&&d.classList.contains('row-detail'))d.classList.remove('open');});updatePagination();}
function searchPages(v){const q=v.toLowerCase();currentPage=1;document.querySelectorAll('.page-row').forEach(r=>{r._vis=r.dataset.url.includes(q);r.style.display=r._vis?'':'none';});updatePagination();}
function updatePagination(){const rows=[...document.querySelectorAll('.page-row')].filter(r=>r._vis!==false&&r.style.display!=='none');const tp=Math.ceil(rows.length/PAGE_SIZE);rows.forEach((r,i)=>{const show=i>=(currentPage-1)*PAGE_SIZE&&i<currentPage*PAGE_SIZE;r.style.display=show?'':'none';});const pg=document.getElementById('pagination');pg.innerHTML='';if(tp<=1)return;const info=document.createElement('span');info.className='pg-info';info.textContent='Showing page '+currentPage+' of '+tp+' ('+rows.length+' total)';pg.appendChild(info);for(let i=1;i<=tp;i++){const btn=document.createElement('button');btn.className='pg-btn'+(i===currentPage?' active':'');btn.textContent=i;btn.onclick=(function(pi){return function(){currentPage=pi;updatePagination();};})(i);pg.appendChild(btn);}}
let sortDir={};
function sortTable(c){const tb=document.getElementById('pageTableBody');const rows=[...tb.querySelectorAll('.page-row')];const asc=!sortDir[c];sortDir={};sortDir[c]=asc;rows.sort((a,b)=>{const av=a.cells[c]?.textContent.trim()||'';const bv=b.cells[c]?.textContent.trim()||'';return asc?av.localeCompare(bv,undefined,{numeric:true}):bv.localeCompare(av,undefined,{numeric:true});});rows.forEach(r=>{tb.appendChild(r);const d=r.nextElementSibling;if(d&&d.classList.contains('row-detail'))tb.appendChild(d);});updatePagination();}
document.querySelectorAll('.page-row').forEach(r=>r._vis=true);updatePagination();
</script>
</body></html>`;

  const stamp=Date.now();
  const reportFile=path.join(CONFIG.reportDir,`report-${stamp}.html`);
  fs.writeFileSync(reportFile,html);
  fs.writeFileSync(path.join(CONFIG.reportDir,'latest.html'),html);
  console.log(`\n📄 Report saved  → ${reportFile}`);
  console.log(`📄 Latest report → ${path.join(CONFIG.reportDir,'latest.html')}`);
  return reportFile;
}

// ─── MAIN ────────────────────────────────────────────────────
async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   FANTASY WORLD TOYS — AUTOMATED TEST SUITE  v3          ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║   Target   : ${CONFIG.baseUrl.padEnd(47)}║`);
  console.log(`║   Max Pages: ${String(CONFIG.maxCrawlPages).padEnd(47)}║`);
  console.log(`║   Started  : ${run.startedAt.toLocaleString().padEnd(47)}║`);
  console.log('╚═══════════════════════════════════════════════════════════╝');
  const browser=await chromium.launch({headless:true});
  try { await runHealthCrawl(browser); await runFunctionalTests(browser); }
  finally { await browser.close(); }
  await generateReport();
  const dur=Math.round((Date.now()-run.startedAt)/1000);
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   FINAL RESULTS                                           ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║   Pages   : ${run.summary.total} total / ${run.summary.passed} passed / ${run.summary.warnings} warning / ${run.summary.failed} failed`.padEnd(62)+'║');
  console.log(`║   Func    : ${run.funcSummary.total} tests / ${run.funcSummary.passed} passed / ${run.funcSummary.failed} failed`.padEnd(62)+'║');
  console.log(`║   Duration: ${dur}s`.padEnd(62)+'║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
}
main().catch(e=>{console.error('\n💥 Fatal error:',e.message);process.exit(1);});
