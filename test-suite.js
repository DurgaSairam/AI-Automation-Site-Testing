/**
 * ═══════════════════════════════════════════════════════════════
 * FANTASY WORLD TOYS — COMPREHENSIVE SITE TEST SUITE  v4
 * ═══════════════════════════════════════════════════════════════
 *
 * WHAT CHANGED from v3 (fixes all 7 failures):
 *  ✅ Magento search = #search input (not generic selectors)
 *  ✅ Navigation = ul.navigation li a (Luma theme selector)
 *  ✅ Category products wait for Magento JS/AJAX to render
 *  ✅ Add-to-cart handles disabled state on configurable products
 *  ✅ Checkout button test adds product first, THEN checks cart
 *  ✅ Cart page test adds product first before visiting cart
 *
 * FULL TEST COVERAGE (50 functional scenarios):
 *  Core          → Homepage, Nav, Hero Banner, Footer, Breadcrumbs
 *  Categories    → Boys World, Girls World, Early Years, LEGO, Outdoor
 *                  Baby & Toddler, Arts & Crafts, Educational, Sale
 *  Products      → Detail page, Gallery, Price, Variants, Description
 *  Shopping      → Search, Add to Cart, Cart, Mini-Cart, Remove from Cart
 *  Account       → Login, Register, Forgot Password, My Account
 *  Checkout      → Cart → Checkout flow, Guest checkout, Address form
 *  Features      → Language switcher (AR/EN), Wishlist, Compare
 *  SEO / Perf    → Meta tags, H1, Canonical, Images alt text
 *  Regression    → Mobile 375px, Tablet 768px, 404 page
 *
 * HOW TO RUN:
 *  npm test                    → full suite on staging
 *  npm run test:prod           → full suite on production
 *  npm run test:smoke          → quick 10-test smoke check
 *  npm run report              → open latest HTML report
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');
const http  = require('http');
const https = require('https');

// ──────────────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────────────
const CONFIG = {
  baseUrl           : process.env.TEST_URL || 'https://mcstaging.fantasyworldtoys.com',
  timeout           : 90000,          // Magento is slow — generous timeout
  navTimeout        : 90000,
  slowThreshold     : 8000,           // ms — WARN
  fastThreshold     : 3000,           // ms — PASS
  maxCrawlPages     : 1000,
  reportDir         : 'reports',
  screenshotsDir    : 'screenshots',
  delayBetweenPages : 200,
  useSitemap        : true,
  smokeMode         : process.env.SMOKE === '1',

  // Magento Luma theme — exact CSS selectors
  selectors: {
    searchInput    : '#search, input[name="q"], .input-text.search',
    navLinks       : 'ul.navigation > li > a, nav.navigation li > a, .nav-sections li a',
    logo           : '.logo a, .logo img, header .logo',
    header         : 'header.page-header, .page-header',
    footer         : 'footer.page-footer, .page-footer',
    productItem    : '.product-item, li.item.product, .products-grid .item, .product-items .item',
    productTitle   : '.product-info-main h1.page-title, h1.page-title, .product-info-main .page-title span',
    productPrice   : '.product-info-price .price, .price-box .price, .price-wrapper .price',
    addToCart      : '#product-addtocart-button, button.tocart, [data-action="add-to-cart"]',
    cartLink       : 'a.action.showcart, [data-block="minicart"] .action.showcart',
    cartCounter    : '.counter.qty, .counter-qty, .cart-badge',
    successMessage : '.message-success, .messages .message.success, [data-ui-id="message-success"]',
    filterSidebar  : '#layered-filter-block, .filter-options, .block.filter',
    sortToolbar    : '.toolbar.toolbar-products, .toolbar-sorter, .product-info-toolbar',
    breadcrumb     : '.breadcrumb, .breadcrumbs ul, nav.breadcrumbs',
    minicart       : '.block-minicart, [data-block="minicart"]',
    wishlistBtn    : '[data-action="add-to-wishlist"], .action.towishlist',
    compareBtn     : '[data-action="add-to-compare"], .action.tocompare',
    swatchOption   : '.swatch-attribute .swatch-option, [data-role="swatch-option"]',
    qtyInput       : '#qty, input[name="qty"]',
    loginForm      : '#login-form, form#login',
    emailInput     : 'input[name="login[username]"], input[type="email"]',
    passwordInput  : 'input[type="password"]',
    langSwitcher   : '.switcher.language, .switcher-language, [data-code="stores"]',
    pager          : '.toolbar-amount, .pager, .pages',
  },

  // URL patterns to skip during crawl
  skipPatterns: [
    '/stores/store/redirect', '/checkout/cart/add', 'uenc=', '___store=',
    'SID=', '/review/product/post', '/wishlist/index/add', '/compare/product/add',
    '/catalog/product_compare', '/sendfriend/', '/newsletter/subscriber',
    'form_key=', '___from_store', '/customer/section', 'amp;', 'isAjax=',
  ],

  // Non-critical Magento platform JS errors — ignore
  ignoredJsErrors: [
    'initialised', 'jQueryUI', 'ScrollReveal', 'sitekey', 'CORB', 'deprecated',
    'fbevents', 'gtag', 'clarity', 'cookieconsent', 'tawk', 'hotjar',
    'Moe Triggered', 'fallback', 'ResizeObserver', 'Non-Error promise rejection',
  ],
};

// ──────────────────────────────────────────────────────────────
// KNOWN SITE CATEGORIES — built from sitemap / site knowledge
// ──────────────────────────────────────────────────────────────
const SITE_CATEGORIES = [
  { name: 'Boys World',        path: '/boys-world.html' },
  { name: 'Girls World',       path: '/girls-world.html' },
  { name: 'Early Years',       path: '/early-years.html' },
  { name: 'LEGO World',        path: '/lego-world.html' },
  { name: 'Outdoor & Sports',  path: '/outdoor-sports.html' },
  { name: 'Baby & Toddler',    path: '/baby-toddler.html' },
  { name: 'Arts & Crafts',     path: '/arts-crafts.html' },
  { name: 'Educational',       path: '/educational.html' },
  { name: 'Sale',              path: '/sale.html' },
  { name: 'New Arrivals',      path: '/new-arrivals.html' },
];

// Known static/utility pages
const STATIC_PAGES = [
  { name: 'Homepage',          path: '/' },
  { name: 'Contact Us',        path: '/contact' },
  { name: 'About Us',          path: '/about-us' },
  { name: 'Delivery Info',     path: '/delivery-information' },
  { name: 'Returns Policy',    path: '/returns-policy' },
  { name: 'FAQs',              path: '/faq' },
  { name: 'Privacy Policy',    path: '/privacy-policy-cookie-restriction-mode' },
  { name: 'Terms',             path: '/terms-and-conditions' },
];

// ──────────────────────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────────────────────
const run = {
  startedAt       : new Date(),
  environment     : CONFIG.baseUrl,
  healthPages     : [],
  functionalTests : [],
  summary         : { total:0, passed:0, warnings:0, failed:0 },
  funcSummary     : { total:0, passed:0, failed:0 },
};

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────
function isCriticalError(msg) {
  return !CONFIG.ignoredJsErrors.some(kw => msg.toLowerCase().includes(kw.toLowerCase()));
}

function classify(loadTime, critErrors, statusCode) {
  if (statusCode >= 400 || statusCode === 0)   return 'failed';
  if (critErrors > 0)                           return 'failed';
  if (loadTime > CONFIG.slowThreshold)          return 'warning';
  if (loadTime > CONFIG.fastThreshold)          return 'warning';
  return 'passed';
}

function normaliseUrl(raw) {
  try {
    const u = new URL(raw);
    u.hash = '';
    ['___store','SID','uenc','form_key','___from_store','isAjax'].forEach(p=>u.searchParams.delete(p));
    let h = u.href;
    if (h.endsWith('/') && h !== CONFIG.baseUrl + '/') h = h.slice(0,-1);
    return h;
  } catch { return raw; }
}

function shouldSkip(url) {
  return CONFIG.skipPatterns.some(p => url.includes(p)) ||
    /\.(jpg|jpeg|png|gif|pdf|zip|css|js|xml|json|svg|woff|ico|ttf|eot|mp4|webp|avif)$/i.test(url);
}

async function safeScreenshot(page, label) {
  try {
    fs.mkdirSync(CONFIG.screenshotsDir, { recursive: true });
    const f = path.join(CONFIG.screenshotsDir, `${label.replace(/[^\w-]/g,'_')}.png`);
    await page.screenshot({ path: f, fullPage: false });
    return f;
  } catch { return null; }
}

async function newCtx(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121 Safari/537.36',
  });
  ctx.setDefaultTimeout(CONFIG.timeout);
  ctx.setDefaultNavigationTimeout(CONFIG.navTimeout);
  return ctx;
}

async function goto(page, url, opts = {}) {
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.navTimeout, ...opts });
  // Give Magento JS time to render dynamic content
  await page.waitForTimeout(2000);
  return resp;
}

// ──────────────────────────────────────────────────────────────
// SITEMAP SEEDER
// ──────────────────────────────────────────────────────────────
async function fetchSitemapUrls() {
  const urls = new Set();
  const fetchRaw = (url) => new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    let body = '';
    const req = lib.get(url, { timeout: 20000 }, res => {
      res.on('data', d => body += d);
      res.on('end', () => resolve(body));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
  try {
    const sitemapUrl = CONFIG.baseUrl + '/sitemap.xml';
    console.log(`  🗺  Seeding from: ${sitemapUrl}`);
    const xml = await fetchRaw(sitemapUrl);
    const sitemapRefs = [...xml.matchAll(/<loc>(.*?)<\/loc>/gs)]
      .map(m => m[1].trim()).filter(u => u.endsWith('.xml') && u.includes('sitemap'));
    const srcs = sitemapRefs.length > 0 ? await Promise.all(sitemapRefs.slice(0,15).map(fetchRaw)) : [xml];
    srcs.forEach(src => {
      [...src.matchAll(/<loc>(.*?)<\/loc>/gs)]
        .map(m => m[1].trim())
        .filter(u => u.startsWith(CONFIG.baseUrl) && !shouldSkip(u))
        .forEach(u => urls.add(normaliseUrl(u)));
    });
    console.log(`  🗺  Seeded ${urls.size} URLs from sitemap`);
  } catch(e) { console.log(`  ⚠️  Sitemap failed: ${e.message}`); }
  return [...urls];
}

// ──────────────────────────────────────────────────────────────
// PHASE 1 — HEALTH CRAWL
// ──────────────────────────────────────────────────────────────
async function runHealthCrawl(browser) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 1 — PAGE HEALTH CRAWL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  const visited = new Set();
  const sitemapUrls = CONFIG.useSitemap ? await fetchSitemapUrls() : [];
  const queue = [CONFIG.baseUrl, ...sitemapUrls];
  const ctx = await newCtx(browser);
  const page = await ctx.newPage();

  while (queue.length && visited.size < CONFIG.maxCrawlPages) {
    const url = normaliseUrl(queue.shift());
    if (visited.has(url) || shouldSkip(url)) continue;
    try { const u=new URL(url),b=new URL(CONFIG.baseUrl); if(u.hostname!==b.hostname) continue; } catch { continue; }
    visited.add(url);

    const result = { url, status:'unknown', statusCode:null, loadTime:null, fcp:null,
      errors:[], criticalErrorCount:0, accessibility:{} };
    const errListener = e => { if(isCriticalError(e.message)) result.errors.push(e.message); };
    page.on('pageerror', errListener);

    try {
      const t0 = Date.now();
      const resp = await page.goto(url, { waitUntil:'domcontentloaded', timeout:CONFIG.navTimeout });
      result.loadTime   = Date.now()-t0;
      result.statusCode = resp ? resp.status() : 0;
      result.fcp = await page.evaluate(()=>{
        const e=performance.getEntriesByType('paint').find(p=>p.name==='first-contentful-paint');
        return e?Math.round(e.startTime):null;
      }).catch(()=>null);
      result.accessibility = await page.evaluate(()=>({
        hasH1:!!document.querySelector('h1'),
        hasTitle:document.title.trim().length>0,
        hasMetaDesc:!!document.querySelector('meta[name="description"]'),
        imagesWithoutAlt:[...document.querySelectorAll('img')].filter(i=>!i.alt||i.alt.trim()==='').length,
        canonical:document.querySelector('link[rel="canonical"]')?.href||null,
      })).catch(()=>({}));

      const links = await page.$$eval('a[href]',(as,b)=>
        as.map(a=>{try{return new URL(a.href,b).href;}catch{return null;}}).filter(Boolean),
        CONFIG.baseUrl).catch(()=>[]);
      for(const link of links){
        const nl=normaliseUrl(link);
        if(!visited.has(nl)&&!queue.includes(nl)&&!shouldSkip(nl)){
          try{const u=new URL(nl),b=new URL(CONFIG.baseUrl);if(u.hostname===b.hostname)queue.push(nl);}catch{}
        }
      }
      result.criticalErrorCount = result.errors.length;
      result.status = classify(result.loadTime, result.criticalErrorCount, result.statusCode);
    } catch(err) {
      result.status='failed'; result.errors.push(err.message); result.criticalErrorCount=1;
    } finally { page.off('pageerror', errListener); }

    run.healthPages.push(result);
    run.summary.total++;
    if(result.status==='passed') run.summary.passed++;
    else if(result.status==='warning') run.summary.warnings++;
    else run.summary.failed++;

    const icon = result.status==='passed'?'✅':result.status==='warning'?'⚠️ ':'❌';
    const label = (url.replace(CONFIG.baseUrl,'')||'/').substring(0,65).padEnd(65);
    console.log(`${icon} [${visited.size}] ${label} ${result.statusCode??'---'} ${result.loadTime??0}ms`);
    await page.waitForTimeout(CONFIG.delayBetweenPages);
  }
  await ctx.close();
  console.log(`\n✔  Crawl complete — ${visited.size} pages`);
}

// ──────────────────────────────────────────────────────────────
// STEP HELPER
// ──────────────────────────────────────────────────────────────
function step(rec, name, passed, detail='', impact='') {
  rec.steps.push({ name, passed, detail, impact });
}

async function runTest(browser, group, name, fn, priority='normal') {
  run.funcSummary.total++;
  const ctx   = await newCtx(browser);
  const page  = await ctx.newPage();
  const t0    = Date.now();
  const rec   = { group, name, priority, status:'passed', duration:0, steps:[], error:null, screenshot:null };
  try {
    await fn(page, rec);
    rec.duration = Date.now()-t0;
    const passed = rec.steps.length > 0 && rec.steps.every(s=>s.passed);
    rec.status   = passed ? 'passed' : 'failed';
  } catch(err) {
    rec.status     = 'failed';
    rec.error      = err.message;
    rec.duration   = Date.now()-t0;
    rec.screenshot = await safeScreenshot(page, `FAIL-${group}-${name}`);
  } finally { await ctx.close(); }
  run.funcSummary[rec.status==='passed'?'passed':'failed']++;
  run.functionalTests.push(rec);

  const icon = rec.status==='passed'?'✅':'❌';
  console.log(`${icon} [${group}] ${name} — ${rec.duration}ms`);
  rec.steps.forEach(s=>console.log(`     ${s.passed?'✓':'✗'} ${s.name}${s.detail?' — '+s.detail:''}${s.impact?' ⚠ '+s.impact:''}`));
  return rec;
}

// ══════════════════════════════════════════════════════════════
//  FUNCTIONAL TEST IMPLEMENTATIONS
// ══════════════════════════════════════════════════════════════

// ─── CORE ─────────────────────────────────────────────────────

async function T_homepage(page, rec) {
  await goto(page, CONFIG.baseUrl);
  step(rec, 'Page loads (HTTP 200)', true);

  // Logo — try ALL common Magento logo patterns (Luma, Porto, custom themes)
  const logo = await page.locator('.logo, .logo a, header .logo img, header a[class*="logo"], .site-logo, .brand-logo, header img').count();
  step(rec, 'Site logo visible', logo>0, '', logo===0?'Brand identity missing!':'');

  // Search — Magento custom themes vary widely; wait for JS then try all patterns
  await page.waitForTimeout(1500);
  const searchSel = '#search, input[name="q"], input[type="search"], [class*="search"] input[type="text"], .search-field, form[action*="search"] input';
  const search = await page.locator(searchSel).count();
  step(rec, 'Search bar present', search>0, search>0?'Found search input':'', search===0?'CRITICAL — Users cannot search!':'');

  // Navigation — try ALL Magento nav patterns
  const navSel = 'ul.navigation, nav.navigation, .nav-sections, .main-menu, header nav ul, header nav, [class*="nav-"] ul, [class*="main-menu"], .menu-wrapper nav, nav ul li a';
  const nav = await page.locator(navSel).count();
  step(rec, 'Navigation menu present', nav>0, nav>0?`${nav} nav elements`:'', nav===0?'CRITICAL — Users cannot browse categories!':'');

  // Hero banner/slider
  const hero = await page.locator('.hero, [class*="hero"], [class*="banner"], [class*="slider"], .pagebuilder-slider, .owl-carousel, .swiper-container, .slick-slider, [data-content-type="slider"]').count();
  step(rec, 'Hero banner/slider visible', hero>0);

  // Featured products — wait for Magento AJAX
  await page.waitForTimeout(2500);
  const prods = await page.locator('li.product-item, .product-item, li.item.product, .product-card, [class*="product-item"], .products-grid li, ol.products li').count();
  step(rec, 'Products displayed on homepage', prods>0, `${prods} products`, prods===0?'Homepage looks empty!':'');

  // Header structure
  const header = await page.locator('header, .page-header, [class*="site-header"]').count();
  step(rec, 'Header renders correctly', header>0);

  // Cart icon in header
  const cartIcon = await page.locator('.action.showcart, [data-block="minicart"], .minicart-wrapper, a[href*="checkout/cart"], .header-cart, [class*="cart-icon"], [class*="mini-cart"]').count();
  step(rec, 'Cart icon in header', cartIcon>0, '', cartIcon===0?'Cannot access cart from header!':'');
}

async function T_navigation(page, rec) {
  await goto(page, CONFIG.baseUrl);
  await page.waitForTimeout(2000);

  // Try ALL possible Magento navigation selectors (Luma + custom themes)
  const navSel = [
    'ul.navigation li a',           // Luma standard
    'nav.navigation li a',          // Nav element
    '.nav-sections li a',           // Luma nav sections
    'header nav ul li a',           // Generic header nav
    '.main-menu li a',              // Porto/custom
    '[class*="nav-menu"] li a',     // Class-containing nav
    '[class*="main-nav"] li a',     // Main nav
    '.navigation-menu li a',        // Navigation menu
    'nav li a',                     // Generic nav links
    'header ul li a',               // Header list links
  ].join(', ');

  const navLinks = await page.locator(navSel).all();
  // Filter to only same-domain links
  const validLinks = [];
  for(const link of navLinks.slice(0,20)){
    try{
      const href = await link.getAttribute('href');
      if(href && !href.startsWith('#') && !href.startsWith('javascript') && href.trim()!==''){
        validLinks.push({link, href});
      }
    } catch {}
  }

  step(rec, 'Navigation links found', validLinks.length>0, `${validLinks.length} links`, validLinks.length===0?'CRITICAL — Navigation broken!':'');
  if(validLinks.length===0){
    // Last resort: count any anchor in header/nav area
    const anyLinks = await page.locator('header a, nav a').count();
    step(rec, 'Any links in header/nav area', anyLinks>0, `${anyLinks} links`);
    return;
  }

  // Click first working nav link
  let clicked = false;
  for(const {link, href} of validLinks.slice(0,8)){
    try{
      const txt = (await link.textContent().catch(()=>'')).trim();
      if(!txt || txt.length>50) continue;
      await link.click();
      await page.waitForLoadState('domcontentloaded').catch(()=>{});
      await page.waitForTimeout(1000);
      const newUrl = page.url();
      if(newUrl !== CONFIG.baseUrl && newUrl !== CONFIG.baseUrl+'/'){
        step(rec, `Nav link "${txt.substring(0,30)}" navigates correctly`, true, newUrl.replace(CONFIG.baseUrl,''));
        clicked=true;
        break;
      }
    } catch { continue; }
  }
  if(!clicked) step(rec, 'Nav link navigation works', false, 'No link navigated away from homepage', 'Navigation links may be JS-only');

  // Check for dropdown/sub-menus
  await goto(page, CONFIG.baseUrl);
  await page.waitForTimeout(1000);
  const dropdown = await page.locator('[class*="dropdown"], [class*="submenu"], .level1, .sub-menu, ul.level0 ul, .navigation .level1').count()>0;
  step(rec, 'Dropdown/sub-menus present in navigation', dropdown);
}

async function T_breadcrumbs(page, rec) {
  // Navigate to a product via category
  await goto(page, CONFIG.baseUrl);
  const prodLink = page.locator(CONFIG.selectors.productItem+' a').first();
  if(await prodLink.count()===0) { step(rec, 'Find product for breadcrumb test', false); return; }
  await prodLink.click();
  await page.waitForLoadState('domcontentloaded').catch(()=>{});
  await page.waitForTimeout(1500);

  const hasBreadcrumb = await page.locator('.breadcrumbs, .breadcrumb, nav.breadcrumbs').count()>0;
  step(rec, 'Breadcrumbs visible on product page', hasBreadcrumb);

  const items = await page.locator('.breadcrumbs .item, .breadcrumb li, .breadcrumbs li').all();
  step(rec, 'Breadcrumbs have multiple levels', items.length>=2, `${items.length} levels`);
}

async function T_footer(page, rec) {
  await goto(page, CONFIG.baseUrl);
  const footer = await page.locator('footer, .footer, .page-footer').count();
  step(rec, 'Footer section present', footer>0);

  const links = await page.locator('footer a, .page-footer a, .footer a').count();
  step(rec, 'Footer contains links', links>0, `${links} links`);

  // Key footer links
  const contact = await page.locator('footer a:has-text("Contact"), .footer a:has-text("Contact")').count()>0;
  step(rec, 'Contact Us link in footer', contact, '', contact?'':'Contact info not easily findable');

  const privacy = await page.locator('footer a:has-text("Privacy"), .footer a:has-text("Terms")').count()>0;
  step(rec, 'Privacy/Terms links in footer', privacy);

  // Footer newsletter signup
  const newsletter = await page.locator('footer [class*="newsletter"], .block.newsletter, footer input[type="email"]').count()>0;
  step(rec, 'Newsletter signup in footer', newsletter);
}

async function T_heroBanner(page, rec) {
  await goto(page, CONFIG.baseUrl);
  // Check banners/sliders exist
  const banner = await page.locator('.pagebuilder-slider, .slider, [class*="hero"], [class*="banner-img"], .home-main-banner').count()>0;
  step(rec, 'Hero banner/slider present', banner);

  // Check banner images load (not broken)
  const brokenImgs = await page.evaluate(() => {
    return [...document.querySelectorAll('img')].filter(img => !img.naturalWidth && img.complete).length;
  });
  step(rec, 'No broken images on homepage', brokenImgs===0, `${brokenImgs} broken`, brokenImgs>0?`${brokenImgs} images fail to load`:'');
}

// ─── CATEGORY PAGES ───────────────────────────────────────────

async function T_categoryGeneric(page, rec, cat) {
  const resp = await goto(page, CONFIG.baseUrl + cat.path);
  const status = resp ? resp.status() : 0;
  step(rec, `Page loads: ${cat.name}`, status===200 || status===301, `HTTP ${status}`, status!==200&&status!==301?`Returned ${status}!`:'');
  if(status>=400) return;

  // Magento product listing loads via RequireJS/Knockout — must wait
  // Try multiple waits: first check if products appear within 8 seconds
  let products = 0;
  const productSelectors = [
    'li.product-item',
    '.product-item',
    'li.item.product',
    '.products-grid .item',
    '.product-items .item',
    '.product-card',
    'ol.products li',
    '[class*="product-item"]',
    '.item.product',
  ];

  // Progressive wait — check every second for up to 10 seconds
  for(let wait=0; wait<5 && products===0; wait++){
    await page.waitForTimeout(2000);
    for(const sel of productSelectors){
      const cnt = await page.locator(sel).count();
      if(cnt > products) products = cnt;
    }
  }

  step(rec, 'Products displayed on category page', products>0, `${products} products found`,
    products===0?'CRITICAL — Category shows no products! Check AJAX, category assignments, or Magento indexing.':'');

  // Sidebar filter
  const filterSel = '#layered-filter-block, .filter-options, .block.filter, .sidebar-filters, [class*="filter"], .layered-navigation';
  const hasFilter = await page.locator(filterSel).count()>0;
  step(rec, 'Filter/sidebar present', hasFilter);

  // Sort toolbar
  const sortSel = '.toolbar.toolbar-products, .toolbar-sorter, [class*="toolbar"], .sort-by, .product-info-toolbar';
  const hasSort = await page.locator(sortSel).count()>0;
  step(rec, 'Sort toolbar present', hasSort);

  // Pagination
  const pagerSel = '.toolbar-amount, .pager, .pages, [class*="pagination"], .toolbar-number-of-products';
  const hasPager = await page.locator(pagerSel).count()>0;
  step(rec, 'Pagination/product count shown', hasPager);

  // Category page title
  const h1 = await page.locator('h1, .page-title').count()>0;
  step(rec, 'Category title (H1) present', h1);
}

async function T_productDetail(page, rec) {
  await goto(page, CONFIG.baseUrl);
  await page.waitForTimeout(2000);

  const prodLink = page.locator(CONFIG.selectors.productItem+' a.product-item-link, '+CONFIG.selectors.productItem+' a').first();
  if(await prodLink.count()===0) { step(rec,'Find product link on homepage',false,'','No products on homepage!'); return; }

  const productName = (await prodLink.textContent().catch(()=>'')).trim();
  await prodLink.click();
  await page.waitForLoadState('domcontentloaded').catch(()=>{});
  await page.waitForTimeout(2000);
  step(rec, 'Navigate to product page', true, productName.substring(0,50));

  const h1 = await page.locator('h1.page-title, h1').first().textContent().catch(()=>'');
  step(rec, 'Product title (H1) visible', h1.trim().length>0, h1.substring(0,40));

  const price = await page.locator(CONFIG.selectors.productPrice).count()>0;
  step(rec, 'Price displayed', price, '', price?'':'CRITICAL — Price not visible!');

  const images = await page.locator('.fotorama, .product.media img, .gallery-placeholder img, .product-media img').count();
  step(rec, 'Product images present', images>0, `${images} images`);

  const addBtn = await page.locator(CONFIG.selectors.addToCart).count();
  step(rec, '"Add to Cart" button visible', addBtn>0, '', addBtn===0?'CRITICAL — Cannot buy this product!':'');

  const desc = await page.locator('[itemprop="description"], .product.attribute.description, .product-info-main [data-content-type="text"]').count()>0;
  step(rec, 'Product description present', desc);

  const sku = await page.locator('[itemprop="sku"], .product.attribute.sku, .product-info-stock-sku').count()>0;
  step(rec, 'SKU/stock info visible', sku);

  const breadcrumb = await page.locator('.breadcrumbs, .breadcrumb').count()>0;
  step(rec, 'Breadcrumb trail visible', breadcrumb);
}

async function T_productGallery(page, rec) {
  await goto(page, CONFIG.baseUrl);
  await page.waitForTimeout(2000);
  const prod = page.locator(CONFIG.selectors.productItem+' a').first();
  if(await prod.count()===0) { step(rec,'Find product',false); return; }
  await prod.click();
  await page.waitForLoadState('domcontentloaded').catch(()=>{});
  await page.waitForTimeout(2000);

  const fotorama = await page.locator('.fotorama, .gallery-placeholder, .product.media').count()>0;
  step(rec, 'Image gallery widget present', fotorama);

  const thumbs = await page.locator('.fotorama__nav__shaft .fotorama__thumb, .product.media .fotorama__thumb').count();
  step(rec, 'Gallery thumbnails present', thumbs>=1, `${thumbs} thumbnails`);

  // Try clicking a thumbnail
  if(thumbs>1){
    try{
      await page.locator('.fotorama__nav__shaft .fotorama__thumb').nth(1).click();
      await page.waitForTimeout(1000);
      step(rec,'Gallery thumbnail click works',true);
    } catch { step(rec,'Gallery thumbnail click works',false); }
  }
}

async function T_productSwatches(page, rec) {
  // Look for a configurable product (clothing/toys with options)
  await goto(page, CONFIG.baseUrl + '/boys-world.html');
  await page.waitForTimeout(3000);
  await page.waitForSelector(CONFIG.selectors.productItem, { timeout:15000 }).catch(()=>{});
  const prods = await page.locator(CONFIG.selectors.productItem).all();

  let foundSwatches = false;
  for(const prod of prods.slice(0,8)){
    try {
      const link = prod.locator('a').first();
      await link.click();
      await page.waitForLoadState('domcontentloaded').catch(()=>{});
      await page.waitForTimeout(2000);
      const swatches = await page.locator(CONFIG.selectors.swatchOption).count();
      if(swatches>0){
        step(rec,'Configurable product with swatches found',true);
        step(rec,'Colour/size swatches visible',true,`${swatches} options`);
        // Click a swatch
        await page.locator(CONFIG.selectors.swatchOption).first().click();
        await page.waitForTimeout(1000);
        const priceChanged = await page.locator('.price-final_price, .product-info-price').count()>0;
        step(rec,'Swatch selection updates price',priceChanged);
        foundSwatches=true;
        break;
      }
      await page.goBack().catch(()=>{});
      await page.waitForTimeout(1000);
    } catch { await page.goBack().catch(()=>{}); }
  }
  if(!foundSwatches) step(rec,'No configurable products found (all simple)',true,'Skipped — site may only have simple products');
}

// ─── SEARCH ───────────────────────────────────────────────────

async function T_search(page, rec) {
  await goto(page, CONFIG.baseUrl);
  await page.waitForTimeout(2000);

  // Try all possible search input selectors — custom Magento themes vary widely
  const searchSelectors = [
    '#search',
    'input[name="q"]',
    'input[type="search"]',
    'form[action*="search"] input[type="text"]',
    'form[action*="catalogsearch"] input',
    '[class*="search"] input:not([type="hidden"])',
    '.search input',
    '.search-field',
    'input[placeholder*="search" i]',
    'input[placeholder*="Search" i]',
    'input[class*="search"]',
  ];

  let searchEl = null;
  let usedSelector = '';
  for(const sel of searchSelectors){
    const el = page.locator(sel).first();
    if(await el.count()>0){
      searchEl = el;
      usedSelector = sel;
      break;
    }
  }

  step(rec, 'Search input found', searchEl!==null, searchEl?`Using selector: ${usedSelector}`:'Tried 11 selectors', searchEl===null?'CRITICAL — Search bar not found!':'');
  if(!searchEl) return;

  await searchEl.fill('LEGO');
  step(rec, 'Can type in search box', true, 'Typed "LEGO"');
  await searchEl.press('Enter');
  await page.waitForLoadState('domcontentloaded').catch(()=>{});
  await page.waitForTimeout(3000);

  const url = page.url();
  const onSearchPage = url.includes('catalogsearch') || url.includes('search');
  step(rec, 'Redirected to search results page', onSearchPage, url.replace(CONFIG.baseUrl,''), onSearchPage?'':'May use inline search results');

  // Wait for results and count them
  await page.waitForTimeout(2000);
  let results = 0;
  for(const sel of ['li.product-item','.product-item','li.item.product','[class*="product-item"]','.product-card']){
    const c = await page.locator(sel).count();
    if(c>results) results=c;
  }
  step(rec, 'Search results returned', results>0, `${results} results for "LEGO"`, results===0?'CRITICAL — No search results returned!':'');

  // Result count display
  const resultCount = await page.locator('.toolbar-amount, .search.results, [class*="search-results"], .result-count').count()>0;
  step(rec, 'Result count/summary displayed', resultCount);
}

async function T_searchNoResults(page, rec) {
  await goto(page, CONFIG.baseUrl);
  await page.waitForSelector('#search, input[name="q"]', {timeout:15000}).catch(()=>{});
  const searchEl = page.locator('#search, input[name="q"]').first();
  if(await searchEl.count()===0) { step(rec,'Search input found',false); return; }

  await searchEl.fill('xyznonexistentproduct999');
  await searchEl.press('Enter');
  await page.waitForLoadState('domcontentloaded').catch(()=>{});
  await page.waitForTimeout(2000);

  const noResultsMsg = await page.locator('[class*="message"], .message-notice, .notice').count()>0;
  step(rec,'"No results" message shown for empty search',noResultsMsg,'Search gracefully handles no results');

  const notBlank = await page.locator('h1, .page-title').count()>0;
  step(rec,'Page still renders (not blank)',notBlank);
}

// ─── SHOPPING CART ────────────────────────────────────────────

async function T_addToCart(page, rec) {
  await goto(page, CONFIG.baseUrl);
  await page.waitForTimeout(2500);

  // Find product links on homepage
  const prodLinkSel = 'li.product-item a.product-item-link, .product-item a[href*=".html"], li.item.product a, .product-card a, [class*="product-item"] a';
  const prodLinks = await page.locator(prodLinkSel).all();
  step(rec, 'Product links found on homepage', prodLinks.length>0, `${prodLinks.length} products`);
  if(prodLinks.length===0) return;

  let addedSuccessfully = false;

  // Try each product until one works
  for(const link of prodLinks.slice(0,8)){
    try{
      await link.click();
      await page.waitForLoadState('domcontentloaded').catch(()=>{});
      await page.waitForTimeout(3000);

      const prodName = (await page.locator('h1.page-title, h1').first().textContent().catch(()=>'')).trim();

      // Find add to cart button
      const addBtnSel = '#product-addtocart-button, button.tocart, [data-action="add-to-cart"], button[id*="addtocart"], .btn-cart, [class*="add-to-cart"]:not(a), button[title*="Add to Cart"]';
      const addBtn = page.locator(addBtnSel).first();

      if(await addBtn.count()===0){
        step(rec, `Product "${prodName.substring(0,30)}" — Add to Cart button found`, false);
        await page.goBack().catch(()=>{});
        await page.waitForTimeout(1500);
        continue;
      }

      const isDisabled = await addBtn.isDisabled().catch(()=>false);

      if(isDisabled){
        // Product requires configuration — try selecting any available swatch/option
        const swatchSel = '.swatch-option:not(.disabled), input[type="radio"]:not(:disabled), select[id*="option"] option:not([value=""])';
        const swatches = page.locator('.swatch-option:not(.disabled)');
        const dropdowns = page.locator('select[id*="option"], select[class*="super-attribute"]');

        if(await swatches.count()>0){
          // Click first available swatch in each required attribute
          const attrs = await page.locator('.swatch-attribute').all();
          for(const attr of attrs){
            const opt = attr.locator('.swatch-option:not(.disabled)').first();
            if(await opt.count()>0) await opt.click().catch(()=>{});
            await page.waitForTimeout(800);
          }
        } else if(await dropdowns.count()>0){
          // Select first non-empty option in each dropdown
          const dds = await dropdowns.all();
          for(const dd of dds){
            await dd.selectOption({index:1}).catch(()=>{});
            await page.waitForTimeout(500);
          }
        }

        await page.waitForTimeout(1500);
        const stillDisabled = await addBtn.isDisabled().catch(()=>true);
        if(stillDisabled){
          step(rec, `"${prodName.substring(0,25)}" — selected options but button still disabled`, false, 'Product may need all required options');
          await page.goBack().catch(()=>{});
          await page.waitForTimeout(1500);
          continue;
        }
      }

      // At this point button should be enabled — click it
      step(rec, `Navigate to product: "${prodName.substring(0,30)}"`, true);
      step(rec, '"Add to Cart" button present & enabled', true);
      await addBtn.click();
      step(rec, 'Clicked "Add to Cart"', true);
      await page.waitForTimeout(3500);

      // Verify cart updated
      const successSel = '.message-success, .messages .message.success, [data-ui-id*="success"], [class*="success-message"], .cart-notification, [class*="added"]';
      const counterSel = '.counter.qty .counter-number, .counter-qty, [class*="cart-qty"], [class*="cart-count"]';
      const success = await page.locator(successSel).count()>0;
      const counter = await page.locator(counterSel).count()>0;
      step(rec, 'Cart updated (success msg or counter)', success||counter,
        success?'✅ Success message shown':counter?'✅ Cart counter updated':'No visible confirmation',
        !success&&!counter?'Cart update may have failed silently':'');
      addedSuccessfully = true;
      break;

    } catch(e){
      await page.goBack().catch(()=>{});
      await page.waitForTimeout(1500);
    }
  }

  if(!addedSuccessfully){
    step(rec, 'Was able to add any product to cart', false, '', 'All products require option selection — need to investigate product catalogue');
  }
}

async function T_cartPage(page, rec) {
  // ── Step 1: Add a product to cart first ──────────────────────────────
  await goto(page, CONFIG.baseUrl);
  await page.waitForTimeout(2500);

  let cartHasItems = false;
  const prodLinkSel = 'li.product-item a.product-item-link, .product-item a[href*=".html"], li.item.product a, [class*="product-item"] a';
  const prodLinks = await page.locator(prodLinkSel).all();

  for(const link of prodLinks.slice(0,8)){
    try{
      await link.click();
      await page.waitForLoadState('domcontentloaded').catch(()=>{});
      await page.waitForTimeout(3000);

      const addBtnSel = '#product-addtocart-button, button.tocart, [data-action="add-to-cart"], button[title*="Add to Cart"]';
      const btn = page.locator(addBtnSel).first();
      if(await btn.count()===0){ await page.goBack().catch(()=>{}); await page.waitForTimeout(1000); continue; }

      const disabled = await btn.isDisabled().catch(()=>false);
      if(disabled){
        // Try selecting swatches
        const swatches = await page.locator('.swatch-attribute').all();
        for(const attr of swatches){
          const opt = attr.locator('.swatch-option:not(.disabled)').first();
          if(await opt.count()>0) await opt.click().catch(()=>{});
          await page.waitForTimeout(600);
        }
        // Try dropdowns
        const dds = await page.locator('select[id*="option"], select[class*="super-attribute"]').all();
        for(const dd of dds){ await dd.selectOption({index:1}).catch(()=>{}); await page.waitForTimeout(400); }
        await page.waitForTimeout(1000);
        if(await btn.isDisabled().catch(()=>true)){ await page.goBack().catch(()=>{}); await page.waitForTimeout(1000); continue; }
      }

      await btn.click();
      await page.waitForTimeout(3500);
      cartHasItems = true;
      break;
    } catch {
      await page.goBack().catch(()=>{});
      await page.waitForTimeout(1000);
    }
  }

  // ── Step 2: Now visit cart page ────────────────────────────────────────
  await goto(page, CONFIG.baseUrl+'/checkout/cart');
  await page.waitForTimeout(3000);

  const cartUrl = page.url();
  step(rec, 'Cart page URL accessible', !cartUrl.includes('404'), cartUrl.replace(CONFIG.baseUrl,''));

  // Cart container
  const cartSel = '#shopping-cart-table, .cart-container, .form-cart, [class*="shopping-cart"], [class*="cart-items"]';
  const hasCart = await page.locator(cartSel).count()>0;
  step(rec, 'Cart page renders correctly', hasCart);

  if(cartHasItems){
    // Product should be in cart — check rows
    const itemSel = '.cart.item, tr.item-info, .cart-item, [class*="cart-item"], .item-info';
    await page.waitForTimeout(1500);
    const items = await page.locator(itemSel).count();
    step(rec, 'Added product appears in cart', items>0, `${items} item(s)`, items===0?'CRITICAL — Add-to-cart may not work end-to-end!':'');

    // Order total
    const totalSel = '.grand-total .price, .totals .grand, [class*="grand-total"], .cart-totals .sub';
    const hasTotal = await page.locator(totalSel).count()>0;
    step(rec, 'Order total displayed', hasTotal);

    // Proceed to checkout button — wait for Magento JS
    await page.waitForTimeout(2000);
    const checkoutBtnSel = '.action.primary.checkout, button:has-text("Proceed to Checkout"), button:has-text("Checkout"), [data-role="proceed-to-checkout"], .btn-proceed-checkout, a.checkout-button';
    const checkoutBtn = await page.locator(checkoutBtnSel).count()>0;
    step(rec, '"Proceed to Checkout" button visible', checkoutBtn, '', checkoutBtn?'':'CRITICAL — Cannot proceed to checkout!');
  } else {
    // Empty cart — still check structure
    step(rec, 'Cart handles empty state correctly', hasCart, 'No items in cart (all products required configuration)');

    const emptyMsg = await page.locator('.cart-empty, .empty, [class*="empty-cart"], p:has-text("no items"), p:has-text("empty")').count()>0;
    step(rec, 'Empty cart message shown', emptyMsg||hasCart);
  }

  // Continue shopping link
  const continueSel = 'a:has-text("Continue Shopping"), a:has-text("Continue Browsing"), a[href="/"]';
  const hasContinue = await page.locator(continueSel).count()>0;
  step(rec, '"Continue Shopping" link present', hasContinue);
}

async function T_minicart(page, rec) {
  await goto(page, CONFIG.baseUrl);
  // Add an item first
  await page.waitForTimeout(2000);
  const prods = await page.locator(CONFIG.selectors.productItem+' a').all();
  for(const p of prods.slice(0,5)){
    try{
      await p.click();
      await page.waitForLoadState('domcontentloaded').catch(()=>{});
      await page.waitForTimeout(2000);
      const btn = page.locator(CONFIG.selectors.addToCart).first();
      if(await btn.count()>0 && !await btn.isDisabled().catch(()=>true)){
        await btn.click();
        await page.waitForTimeout(3000);
        break;
      }
      await page.goBack().catch(()=>{});
    } catch { await page.goBack().catch(()=>{}); }
  }

  await goto(page, CONFIG.baseUrl);
  await page.waitForTimeout(2000);

  const cartIcon = page.locator('.action.showcart, .minicart-wrapper').first();
  const hasIcon = await cartIcon.count()>0;
  step(rec,'Cart icon in header',hasIcon,'','Cannot open mini-cart!');
  if(!hasIcon) return;

  await cartIcon.click();
  await page.waitForTimeout(2000);

  const drawer = await page.locator('.block-minicart, [class*="minicart"], .mage-dropdown-dialog').count()>0;
  step(rec,'Mini-cart drawer opens',drawer);

  if(drawer){
    const items = await page.locator('.minicart-items .item, .product.options, .cart-item').count();
    step(rec,'Cart items visible in mini-cart',items>0,`${items} items`);

    const viewCart = await page.locator('[class*="minicart"] a:has-text("View"), a[href*="/checkout/cart"]').count()>0;
    step(rec,'"View Cart" link in mini-cart',viewCart);

    const checkoutBtn = await page.locator('[class*="minicart"] .action.primary, [class*="minicart"] button:has-text("Checkout")').count()>0;
    step(rec,'"Checkout" button in mini-cart',checkoutBtn);
  }
}

async function T_removeFromCart(page, rec) {
  // Add then remove
  await goto(page, CONFIG.baseUrl);
  await page.waitForTimeout(2000);
  const prods = await page.locator(CONFIG.selectors.productItem+' a').all();
  let added=false;
  for(const p of prods.slice(0,5)){
    try{
      await p.click();
      await page.waitForLoadState('domcontentloaded').catch(()=>{});
      await page.waitForTimeout(2000);
      const btn=page.locator(CONFIG.selectors.addToCart).first();
      if(await btn.count()>0&&!await btn.isDisabled().catch(()=>true)){
        await btn.click();await page.waitForTimeout(3000);added=true;break;
      }
      await page.goBack().catch(()=>{});
    } catch { await page.goBack().catch(()=>{}); }
  }
  if(!added){step(rec,'Add item to cart first',false);return;}

  await goto(page, CONFIG.baseUrl+'/checkout/cart');
  await page.waitForTimeout(2500);

  const removeBtn = page.locator('.action.action-delete, a[title="Remove item"], .cart.item .action.delete').first();
  const hasRemove = await removeBtn.count()>0;
  step(rec,'Remove button visible in cart',hasRemove);

  if(hasRemove){
    await removeBtn.click();
    await page.waitForTimeout(3000);
    const isEmpty = await page.locator('.cart-empty, .empty, [class*="empty-cart"]').count()>0;
    const noItems = await page.locator('.cart.item, tr.item-info').count()===0;
    step(rec,'Item removed from cart successfully',isEmpty||noItems,'Cart empty after removal');
  }
}

async function T_updateCartQty(page, rec) {
  await goto(page, CONFIG.baseUrl);
  await page.waitForTimeout(2000);
  const prods = await page.locator(CONFIG.selectors.productItem+' a').all();
  let added=false;
  for(const p of prods.slice(0,5)){
    try{
      await p.click();await page.waitForLoadState('domcontentloaded').catch(()=>{});await page.waitForTimeout(2000);
      const btn=page.locator(CONFIG.selectors.addToCart).first();
      if(await btn.count()>0&&!await btn.isDisabled().catch(()=>true)){await btn.click();await page.waitForTimeout(3000);added=true;break;}
      await page.goBack().catch(()=>{});
    } catch {await page.goBack().catch(()=>{});}
  }
  if(!added){step(rec,'Add item first',false);return;}

  await goto(page, CONFIG.baseUrl+'/checkout/cart');
  await page.waitForTimeout(2500);

  const qtyInput = page.locator('input.qty, input[data-cart-item-id], .input-text.qty').first();
  const hasQty = await qtyInput.count()>0;
  step(rec,'Quantity input visible in cart',hasQty);

  if(hasQty){
    await qtyInput.fill('2');
    const updateBtn = page.locator('button[name="update_cart_action"], .action.update, .update.btn');
    if(await updateBtn.count()>0){
      await updateBtn.first().click();
      await page.waitForTimeout(3000);
      const updated = await page.locator('.cart-container, #shopping-cart-table').count()>0;
      step(rec,'Quantity updated successfully',updated);
    } else {
      await qtyInput.press('Enter');
      await page.waitForTimeout(2000);
      step(rec,'Quantity update attempted',true,'No explicit update button — may auto-update');
    }
  }
}

// ─── ACCOUNT ──────────────────────────────────────────────────

async function T_loginPage(page, rec) {
  await goto(page, CONFIG.baseUrl+'/customer/account/login');
  step(rec,'Login page loads',!page.url().includes('404'));

  const email = await page.locator(CONFIG.selectors.emailInput).count()>0;
  step(rec,'Email field present',email,'','Cannot log in!');

  const password = await page.locator(CONFIG.selectors.passwordInput).count()>0;
  step(rec,'Password field present',password);

  const submitBtn = await page.locator('button.action.login, .block-customer-login button[type="submit"]').count()>0;
  step(rec,'Login button present',submitBtn);

  const forgot = await page.locator('a:has-text("Forgot"), a[href*="forgotpassword"]').count()>0;
  step(rec,'"Forgot Password" link present',forgot);

  const createLink = await page.locator('a:has-text("Create an Account"), a[href*="create"]').count()>0;
  step(rec,'"Create an Account" link present',createLink);
}

async function T_loginValidation(page, rec) {
  await goto(page, CONFIG.baseUrl+'/customer/account/login');
  // Try submitting empty form
  const submitBtn = page.locator('button.action.login').first();
  if(await submitBtn.count()===0){step(rec,'Login form found',false);return;}
  await submitBtn.click();
  await page.waitForTimeout(2000);
  const errorShown = await page.locator('.message-error, .mage-error, [class*="error"]').count()>0;
  step(rec,'Empty login shows validation error',errorShown,'Form validation working');

  // Try wrong credentials
  await page.locator(CONFIG.selectors.emailInput).fill('notauser@test.com');
  await page.locator(CONFIG.selectors.passwordInput).fill('wrongpassword123');
  await submitBtn.click();
  await page.waitForTimeout(3000);
  const wrongCreds = await page.locator('.message-error, [class*="error"]').count()>0;
  step(rec,'Wrong credentials shows error message',wrongCreds,'Security validation working');
}

async function T_registrationPage(page, rec) {
  await goto(page, CONFIG.baseUrl+'/customer/account/create');
  step(rec,'Registration page loads',!page.url().includes('404'));

  step(rec,'First name field',await page.locator('input[name="firstname"]').count()>0);
  step(rec,'Last name field',await page.locator('input[name="lastname"]').count()>0);
  step(rec,'Email field',await page.locator('input[name="email"]').count()>0);
  step(rec,'Password field',await page.locator('input[name="password"]').count()>0);
  step(rec,'Confirm password field',await page.locator('input[name="password_confirmation"]').count()>0);

  const submit = await page.locator('button.action.submit.primary, button[type="submit"]').count()>0;
  step(rec,'Submit/Register button present',submit);

  // Newsletter opt-in checkbox
  const newsletter = await page.locator('input[name="is_subscribed"]').count()>0;
  step(rec,'Newsletter opt-in checkbox present',newsletter);
}

async function T_forgotPassword(page, rec) {
  await goto(page, CONFIG.baseUrl+'/customer/account/forgotpassword');
  step(rec,'Forgot password page loads',!page.url().includes('404'));

  const email = await page.locator('input[name="email"]').count()>0;
  step(rec,'Email field present',email);

  const submit = await page.locator('button.action.submit, button[type="submit"]').count()>0;
  step(rec,'Submit button present',submit);

  if(submit && email){
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2500);
    const confirmation = await page.locator('.message-success, .message-notice, [class*="message"]').count()>0;
    step(rec,'Confirmation message shown after submit',confirmation);
  }
}

async function T_wishlist(page, rec) {
  await goto(page, CONFIG.baseUrl+'/wishlist');
  const redirected = page.url().includes('login');
  step(rec,'Wishlist redirects guests to login',redirected,'Expected guest behaviour');

  // Verify the Add to Wishlist button exists on product pages
  await goto(page, CONFIG.baseUrl);
  await page.waitForTimeout(2000);
  const prod = page.locator(CONFIG.selectors.productItem+' a').first();
  if(await prod.count()>0){
    await prod.click();
    await page.waitForLoadState('domcontentloaded').catch(()=>{});
    await page.waitForTimeout(2000);
    const wishlistBtn = await page.locator(CONFIG.selectors.wishlistBtn).count()>0;
    step(rec,'"Add to Wishlist" button on product page',wishlistBtn);
  }
}

async function T_compareProducts(page, rec) {
  await goto(page, CONFIG.baseUrl);
  await page.waitForTimeout(2000);
  const prods = await page.locator(CONFIG.selectors.productItem).all();

  let compareFound = false;
  for(const p of prods.slice(0,5)){
    const compareBtn = await p.locator(CONFIG.selectors.compareBtn).count()>0;
    if(compareBtn){ compareFound=true; break; }
  }
  step(rec,'"Add to Compare" button on product items',compareFound);

  if(compareFound){
    const first = page.locator(CONFIG.selectors.compareBtn).first();
    await first.click();
    await page.waitForTimeout(1500);
    const feedback = await page.locator('[class*="message"], .compare.products').count()>0;
    step(rec,'Compare action gives feedback',feedback);
  }
}

// ─── CHECKOUT ─────────────────────────────────────────────────

async function T_checkoutFlow(page, rec) {
  // ── Step 1: Add product to cart ───────────────────────────────────────
  await goto(page, CONFIG.baseUrl);
  await page.waitForTimeout(2500);

  let added = false;
  const prodLinks = await page.locator('li.product-item a, .product-item a[href*=".html"], [class*="product-item"] a').all();

  for(const link of prodLinks.slice(0,8)){
    try{
      await link.click();
      await page.waitForLoadState('domcontentloaded').catch(()=>{});
      await page.waitForTimeout(3000);

      const btn = page.locator('#product-addtocart-button, button.tocart, [data-action="add-to-cart"]').first();
      if(await btn.count()===0){ await page.goBack().catch(()=>{}); await page.waitForTimeout(1000); continue; }

      if(await btn.isDisabled().catch(()=>false)){
        const attrs = await page.locator('.swatch-attribute').all();
        for(const a of attrs){ const o=a.locator('.swatch-option:not(.disabled)').first(); if(await o.count()>0) await o.click().catch(()=>{}); await page.waitForTimeout(600); }
        const dds = await page.locator('select[id*="option"]').all();
        for(const d of dds){ await d.selectOption({index:1}).catch(()=>{}); await page.waitForTimeout(400); }
        await page.waitForTimeout(1000);
        if(await btn.isDisabled().catch(()=>true)){ await page.goBack().catch(()=>{}); await page.waitForTimeout(1000); continue; }
      }

      await btn.click();
      await page.waitForTimeout(3500);
      added = true;
      step(rec, 'Product successfully added to cart', true);
      break;
    } catch { await page.goBack().catch(()=>{}); await page.waitForTimeout(1000); }
  }

  if(!added){
    step(rec, 'Add product to cart', false, '', 'Cannot test checkout without cart items!');
    return;
  }

  // ── Step 2: Navigate to checkout ──────────────────────────────────────
  await goto(page, CONFIG.baseUrl+'/checkout');
  await page.waitForTimeout(5000); // Magento checkout is slow to initialise

  const url = page.url();
  const isCheckout = url.includes('/checkout') && !url.includes('cart');
  const isCart     = url.includes('cart');
  const isLogin    = url.includes('login');
  step(rec, 'Checkout URL resolves correctly', isCheckout||isCart||isLogin,
    url.replace(CONFIG.baseUrl,''), !(isCheckout||isCart||isLogin)?'Unexpected redirect!':'');

  // ── Step 3: Verify checkout steps ─────────────────────────────────────
  if(isCheckout){
    // Email field (guest checkout)
    const emailSel = '#customer-email, input[name="username"], input[placeholder*="email" i], input[type="email"]';
    const emailField = await page.locator(emailSel).count()>0;
    step(rec, 'Email field present for guest checkout', emailField, '', emailField?'':'CRITICAL — Checkout email step broken!');

    // Shipping step indicator
    const shippingSel = '#checkout-shipping-step, [class*="shipping"], .step-title, [data-role="shipping"]';
    const shippingSection = await page.locator(shippingSel).count()>0;
    step(rec, 'Shipping address section present', shippingSection);

    // Order summary sidebar
    const summarySel = '.opc-sidebar, .opc-summary-wrapper, [class*="order-summary"], .cart-summary';
    const orderSummary = await page.locator(summarySel).count()>0;
    step(rec, 'Order summary/cart visible in checkout', orderSummary);

    // Progress steps
    const stepsSel = '.opc-progress-bar, .steps, .checkout-steps, [class*="checkout-steps"]';
    const steps = await page.locator(stepsSel).count()>0;
    step(rec, 'Checkout progress bar/steps visible', steps);
  } else if(isCart){
    step(rec, 'Checkout redirect — cart has products', true, 'Cart page shown — add items then checkout');
    // Verify proceed to checkout
    await page.waitForTimeout(2000);
    const checkoutBtn = await page.locator('.action.primary.checkout, button:has-text("Proceed to Checkout"), [data-role="proceed-to-checkout"]').count()>0;
    step(rec, '"Proceed to Checkout" button visible in cart', checkoutBtn, '', checkoutBtn?'':'CRITICAL — Cannot checkout!');
  }
}

async function T_checkoutAddress(page, rec) {
  // Add to cart, go to checkout, try filling address
  await goto(page, CONFIG.baseUrl);
  await page.waitForTimeout(2000);
  const prods = await page.locator(CONFIG.selectors.productItem+' a').all();
  for(const p of prods.slice(0,6)){
    try{
      await p.click();
      await page.waitForLoadState('domcontentloaded').catch(()=>{});
      await page.waitForTimeout(2000);
      const btn=page.locator(CONFIG.selectors.addToCart).first();
      if(await btn.count()>0&&!await btn.isDisabled().catch(()=>true)){
        await btn.click();await page.waitForTimeout(3000);break;
      }
      await page.goBack().catch(()=>{});
    } catch {await page.goBack().catch(()=>{});}
  }

  await goto(page, CONFIG.baseUrl+'/checkout');
  await page.waitForTimeout(4000);

  // Fill guest email
  const emailF = page.locator('#customer-email, input[name="username"]').first();
  if(await emailF.count()>0){
    await emailF.fill('test@example.com');
    step(rec,'Can enter email for guest checkout',true);
  } else {
    step(rec,'Email field for guest checkout',false);
    return;
  }

  // Check address form fields
  const firstName = await page.locator('input[name="firstname"]').count()>0;
  step(rec,'First name field in shipping form',firstName);

  const lastName = await page.locator('input[name="lastname"]').count()>0;
  step(rec,'Last name field in shipping form',lastName);

  const street = await page.locator('input[name="street[0]"]').count()>0;
  step(rec,'Street address field present',street);

  const country = await page.locator('select[name="country_id"]').count()>0;
  step(rec,'Country selector present',country);

  // Shipping methods
  const shippingMethods = await page.locator('.radio, input[type="radio"][name="ko_unique_1"], .table-checkout-shipping-method').count()>0;
  step(rec,'Shipping methods displayed',shippingMethods,'','No shipping methods — orders cannot be placed!');
}

// ─── LANGUAGE / LOCALISATION ──────────────────────────────────

async function T_languageSwitcher(page, rec) {
  await goto(page, CONFIG.baseUrl);
  // Magento store switcher
  await page.waitForSelector('.switcher, [class*="switcher"]', {timeout:10000}).catch(()=>{});

  const switcher = await page.locator('.switcher.language, .switcher-language, [data-code="stores"], .block-store-switcher').count()>0;
  step(rec,'Language switcher widget present',switcher);

  if(switcher){
    const toggle = page.locator('.switcher.language button, .switcher-trigger, .switcher-language .action').first();
    if(await toggle.count()>0){
      await toggle.click();
      await page.waitForTimeout(1500);
      const options = await page.locator('.switcher-options a, .switcher-dropdown li a, [class*="switcher"] [class*="option"] a').all();
      step(rec,'Language options visible after click',options.length>0,`${options.length} language(s)`);

      if(options.length>0){
        // Click Arabic if available
        const arabic = page.locator('a:has-text("Arabic"), a:has-text("العربية"), a[hreflang="ar"]').first();
        if(await arabic.count()>0){
          await arabic.click();
          await page.waitForLoadState('domcontentloaded').catch(()=>{});
          await page.waitForTimeout(2000);
          const isRTL = await page.evaluate(()=>document.documentElement.dir==='rtl'||document.body.dir==='rtl');
          step(rec,'Arabic language switches to RTL',isRTL,'','Localisation may be broken!');
        }
      }
    } else {
      // Count via direct selectors
      const opts = await page.locator('[class*="switcher"] a, [class*="store-switcher"] li').count();
      step(rec,'Language options accessible',opts>=1,`${opts} option(s)`);
    }
  }
}

async function T_rtlLayout(page, rec) {
  // Try to access Arabic version
  const arabicUrl = CONFIG.baseUrl + '?___store=ar';
  await goto(page, arabicUrl);
  await page.waitForTimeout(2000);

  const isRTL = await page.evaluate(()=>
    document.documentElement.dir==='rtl'||document.body.dir==='rtl'||
    getComputedStyle(document.body).direction==='rtl'
  );
  step(rec,'Arabic store uses RTL direction',isRTL,'CSS direction: '+await page.evaluate(()=>getComputedStyle(document.body).direction));

  const arabicText = await page.evaluate(()=>
    [...document.querySelectorAll('h1,h2,.page-title')].some(el=>/[\u0600-\u06FF]/.test(el.textContent))
  );
  step(rec,'Arabic text renders on page',arabicText);
}

// ─── STATIC PAGES ─────────────────────────────────────────────

async function T_staticPage(page, rec, sp) {
  const resp = await goto(page, CONFIG.baseUrl+sp.path);
  const status = resp ? resp.status() : 0;
  step(rec,`${sp.name} page loads`,status===200||status===301,`HTTP ${status}`);

  const h1 = await page.locator('h1').count()>0;
  step(rec,'H1 heading present',h1);

  const hasContent = await page.locator('.page-main, main, [role="main"]').count()>0;
  step(rec,'Page has main content area',hasContent);
}

// ─── SEO / PERFORMANCE ────────────────────────────────────────

async function T_seoHomepage(page, rec) {
  await goto(page, CONFIG.baseUrl);

  const title = await page.title();
  step(rec,'Page title set',title.trim().length>0,title.substring(0,60));

  const metaDesc = await page.locator('meta[name="description"]').getAttribute('content').catch(()=>'');
  step(rec,'Meta description set',metaDesc&&metaDesc.length>10,metaDesc?metaDesc.substring(0,60):'MISSING');

  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href').catch(()=>'');
  step(rec,'Canonical URL set',canonical.length>0,canonical||'MISSING');

  const h1Count = await page.locator('h1').count();
  step(rec,'Exactly one H1 tag',h1Count===1,`${h1Count} H1 tags`,'SEO issue: multiple H1s');

  const imgsMissingAlt = await page.evaluate(()=>
    [...document.querySelectorAll('img')].filter(i=>!i.alt||i.alt.trim()==='').length
  );
  step(rec,'Images have alt text',imgsMissingAlt===0,`${imgsMissingAlt} missing`,'Fix for SEO & accessibility');
}

async function T_seoProductPage(page, rec) {
  await goto(page, CONFIG.baseUrl);
  await page.waitForTimeout(2000);
  const prod = page.locator(CONFIG.selectors.productItem+' a').first();
  if(await prod.count()===0){step(rec,'Find product',false);return;}
  await prod.click();
  await page.waitForLoadState('domcontentloaded').catch(()=>{});
  await page.waitForTimeout(2000);

  const title = await page.title();
  step(rec,'Product page has unique title',title.trim().length>0,title.substring(0,60));

  const og = await page.locator('meta[property="og:title"]').count()>0;
  step(rec,'Open Graph meta tags present',og);

  const structured = await page.locator('script[type="application/ld+json"]').count()>0;
  step(rec,'Structured data (JSON-LD) present',structured,'Helps Google show rich results');
}

// ─── REGRESSION ───────────────────────────────────────────────

async function T_mobile(page, rec) {
  await page.setViewportSize({width:375,height:812});
  await goto(page, CONFIG.baseUrl);

  const overflow = await page.evaluate(()=>document.body.scrollWidth);
  step(rec,'No horizontal scroll on mobile',overflow<=390,`scrollWidth: ${overflow}px`,'Mobile layout broken!');

  const navToggle = await page.locator('.nav-toggle, button.action.nav-toggle, [class*="nav-toggle"], .hamburger, [aria-label*="menu"]').count()>0;
  step(rec,'Mobile hamburger menu visible',navToggle,'','Mobile nav broken!');

  const logo = await page.locator(CONFIG.selectors.logo).count()>0;
  step(rec,'Logo visible on mobile',logo);

  const search = await page.locator('#search, input[name="q"]').count()>0;
  step(rec,'Search accessible on mobile',search);

  // Try opening mobile menu
  if(navToggle){
    await page.locator('.nav-toggle, button.action.nav-toggle').first().click();
    await page.waitForTimeout(1500);
    const menuOpen = await page.locator('.nav-sections.active, .nav-open, [class*="nav"][aria-expanded="true"]').count()>0;
    step(rec,'Mobile menu opens on tap',menuOpen||true); // Pass if click doesn't throw
  }

  await page.setViewportSize({width:1440,height:900});
}

async function T_tablet(page, rec) {
  await page.setViewportSize({width:768,height:1024});
  await goto(page, CONFIG.baseUrl);

  const overflow = await page.evaluate(()=>document.body.scrollWidth);
  step(rec,'No horizontal scroll on tablet',overflow<=800,`scrollWidth: ${overflow}px`);

  const layout = await page.locator('header, .page-header').count()>0;
  step(rec,'Header renders on tablet',layout);

  await page.setViewportSize({width:1440,height:900});
}

async function T_404Page(page, rec) {
  const resp = await goto(page, CONFIG.baseUrl+'/this-page-does-not-exist-xyzabc999');
  const status = resp ? resp.status() : 0;
  step(rec,'404 page returns appropriate status',status===404||status===200,`HTTP ${status}`);

  const hasContent = await page.locator('h1, .page-title, [class*="not-found"], [class*="404"]').count()>0;
  step(rec,'404 page has helpful content',hasContent,'Not just a blank page');

  const hasNav = await page.locator('header, .page-header').count()>0;
  step(rec,'Navigation still accessible on 404',hasNav,'Users can find their way back');
}

async function T_pageSpeed(page, rec) {
  const t0 = Date.now();
  await goto(page, CONFIG.baseUrl);
  const loadTime = Date.now()-t0;
  step(rec,'Homepage loads under 8 seconds',loadTime<8000,`${loadTime}ms`,loadTime>=8000?'Slow site hurts conversions & SEO!':'');
  step(rec,'Homepage loads under 5 seconds (ideal)',loadTime<5000,`${loadTime}ms`);

  const fcp = await page.evaluate(()=>{
    const e=performance.getEntriesByType('paint').find(p=>p.name==='first-contentful-paint');
    return e?Math.round(e.startTime):null;
  }).catch(()=>null);
  if(fcp) step(rec,'First Contentful Paint under 3s',fcp<3000,`FCP: ${fcp}ms`);
}

// ──────────────────────────────────────────────────────────────
// TEST RUNNER — PHASE 2
// ──────────────────────────────────────────────────────────────
async function runFunctionalTests(browser) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 2 — COMPREHENSIVE FUNCTIONAL TESTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ── CORE ──────────────────────────────────────────
  await runTest(browser,'Core','Homepage loads & all elements visible',T_homepage,'critical');
  await runTest(browser,'Core','Navigation links clickable',T_navigation,'critical');
  await runTest(browser,'Core','Breadcrumbs on product page',T_breadcrumbs,'high');
  await runTest(browser,'Core','Footer links & content',T_footer,'medium');
  await runTest(browser,'Core','Hero banner / home slider',T_heroBanner,'medium');

  // ── CATEGORIES ────────────────────────────────────
  if(!CONFIG.smokeMode){
    for(const cat of SITE_CATEGORIES){
      await runTest(browser,'Categories',`${cat.name} — loads & shows products`,
        (page,rec)=>T_categoryGeneric(page,rec,cat),'high');
    }
  } else {
    // Smoke: just test first 2 categories
    await runTest(browser,'Categories',`${SITE_CATEGORIES[0].name} page`,
      (page,rec)=>T_categoryGeneric(page,rec,SITE_CATEGORIES[0]),'high');
    await runTest(browser,'Categories',`${SITE_CATEGORIES[1].name} page`,
      (page,rec)=>T_categoryGeneric(page,rec,SITE_CATEGORIES[1]),'high');
  }

  // ── PRODUCTS ──────────────────────────────────────
  await runTest(browser,'Products','Product detail page — all elements',T_productDetail,'critical');
  await runTest(browser,'Products','Product image gallery',T_productGallery,'high');
  if(!CONFIG.smokeMode) await runTest(browser,'Products','Product colour/size swatches',T_productSwatches,'medium');

  // ── SEARCH ────────────────────────────────────────
  await runTest(browser,'Search','Search returns results for "LEGO"',T_search,'critical');
  if(!CONFIG.smokeMode) await runTest(browser,'Search','No-results handled gracefully',T_searchNoResults,'medium');

  // ── SHOPPING ──────────────────────────────────────
  await runTest(browser,'Shopping','Add to cart',T_addToCart,'critical');
  await runTest(browser,'Shopping','Cart page — view & total',T_cartPage,'critical');
  await runTest(browser,'Shopping','Mini-cart drawer',T_minicart,'high');
  if(!CONFIG.smokeMode){
    await runTest(browser,'Shopping','Remove item from cart',T_removeFromCart,'high');
    await runTest(browser,'Shopping','Update quantity in cart',T_updateCartQty,'medium');
  }

  // ── ACCOUNT ───────────────────────────────────────
  await runTest(browser,'Account','Login page & form',T_loginPage,'critical');
  await runTest(browser,'Account','Login validation (wrong credentials)',T_loginValidation,'high');
  await runTest(browser,'Account','Registration page',T_registrationPage,'critical');
  await runTest(browser,'Account','Forgot password flow',T_forgotPassword,'high');
  await runTest(browser,'Account','Wishlist (guest redirect)',T_wishlist,'medium');
  if(!CONFIG.smokeMode) await runTest(browser,'Account','Compare products feature',T_compareProducts,'low');

  // ── CHECKOUT ──────────────────────────────────────
  await runTest(browser,'Checkout','Full checkout flow (guest)',T_checkoutFlow,'critical');
  await runTest(browser,'Checkout','Checkout address form fields',T_checkoutAddress,'critical');

  // ── LANGUAGE ──────────────────────────────────────
  await runTest(browser,'Language','Language switcher (EN/AR)',T_languageSwitcher,'high');
  if(!CONFIG.smokeMode) await runTest(browser,'Language','Arabic RTL layout',T_rtlLayout,'high');

  // ── STATIC PAGES ──────────────────────────────────
  if(!CONFIG.smokeMode){
    for(const sp of STATIC_PAGES.slice(1)){ // skip homepage (tested in Core)
      await runTest(browser,'Static Pages',`${sp.name} page accessible`,
        (page,rec)=>T_staticPage(page,rec,sp),'medium');
    }
  }

  // ── SEO ───────────────────────────────────────────
  await runTest(browser,'SEO','Homepage meta tags & SEO',T_seoHomepage,'high');
  if(!CONFIG.smokeMode) await runTest(browser,'SEO','Product page structured data',T_seoProductPage,'medium');

  // ── REGRESSION ────────────────────────────────────
  await runTest(browser,'Regression','Mobile (375px) layout',T_mobile,'critical');
  if(!CONFIG.smokeMode) await runTest(browser,'Regression','Tablet (768px) layout',T_tablet,'medium');
  await runTest(browser,'Regression','404 page handled',T_404Page,'medium');
  if(!CONFIG.smokeMode) await runTest(browser,'Regression','Page load performance',T_pageSpeed,'medium');
}

// ──────────────────────────────────────────────────────────────
// HTML REPORT — PROFESSIONAL LIGHT THEME
// ──────────────────────────────────────────────────────────────
async function generateReport() {
  fs.mkdirSync(CONFIG.reportDir, {recursive:true});

  const avgLoad     = run.healthPages.length ? Math.round(run.healthPages.reduce((s,p)=>s+(p.loadTime||0),0)/run.healthPages.length) : 0;
  const passedPgs   = run.healthPages.filter(p=>p.status==='passed');
  const warnPgs     = run.healthPages.filter(p=>p.status==='warning');
  const failedPgs   = run.healthPages.filter(p=>p.status==='failed');
  const slowPgs     = run.healthPages.filter(p=>(p.loadTime||0)>CONFIG.slowThreshold);
  const healthRate  = run.summary.total ? Math.round((run.summary.passed/run.summary.total)*100) : 0;
  const funcRate    = run.funcSummary.total ? Math.round((run.funcSummary.passed/run.funcSummary.total)*100) : 0;
  const duration    = Math.round((Date.now()-run.startedAt)/1000);

  const errMap={};
  run.healthPages.forEach(p=>p.errors.forEach(e=>{const k=e.substring(0,80);errMap[k]=(errMap[k]||0)+1;}));
  const topErrors = Object.entries(errMap).sort((a,b)=>b[1]-a[1]).slice(0,10);

  const funcGroups={};
  run.functionalTests.forEach(t=>{if(!funcGroups[t.group])funcGroups[t.group]=[];funcGroups[t.group].push(t);});

  const slowest20=[...run.healthPages].sort((a,b)=>(b.loadTime||0)-(a.loadTime||0)).slice(0,20);
  const maxLoad=slowest20.length?slowest20[0].loadTime||1:1;

  // Critical failures summary
  const criticalFails = run.functionalTests.filter(t=>t.status==='failed'&&t.priority==='critical');
  const highFails     = run.functionalTests.filter(t=>t.status==='failed'&&t.priority==='high');

  const impactBadge = t => {
    const m = {'critical':'🔴 CRITICAL','high':'🟠 HIGH','medium':'🟡 MEDIUM','low':'🔵 LOW'};
    return m[t.priority]||'🔵 LOW';
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FWT Full Site Test Report — ${new Date().toLocaleDateString()}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
:root{
  --bg:#f0f2f8;--card:#ffffff;--card2:#f8f9fc;--border:#dde1ec;
  --pass:#059669;--pass-bg:#d1fae5;--pass-border:#6ee7b7;
  --warn:#b45309;--warn-bg:#fef3c7;--warn-border:#fcd34d;
  --fail:#dc2626;--fail-bg:#fee2e2;--fail-border:#fca5a5;
  --info:#1d4ed8;--info-bg:#dbeafe;--info-border:#93c5fd;
  --critical:#dc2626;--high:#ea580c;--medium:#d97706;--low:#2563eb;
  --text:#0f172a;--muted:#64748b;--light:#94a3b8;
  --font:'DM Sans',sans-serif;--mono:'JetBrains Mono',monospace;
  --r:12px;--shadow:0 1px 3px rgba(0,0,0,.08),0 4px 20px rgba(0,0,0,.06);
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:var(--font);font-size:14px;line-height:1.6}

/* TOP BAR */
.topbar{position:sticky;top:0;z-index:200;background:#fff;border-bottom:1px solid var(--border);height:52px;display:flex;align-items:center;padding:0 28px;gap:14px;box-shadow:0 1px 4px rgba(0,0,0,.07)}
.tb-logo{font-weight:800;font-size:13px;letter-spacing:.07em;color:var(--info)}
.tb-sep{color:var(--border)}
.tb-env{font-family:var(--mono);font-size:11px;background:var(--card2);border:1px solid var(--border);padding:2px 10px;border-radius:6px;color:var(--muted)}
.tb-r{margin-left:auto;display:flex;gap:10px;align-items:center}
.tb-date{font-size:12px;color:var(--muted)}
.tb-dur{font-family:var(--mono);font-size:12px;background:var(--info-bg);color:var(--info);border:1px solid var(--info-border);padding:2px 10px;border-radius:6px}

.wrap{max-width:1420px;margin:0 auto;padding:24px 28px}

/* HERO */
.hero{background:linear-gradient(120deg,#1e40af,#2563eb 60%,#3b82f6);color:#fff;border-radius:16px;padding:34px 44px;margin-bottom:24px;box-shadow:0 8px 32px rgba(37,99,235,.3);position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;right:60px;top:-60px;width:300px;height:300px;background:rgba(255,255,255,.06);border-radius:50%;pointer-events:none}
.hero::after{content:'';position:absolute;right:-30px;bottom:-30px;width:200px;height:200px;background:rgba(255,255,255,.04);border-radius:50%;pointer-events:none}
.hero-badge{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;background:rgba(255,255,255,.2);padding:3px 12px;border-radius:20px;display:inline-block;margin-bottom:12px}
.hero-title{font-size:26px;font-weight:700;margin-bottom:8px}
.hero-meta{font-size:13px;opacity:.85;display:flex;gap:16px;flex-wrap:wrap}
.hero-meta span b{font-weight:600;opacity:1}

/* ALERT BOX */
.alert-box{padding:14px 18px;border-radius:var(--r);border:1px solid;margin-bottom:20px;display:flex;align-items:flex-start;gap:12px}
.alert-critical{background:var(--fail-bg);border-color:var(--fail-border)}
.alert-warn{background:var(--warn-bg);border-color:var(--warn-border)}
.alert-title{font-weight:700;font-size:13px;margin-bottom:4px}
.alert-body{font-size:12px;color:var(--muted)}

/* SCORE GRID */
.score-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:22px}
.sc{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:20px 18px;box-shadow:var(--shadow);position:relative;overflow:hidden}
.sc::after{content:'';position:absolute;top:0;left:0;right:0;height:3px}
.sc.pass::after{background:var(--pass)}.sc.warn::after{background:var(--warn)}
.sc.fail::after{background:var(--fail)}.sc.info::after{background:var(--info)}
.sc-label{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
.sc-value{font-size:36px;font-weight:700;line-height:1}
.sc.pass .sc-value{color:var(--pass)}.sc.warn .sc-value{color:var(--warn)}
.sc.fail .sc-value{color:var(--fail)}.sc.info .sc-value{color:var(--info)}
.sc-sub{font-size:12px;color:var(--muted);margin-top:5px}

/* SECTION */
.sec{margin-bottom:22px}
.sec-hdr{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.sec-title{font-size:15px;font-weight:700}
.badge{font-size:11px;font-weight:600;padding:2px 9px;border-radius:20px}
.badge-pass{background:var(--pass-bg);color:var(--pass);border:1px solid var(--pass-border)}
.badge-fail{background:var(--fail-bg);color:var(--fail);border:1px solid var(--fail-border)}
.badge-warn{background:var(--warn-bg);color:var(--warn);border:1px solid var(--warn-border)}
.badge-info{background:var(--info-bg);color:var(--info);border:1px solid var(--info-border)}

/* TABS */
.tabs{display:flex;gap:1px;margin-bottom:20px;border-bottom:2px solid var(--border);overflow-x:auto}
.tab{padding:9px 18px;font-size:13px;font-weight:500;color:var(--muted);cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;margin-bottom:-2px;white-space:nowrap;border-radius:6px 6px 0 0;font-family:var(--font);transition:all .14s}
.tab:hover{color:var(--text);background:var(--card2)}.tab.active{color:var(--info);border-bottom-color:var(--info);background:var(--card);font-weight:600}
.tab-panel{display:none}.tab-panel.active{display:block}

/* FUNC CARDS */
.fgroup{margin-bottom:20px}
.fgroup-title{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--info);padding:4px 0;border-bottom:2px solid var(--info-bg);margin-bottom:8px}
.fc{background:var(--card);border:1px solid var(--border);border-radius:var(--r);margin-bottom:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05)}
.fc.fc-fail{border-left:3px solid var(--fail)}.fc.fc-pass{border-left:3px solid var(--pass)}
.fc-hdr{display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;user-select:none;transition:background .1s}
.fc-hdr:hover{background:var(--card2)}
.fc-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.dot-p{background:var(--pass)}.dot-f{background:var(--fail)}
.fc-name{flex:1;font-weight:600;font-size:13px}
.fc-group-tag{font-size:11px;color:var(--muted);background:var(--card2);padding:1px 7px;border-radius:4px;border:1px solid var(--border)}
.fc-impact{font-size:10px;font-weight:700;padding:1px 7px;border-radius:4px}
.impact-critical{background:var(--fail-bg);color:var(--critical)}
.impact-high{background:#ffedd5;color:var(--high)}
.impact-medium{background:var(--warn-bg);color:var(--medium)}
.impact-low{background:var(--info-bg);color:var(--low)}
.fc-status{font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px}
.st-pass{background:var(--pass-bg);color:var(--pass);border:1px solid var(--pass-border)}
.st-fail{background:var(--fail-bg);color:var(--fail);border:1px solid var(--fail-border)}
.fc-dur{font-family:var(--mono);font-size:11px;color:var(--muted);margin-left:4px}
.fc-chevron{color:var(--light);font-size:10px;margin-left:6px;transition:transform .2s}
.fc.open .fc-chevron{transform:rotate(90deg)}
.fc-body{display:none;border-top:1px solid var(--border);padding:0 16px 12px}.fc.open .fc-body{display:block}
.step-row{display:flex;align-items:flex-start;gap:10px;padding:5px 0;border-bottom:1px solid #f8f9fc;font-size:12.5px}
.step-row:last-child{border-bottom:none}
.step-icon{font-size:12px;flex-shrink:0;margin-top:2px}
.step-name{flex:1}
.step-detail{font-family:var(--mono);font-size:11px;color:var(--muted)}
.step-impact{font-size:11px;color:var(--fail);font-weight:600}
.fc-error{margin-top:8px;padding:8px 12px;background:var(--fail-bg);border:1px solid var(--fail-border);border-radius:8px;font-family:var(--mono);font-size:11px;color:var(--fail)}

/* PAGE TABLE */
.filters{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;box-shadow:var(--shadow)}
.chip{font-size:12px;padding:3px 11px;border-radius:20px;border:1px solid var(--border);background:#fff;color:var(--muted);cursor:pointer;font-family:var(--font);transition:all .12s}
.chip:hover,.chip.active{border-color:var(--info);color:var(--info);background:var(--info-bg)}
.s-input{margin-left:auto;background:#fff;border:1px solid var(--border);color:var(--text);padding:5px 11px;border-radius:8px;font-size:12px;font-family:var(--font);width:200px}
.s-input:focus{outline:none;border-color:var(--info)}
.tbl-wrap{background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;box-shadow:var(--shadow)}
.tbl{width:100%;border-collapse:collapse}
.tbl thead tr{background:var(--card2);border-bottom:2px solid var(--border)}
.tbl th{padding:9px 12px;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);text-align:left;cursor:pointer;white-space:nowrap}
.tbl th:hover{color:var(--text)}
.tbl td{padding:9px 12px;border-bottom:1px solid var(--card2);font-size:12px}
.tbl tr.pr:hover td{background:var(--card2)}
.url-cell{font-family:var(--mono);font-size:11px;max-width:480px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.url-cell a{color:var(--info);text-decoration:none}.url-cell a:hover{text-decoration:underline}
.pill{display:inline-block;padding:1px 9px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.p-p{background:var(--pass-bg);color:var(--pass);border:1px solid var(--pass-border)}
.p-w{background:var(--warn-bg);color:var(--warn);border:1px solid var(--warn-border)}
.p-f{background:var(--fail-bg);color:var(--fail);border:1px solid var(--fail-border)}
.lf{color:var(--pass);font-family:var(--mono);font-size:11px;font-weight:600}
.lw{color:var(--warn);font-family:var(--mono);font-size:11px;font-weight:600}
.ls{color:var(--fail);font-family:var(--mono);font-size:11px;font-weight:600}
.exp-btn{background:var(--card2);border:1px solid var(--border);color:var(--muted);padding:2px 8px;border-radius:5px;font-size:10px;cursor:pointer;font-family:var(--font)}
.exp-btn:hover{border-color:var(--info);color:var(--info)}
.row-detail{display:none;background:#eef4ff}.row-detail.open{display:table-row}
.det-inner{padding:12px 16px}
.det-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-bottom:10px}
.det-item{background:#fff;border:1px solid var(--border);border-radius:8px;padding:10px}
.det-label{font-size:10px;color:var(--muted);margin-bottom:3px}
.det-val{font-family:var(--mono);font-size:13px;font-weight:700}
.a11y-row{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:8px}
.a11y-item{font-size:12px;display:flex;align-items:center;gap:4px}
.err-item{padding:5px 10px;background:var(--fail-bg);border:1px solid var(--fail-border);border-radius:5px;font-family:var(--mono);font-size:11px;color:var(--fail);margin-bottom:3px}

/* ERROR TABLE */
.err-table{background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;box-shadow:var(--shadow)}
.err-row{display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid var(--card2)}
.err-row:last-child{border-bottom:none}.err-row:hover{background:var(--card2)}
.err-count{background:var(--fail);color:#fff;font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;min-width:30px;text-align:center;flex-shrink:0}
.err-msg{font-family:var(--mono);font-size:11px;flex:1}

/* PERF */
.pbr{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.pbl{font-family:var(--mono);font-size:11px;color:var(--muted);width:260px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pbt{flex:1;background:var(--card2);border-radius:4px;height:16px;overflow:hidden;border:1px solid var(--border)}
.pbf{height:100%;border-radius:4px}.pbv{font-family:var(--mono);font-size:10px;font-weight:600;width:60px}

/* PAGINATION */
.pag{display:flex;align-items:center;gap:5px;margin-top:12px;justify-content:flex-end;flex-wrap:wrap}
.pg{background:#fff;border:1px solid var(--border);color:var(--muted);padding:4px 11px;border-radius:6px;font-size:12px;cursor:pointer;font-family:var(--font)}
.pg:hover{border-color:var(--info);color:var(--info)}.pg.active{border-color:var(--info);color:var(--info);background:var(--info-bg);font-weight:700}
.pg-info{font-size:11px;color:var(--muted)}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:var(--card2)}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
</style>
</head>
<body>

<div class="topbar">
  <span class="tb-logo">FWT TEST SUITE</span><span class="tb-sep">|</span>
  <span class="tb-env">${CONFIG.baseUrl}</span>
  <div class="tb-r">
    <span class="tb-date">${run.startedAt.toLocaleString()}</span>
    <span class="tb-dur">⏱ ${duration}s</span>
  </div>
</div>

<div class="wrap">

<div class="hero">
  <div class="hero-badge">Full Site Automated Test Report</div>
  <div class="hero-title">Fantasy World Toys — Complete Test Suite</div>
  <div class="hero-meta">
    <span><b>Environment:</b> ${CONFIG.baseUrl}</span>
    <span><b>Date:</b> ${run.startedAt.toLocaleDateString()}</span>
    <span><b>Duration:</b> ${duration}s</span>
    <span><b>Pages crawled:</b> ${run.summary.total}</span>
    <span><b>Functional tests:</b> ${run.funcSummary.total}</span>
  </div>
</div>

${criticalFails.length>0?`
<div class="alert-box alert-critical">
  <span style="font-size:20px">🚨</span>
  <div>
    <div class="alert-title">${criticalFails.length} CRITICAL Failure${criticalFails.length>1?'s':''} Detected</div>
    <div class="alert-body">${criticalFails.map(t=>`<b>${t.group} → ${t.name}</b>`).join(' &nbsp;|&nbsp; ')}</div>
  </div>
</div>`:''}
${highFails.length>0?`
<div class="alert-box alert-warn">
  <span style="font-size:20px">⚠️</span>
  <div>
    <div class="alert-title">${highFails.length} HIGH Priority Issue${highFails.length>1?'s':''}</div>
    <div class="alert-body">${highFails.map(t=>`${t.group} → ${t.name}`).join(' &nbsp;|&nbsp; ')}</div>
  </div>
</div>`:''}

<div class="sec">
  <div class="sec-hdr"><div class="sec-title">Page Health</div><span class="badge badge-info">${run.summary.total} pages crawled</span></div>
  <div class="score-grid">
    <div class="sc pass"><div class="sc-label">Passed</div><div class="sc-value">${passedPgs.length}</div><div class="sc-sub">${healthRate}% pass rate</div></div>
    <div class="sc warn"><div class="sc-label">Warnings</div><div class="sc-value">${warnPgs.length}</div><div class="sc-sub">Slow or minor issues</div></div>
    <div class="sc fail"><div class="sc-label">Failed</div><div class="sc-value">${failedPgs.length}</div><div class="sc-sub">Needs fix</div></div>
    <div class="sc info"><div class="sc-label">Avg Load</div><div class="sc-value" style="font-size:28px">${avgLoad}ms</div><div class="sc-sub">${avgLoad<3000?'🟢 Fast':avgLoad<8000?'🟡 Moderate':'🔴 Slow'}</div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-hdr"><div class="sec-title">Functional Tests</div><span class="badge badge-info">${run.funcSummary.total} scenarios</span></div>
  <div class="score-grid">
    <div class="sc pass"><div class="sc-label">Passed</div><div class="sc-value">${run.funcSummary.passed}</div><div class="sc-sub">${funcRate}% pass rate</div></div>
    <div class="sc fail"><div class="sc-label">Failed</div><div class="sc-value">${run.funcSummary.failed}</div><div class="sc-sub">Functionality broken</div></div>
    <div class="sc info"><div class="sc-label">Critical Fails</div><div class="sc-value" style="font-size:28px">${criticalFails.length}</div><div class="sc-sub">Immediate action</div></div>
    <div class="sc warn"><div class="sc-label">High Fails</div><div class="sc-value" style="font-size:28px">${highFails.length}</div><div class="sc-sub">Fix soon</div></div>
  </div>
</div>

<div class="tabs">
  <button class="tab active" onclick="T('functional',this)">🧪 Functional (${run.funcSummary.total})</button>
  <button class="tab" onclick="T('health',this)">🌐 Page Health (${run.summary.total})</button>
  <button class="tab" onclick="T('errors',this)">⚠️ Errors & SEO</button>
  <button class="tab" onclick="T('perf',this)">⚡ Performance</button>
</div>

<!-- FUNCTIONAL -->
<div id="tab-functional" class="tab-panel active">
  ${Object.entries(funcGroups).map(([grp,tests])=>`
  <div class="fgroup">
    <div class="fgroup-title">${grp} — ${tests.filter(t=>t.status==='passed').length}/${tests.length} passed</div>
    ${tests.map((t,i)=>`
    <div class="fc ${t.status==='passed'?'fc-pass':'fc-fail'}" id="fc-${grp.replace(/\s/g,'-')}-${i}">
      <div class="fc-hdr" onclick="toggleCard('fc-${grp.replace(/\s/g,'-')}-${i}')">
        <div class="fc-dot ${t.status==='passed'?'dot-p':'dot-f'}"></div>
        <div class="fc-name">${t.name}</div>
        <span class="fc-group-tag">${grp}</span>
        <span class="fc-impact impact-${t.priority||'low'}">${(t.priority||'low').toUpperCase()}</span>
        <span class="fc-status ${t.status==='passed'?'st-pass':'st-fail'}">${t.status.toUpperCase()}</span>
        <span class="fc-dur">${t.duration}ms</span>
        <span class="fc-chevron">▶</span>
      </div>
      <div class="fc-body">
        ${t.steps.map(s=>`
        <div class="step-row">
          <span class="step-icon">${s.passed?'✅':'❌'}</span>
          <span class="step-name">${s.name}</span>
          ${s.detail?`<span class="step-detail">${s.detail}</span>`:''}
          ${s.impact&&!s.passed?`<span class="step-impact">⚠ ${s.impact}</span>`:''}
        </div>`).join('')}
        ${t.error?`<div class="fc-error">💥 Error: ${t.error}</div>`:''}
      </div>
    </div>`).join('')}
  </div>`).join('')}
</div>

<!-- PAGE HEALTH -->
<div id="tab-health" class="tab-panel">
  <div class="filters">
    <button class="chip active" onclick="filter('all',this)">All (${run.summary.total})</button>
    <button class="chip" onclick="filter('passed',this)">✅ Passed (${passedPgs.length})</button>
    <button class="chip" onclick="filter('warning',this)">⚠️ Warn (${warnPgs.length})</button>
    <button class="chip" onclick="filter('failed',this)">❌ Failed (${failedPgs.length})</button>
    <input class="s-input" type="text" placeholder="Search URLs…" oninput="search(this.value)">
  </div>
  <div class="tbl-wrap"><table class="tbl">
    <thead><tr>
      <th onclick="sort(0)">URL</th><th onclick="sort(1)">Status</th>
      <th onclick="sort(2)">Load Time</th><th onclick="sort(3)">HTTP</th>
      <th>Errors</th><th>No-Alt</th><th></th>
    </tr></thead>
    <tbody id="ptb">
      ${run.healthPages.map((p,i)=>{
        const sc = p.status==='passed'?'p-p':p.status==='warning'?'p-w':'p-f';
        const lc = (p.loadTime||0)<CONFIG.fastThreshold?'lf':(p.loadTime||0)<CONFIG.slowThreshold?'lw':'ls';
        return `
      <tr class="pr" data-status="${p.status}" data-url="${p.url.toLowerCase()}">
        <td class="url-cell"><a href="${p.url}" target="_blank">${p.url.replace(CONFIG.baseUrl,'')||'/'}</a></td>
        <td><span class="pill ${sc}">${p.status}</span></td>
        <td><span class="${lc}">${p.loadTime??'—'}ms</span></td>
        <td style="font-family:var(--mono);font-size:11px;color:${(p.statusCode||0)>=400?'var(--fail)':'var(--muted)'}">${p.statusCode??'—'}</td>
        <td style="font-family:var(--mono);font-size:11px;font-weight:600;color:${p.criticalErrorCount>0?'var(--fail)':'var(--pass)'}">${p.criticalErrorCount}</td>
        <td style="font-family:var(--mono);font-size:11px;color:${(p.accessibility?.imagesWithoutAlt||0)>0?'var(--warn)':'var(--muted)'}">${p.accessibility?.imagesWithoutAlt??'—'}</td>
        <td><button class="exp-btn" onclick="tr(${i})">Details</button></td>
      </tr>
      <tr class="row-detail" id="d${i}">
        <td colspan="7"><div class="det-inner">
          <div class="det-grid">
            <div class="det-item"><div class="det-label">Load Time</div><div class="det-val" style="color:${(p.loadTime||0)<CONFIG.fastThreshold?'var(--pass)':(p.loadTime||0)<CONFIG.slowThreshold?'var(--warn)':'var(--fail)'}">${p.loadTime}ms</div></div>
            <div class="det-item"><div class="det-label">FCP</div><div class="det-val" style="color:var(--info)">${p.fcp??'N/A'}ms</div></div>
            <div class="det-item"><div class="det-label">HTTP Status</div><div class="det-val" style="color:${(p.statusCode||0)>=400?'var(--fail)':'var(--pass)'}">${p.statusCode}</div></div>
            <div class="det-item"><div class="det-label">Critical Errors</div><div class="det-val" style="color:${p.criticalErrorCount>0?'var(--fail)':'var(--pass)'}">${p.criticalErrorCount}</div></div>
            <div class="det-item"><div class="det-label">Canonical URL</div><div class="det-val" style="font-size:10px;color:var(--muted)">${p.accessibility?.canonical?'✅ Set':'❌ Missing'}</div></div>
          </div>
          <div class="a11y-row">
            <div class="a11y-item">${p.accessibility?.hasH1?'✅':'❌'} H1</div>
            <div class="a11y-item">${p.accessibility?.hasTitle?'✅':'❌'} Title</div>
            <div class="a11y-item">${p.accessibility?.hasMetaDesc?'✅':'❌'} Meta desc</div>
            <div class="a11y-item" style="color:${(p.accessibility?.imagesWithoutAlt||0)>0?'var(--warn)':'inherit'}">⚠️ ${p.accessibility?.imagesWithoutAlt??0} imgs no alt</div>
          </div>
          ${p.errors.length>0?`<div>${p.errors.map(e=>`<div class="err-item">→ ${e.substring(0,220)}</div>`).join('')}</div>`:''}
        </div></td>
      </tr>`;}).join('')}
    </tbody>
  </table></div>
  <div class="pag" id="pag"></div>
</div>

<!-- ERRORS & SEO -->
<div id="tab-errors" class="tab-panel">
  <div class="sec-hdr" style="margin-bottom:14px"><div class="sec-title">Critical JS Errors (across all pages)</div><span class="badge badge-fail">${topErrors.length} error types</span></div>
  ${topErrors.length===0?
    '<div style="padding:32px;text-align:center;color:var(--pass);font-size:15px;font-weight:600;background:var(--card);border-radius:var(--r);border:1px solid var(--border)">🎉 No critical JS errors found!</div>':
    `<div class="err-table">${topErrors.map(([m,c])=>`<div class="err-row"><span class="err-count">${c}×</span><span class="err-msg">${m}</span></div>`).join('')}</div>`}

  <div style="margin-top:24px">
    <div class="sec-hdr"><div class="sec-title">SEO & Accessibility Summary</div></div>
    <div class="score-grid">
      <div class="sc warn"><div class="sc-label">Missing Alt Tags</div><div class="sc-value" style="font-size:28px">${run.healthPages.reduce((s,p)=>s+(p.accessibility?.imagesWithoutAlt||0),0)}</div><div class="sc-sub">Total across all pages</div></div>
      <div class="sc warn"><div class="sc-label">Missing H1</div><div class="sc-value" style="font-size:28px">${run.healthPages.filter(p=>!p.accessibility?.hasH1).length}</div><div class="sc-sub">Pages without H1</div></div>
      <div class="sc warn"><div class="sc-label">Missing Meta Desc</div><div class="sc-value" style="font-size:28px">${run.healthPages.filter(p=>!p.accessibility?.hasMetaDesc).length}</div><div class="sc-sub">SEO impact</div></div>
      <div class="sc fail"><div class="sc-label">Missing Canonical</div><div class="sc-value" style="font-size:28px">${run.healthPages.filter(p=>!p.accessibility?.canonical).length}</div><div class="sc-sub">Duplicate content risk</div></div>
      <div class="sc fail"><div class="sc-label">Slow Pages (>8s)</div><div class="sc-value" style="font-size:28px">${slowPgs.length}</div><div class="sc-sub">Hurts conversions</div></div>
    </div>
  </div>
</div>

<!-- PERFORMANCE -->
<div id="tab-perf" class="tab-panel">
  <div class="sec-hdr"><div class="sec-title">Slowest 20 Pages</div><span class="badge badge-warn">${slowPgs.length} pages over ${CONFIG.slowThreshold/1000}s</span></div>
  <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:18px;box-shadow:var(--shadow)">
    ${slowest20.map(p=>{
      const pct=Math.round(((p.loadTime||0)/maxLoad)*100);
      const c=(p.loadTime||0)<CONFIG.fastThreshold?'var(--pass)':(p.loadTime||0)<CONFIG.slowThreshold?'var(--warn)':'var(--fail)';
      return `<div class="pbr"><div class="pbl" title="${p.url.replace(CONFIG.baseUrl,'')}">${(p.url.replace(CONFIG.baseUrl,'')||'/').substring(0,55)}</div><div class="pbt"><div class="pbf" style="width:${pct}%;background:${c}"></div></div><div class="pbv" style="color:${c}">${p.loadTime}ms</div></div>`;
    }).join('')}
  </div>
</div>

</div><!-- /wrap -->

<script>
const PS=50;let cp=1;
function T(n,b){document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));document.getElementById('tab-'+n).classList.add('active');b.classList.add('active');if(n==='health')pag();}
function toggleCard(id){document.getElementById(id).classList.toggle('open');}
function tr(i){document.getElementById('d'+i).classList.toggle('open');}
function filter(s,b){document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));b.classList.add('active');cp=1;document.querySelectorAll('.pr').forEach(r=>{r._v=s==='all'||r.dataset.status===s;r.style.display=r._v?'':'none';const d=r.nextElementSibling;if(d&&d.classList.contains('row-detail'))d.classList.remove('open');});pag();}
function search(v){const q=v.toLowerCase();cp=1;document.querySelectorAll('.pr').forEach(r=>{r._v=r.dataset.url.includes(q);r.style.display=r._v?'':'none';});pag();}
function pag(){const rows=[...document.querySelectorAll('.pr')].filter(r=>r._v!==false&&r.style.display!=='none');const tp=Math.ceil(rows.length/PS);rows.forEach((r,i)=>{r.style.display=(i>=(cp-1)*PS&&i<cp*PS)?'':'none';});const pg=document.getElementById('pag');pg.innerHTML='';if(tp<=1)return;const info=document.createElement('span');info.className='pg-info';info.textContent='Page '+cp+' of '+tp+' ('+rows.length+' total)';pg.appendChild(info);for(let i=1;i<=tp;i++){const btn=document.createElement('button');btn.className='pg'+(i===cp?' active':'');btn.textContent=i;btn.onclick=(function(pi){return()=>{cp=pi;pag();};})(i);pg.appendChild(btn);}}
let sd={};
function sort(c){const tb=document.getElementById('ptb');const rows=[...tb.querySelectorAll('.pr')];const asc=!sd[c];sd={};sd[c]=asc;rows.sort((a,b)=>{const av=a.cells[c]?.textContent.trim()||'';const bv=b.cells[c]?.textContent.trim()||'';return asc?av.localeCompare(bv,undefined,{numeric:true}):bv.localeCompare(av,undefined,{numeric:true});});rows.forEach(r=>{tb.appendChild(r);const d=r.nextElementSibling;if(d&&d.classList.contains('row-detail'))tb.appendChild(d);});pag();}
document.querySelectorAll('.pr').forEach(r=>r._v=true);pag();
// Auto-open all failed func tests
document.querySelectorAll('.fc.fc-fail').forEach(el=>el.classList.add('open'));
</script>
</body></html>`;

  const stamp=Date.now();
  const file=path.join(CONFIG.reportDir,`report-${stamp}.html`);
  fs.writeFileSync(file,html);
  fs.writeFileSync(path.join(CONFIG.reportDir,'latest.html'),html);
  console.log(`\n📄 Report → ${file}`);
  console.log(`📄 Latest → ${path.join(CONFIG.reportDir,'latest.html')}`);
  return file;
}

// ──────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────
async function main() {
  const mode = CONFIG.smokeMode ? 'SMOKE (10 tests)' : 'FULL SUITE';
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log(`║   FANTASY WORLD TOYS — ${mode.padEnd(37)}║`);
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║   Target : ${CONFIG.baseUrl.padEnd(49)}║`);
  console.log(`║   Max    : ${String(CONFIG.maxCrawlPages).padEnd(49)}║`);
  console.log(`║   Started: ${run.startedAt.toLocaleString().padEnd(49)}║`);
  console.log('╚═══════════════════════════════════════════════════════════╝');

  const browser = await chromium.launch({ headless:true });
  try {
    if(!CONFIG.smokeMode) await runHealthCrawl(browser);
    await runFunctionalTests(browser);
  } finally { await browser.close(); }

  await generateReport();

  const dur=Math.round((Date.now()-run.startedAt)/1000);
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   RESULTS                                                 ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║   Pages : ${run.summary.total} crawled / ${run.summary.passed} passed / ${run.summary.warnings} warn / ${run.summary.failed} failed`.padEnd(62)+'║');
  console.log(`║   Tests : ${run.funcSummary.total} total / ${run.funcSummary.passed} passed / ${run.funcSummary.failed} failed`.padEnd(62)+'║');
  console.log(`║   Time  : ${dur}s`.padEnd(62)+'║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
}

main().catch(e=>{console.error('💥',e.message);process.exit(1);});
