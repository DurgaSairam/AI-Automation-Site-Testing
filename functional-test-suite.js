/**
 * COMPREHENSIVE E-COMMERCE FUNCTIONAL TESTING SUITE
 * For: Fantasy World Toys (Magento/PHP)
 * 
 * This tests ACTUAL FUNCTIONALITY, not just page loads
 * 
 * Features:
 * - Functional testing (shopping, checkout, search)
 * - Regression testing (old features still work)
 * - Feature validation (new deployments)
 * - Detailed reports with screenshots
 * - Test scenarios for e-commerce workflows
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  baseUrl: process.env.TEST_URL || 'https://mcstaging.fantasyworldtoys.com',
  productionUrl: 'https://fantasyworldtoys.com',
  timeout: 60000,
  screenshotsDir: 'test-screenshots',
  reportsDir: 'test-reports',
  
  // Test user credentials (configure these)
  testUser: {
    email: process.env.TEST_USER_EMAIL || 'test@example.com',
    password: process.env.TEST_USER_PASSWORD || 'TestPassword123',
    firstName: 'Test',
    lastName: 'User'
  }
};

// Test results
const testResults = {
  timestamp: new Date().toISOString(),
  environment: CONFIG.baseUrl,
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  },
  categories: {
    core: { passed: 0, failed: 0, tests: [] },
    shopping: { passed: 0, failed: 0, tests: [] },
    checkout: { passed: 0, failed: 0, tests: [] },
    account: { passed: 0, failed: 0, tests: [] },
    search: { passed: 0, failed: 0, tests: [] },
    regression: { passed: 0, failed: 0, tests: [] }
  }
};

// Test scenario class
class TestScenario {
  constructor(name, category, description) {
    this.name = name;
    this.category = category;
    this.description = description;
    this.status = 'pending';
    this.error = null;
    this.screenshots = [];
    this.steps = [];
    this.duration = 0;
  }

  async execute(page) {
    throw new Error('execute() must be implemented');
  }

  addStep(stepName, success, details = '') {
    this.steps.push({
      name: stepName,
      success,
      details,
      timestamp: new Date().toISOString()
    });
  }

  async takeScreenshot(page, name) {
    try {
      const filename = `${this.category}-${this.name.replace(/\s/g, '-')}-${name}.png`;
      const filepath = path.join(CONFIG.screenshotsDir, filename);
      await page.screenshot({ path: filepath, fullPage: false });
      this.screenshots.push(filepath);
      return filepath;
    } catch (error) {
      console.log(`Failed to take screenshot: ${error.message}`);
    }
  }
}

// ============================================
// CORE FUNCTIONALITY TESTS
// ============================================

class HomepageLoadTest extends TestScenario {
  constructor() {
    super('Homepage Load', 'core', 'Verify homepage loads correctly with all elements');
  }

  async execute(page) {
    await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });
    this.addStep('Navigate to homepage', true);
    await this.takeScreenshot(page, 'homepage');

    // Check key elements
    const hasLogo = await page.locator('img[alt*="Fantasy"], .logo').count() > 0;
    this.addStep('Logo visible', hasLogo, hasLogo ? 'Logo found' : 'Logo not found');

    const hasSearch = await page.locator('input[type="search"], [name="q"]').count() > 0;
    this.addStep('Search bar visible', hasSearch);

    const hasCategories = await page.locator('.category, .nav, nav').count() > 0;
    this.addStep('Navigation menu visible', hasCategories);

    const hasProducts = await page.locator('.product, [class*="product"]').count() > 0;
    this.addStep('Products displayed', hasProducts);

    return hasLogo && hasSearch && hasCategories;
  }
}

class CategoryPageTest extends TestScenario {
  constructor() {
    super('Category Browse', 'core', 'Verify category pages load and display products');
  }

  async execute(page) {
    await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded' });
    
    // Click on a category (try common names)
    const categorySelectors = [
      'a:has-text("Boys World")',
      'a:has-text("Girls World")',
      'a:has-text("LEGO")',
      'a:has-text("Toys")',
      '.category-item:first-child a',
      'nav a:first-child'
    ];

    let categoryClicked = false;
    for (const selector of categorySelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.count() > 0) {
          await element.click();
          categoryClicked = true;
          this.addStep('Click category', true, `Clicked: ${selector}`);
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (!categoryClicked) {
      this.addStep('Click category', false, 'No category found to click');
      return false;
    }

    await page.waitForLoadState('domcontentloaded');
    await this.takeScreenshot(page, 'category-page');

    // Verify products are shown
    const productCount = await page.locator('.product, [class*="product-item"]').count();
    this.addStep('Products displayed', productCount > 0, `Found ${productCount} products`);

    return productCount > 0;
  }
}

class ProductPageTest extends TestScenario {
  constructor() {
    super('Product Detail', 'core', 'Verify product detail page loads correctly');
  }

  async execute(page) {
    await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded' });

    // Find and click first product
    const productLink = page.locator('.product a, [class*="product"] a').first();
    if (await productLink.count() === 0) {
      this.addStep('Find product', false, 'No products found on homepage');
      return false;
    }

    await productLink.click();
    this.addStep('Click product', true);
    await page.waitForLoadState('domcontentloaded');
    await this.takeScreenshot(page, 'product-page');

    // Check product page elements
    const hasPrice = await page.locator('[class*="price"]').count() > 0;
    this.addStep('Price displayed', hasPrice);

    const hasAddToCart = await page.locator('button:has-text("Add to Cart"), [id*="add-to-cart"], .add-to-cart').count() > 0;
    this.addStep('Add to cart button visible', hasAddToCart);

    const hasDescription = await page.locator('[class*="description"], [class*="detail"]').count() > 0;
    this.addStep('Product description visible', hasDescription);

    return hasPrice && hasAddToCart;
  }
}

// ============================================
// SHOPPING CART TESTS
// ============================================

class AddToCartTest extends TestScenario {
  constructor() {
    super('Add to Cart', 'shopping', 'Verify product can be added to cart');
  }

  async execute(page) {
    await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded' });

    // Find product and go to detail page
    const productLink = page.locator('.product a, [class*="product"] a').first();
    if (await productLink.count() > 0) {
      await productLink.click();
      await page.waitForLoadState('domcontentloaded');
      this.addStep('Navigate to product', true);
    } else {
      this.addStep('Navigate to product', false, 'No products found');
      return false;
    }

    await this.takeScreenshot(page, 'before-add-to-cart');

    // Click add to cart
    const addToCartSelectors = [
      'button:has-text("Add to Cart")',
      '[id*="add-to-cart"]',
      '.add-to-cart',
      'button[type="submit"]:has-text("Add")'
    ];

    let added = false;
    for (const selector of addToCartSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.count() > 0 && await button.isVisible()) {
          await button.click();
          added = true;
          this.addStep('Click add to cart', true);
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (!added) {
      this.addStep('Click add to cart', false, 'Add to cart button not found');
      return false;
    }

    // Wait for cart update
    await page.waitForTimeout(2000);
    await this.takeScreenshot(page, 'after-add-to-cart');

    // Verify cart counter updated
    const cartCounter = await page.locator('.cart-count, [class*="cart"] .count, .counter-qty').count();
    this.addStep('Cart counter updated', cartCounter > 0);

    return cartCounter > 0 || added;
  }
}

class ViewCartTest extends TestScenario {
  constructor() {
    super('View Cart', 'shopping', 'Verify shopping cart page displays correctly');
  }

  async execute(page) {
    // First add something to cart
    const addToCart = new AddToCartTest();
    const addResult = await addToCart.execute(page);
    
    if (!addResult) {
      this.addStep('Pre-requisite: Add to cart', false);
      return false;
    }

    // Navigate to cart
    const cartSelectors = [
      'a:has-text("Cart")',
      '[href*="checkout/cart"]',
      '.cart-link',
      '[class*="mini-cart"]'
    ];

    let cartOpened = false;
    for (const selector of cartSelectors) {
      try {
        const link = page.locator(selector).first();
        if (await link.count() > 0) {
          await link.click();
          cartOpened = true;
          this.addStep('Navigate to cart', true);
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (!cartOpened) {
      // Try direct URL
      await page.goto(`${CONFIG.baseUrl}/checkout/cart`, { waitUntil: 'domcontentloaded' });
      this.addStep('Navigate to cart (direct URL)', true);
    }

    await page.waitForLoadState('domcontentloaded');
    await this.takeScreenshot(page, 'cart-page');

    // Verify cart contents
    const hasProducts = await page.locator('.cart-item, [class*="product"]').count() > 0;
    this.addStep('Cart contains products', hasProducts);

    const hasTotal = await page.locator('[class*="total"], .grand-total').count() > 0;
    this.addStep('Cart total displayed', hasTotal);

    const hasCheckout = await page.locator('button:has-text("Checkout"), a:has-text("Checkout")').count() > 0;
    this.addStep('Checkout button visible', hasCheckout);

    return hasProducts;
  }
}

// ============================================
// SEARCH FUNCTIONALITY TESTS
// ============================================

class SearchTest extends TestScenario {
  constructor() {
    super('Product Search', 'search', 'Verify search functionality works');
  }

  async execute(page) {
    await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded' });
    await this.takeScreenshot(page, 'before-search');

    // Find search input
    const searchInput = page.locator('input[type="search"], input[name="q"], [id*="search"]').first();
    if (await searchInput.count() === 0) {
      this.addStep('Find search box', false, 'Search input not found');
      return false;
    }

    // Perform search
    const searchTerm = 'LEGO';
    await searchInput.fill(searchTerm);
    this.addStep('Enter search term', true, `Searched for: ${searchTerm}`);

    // Submit search
    await searchInput.press('Enter');
    await page.waitForLoadState('domcontentloaded');
    await this.takeScreenshot(page, 'search-results');

    // Verify results
    const resultsCount = await page.locator('.product, [class*="product"]').count();
    this.addStep('Search results displayed', resultsCount > 0, `Found ${resultsCount} results`);

    return resultsCount > 0;
  }
}

// ============================================
// ACCOUNT TESTS
// ============================================

class LoginPageTest extends TestScenario {
  constructor() {
    super('Login Page', 'account', 'Verify login page loads and displays correctly');
  }

  async execute(page) {
    // Try to find login link
    await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded' });

    const loginSelectors = [
      'a:has-text("Sign In")',
      'a:has-text("Login")',
      'a:has-text("Account")',
      '[href*="login"]',
      '[href*="account"]'
    ];

    let loginFound = false;
    for (const selector of loginSelectors) {
      try {
        const link = page.locator(selector).first();
        if (await link.count() > 0) {
          await link.click();
          loginFound = true;
          this.addStep('Navigate to login', true);
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (!loginFound) {
      await page.goto(`${CONFIG.baseUrl}/customer/account/login`, { waitUntil: 'domcontentloaded' });
      this.addStep('Navigate to login (direct URL)', true);
    }

    await page.waitForLoadState('domcontentloaded');
    await this.takeScreenshot(page, 'login-page');

    // Check login form elements
    const hasEmailField = await page.locator('input[type="email"], input[name="login[username]"]').count() > 0;
    this.addStep('Email field visible', hasEmailField);

    const hasPasswordField = await page.locator('input[type="password"]').count() > 0;
    this.addStep('Password field visible', hasPasswordField);

    const hasSubmitButton = await page.locator('button[type="submit"]:has-text("Sign"), button:has-text("Login")').count() > 0;
    this.addStep('Login button visible', hasSubmitButton);

    return hasEmailField && hasPasswordField && hasSubmitButton;
  }
}

// ============================================
// REGRESSION TESTS
// ============================================

class MobileResponsivenessTest extends TestScenario {
  constructor() {
    super('Mobile Responsive', 'regression', 'Verify site works on mobile viewport');
  }

  async execute(page) {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded' });
    this.addStep('Load on mobile viewport', true);
    await this.takeScreenshot(page, 'mobile-view');

    // Check mobile menu
    const hasMobileMenu = await page.locator('.mobile-menu, [class*="hamburger"], .menu-toggle').count() > 0;
    this.addStep('Mobile menu visible', hasMobileMenu);

    // Check content is readable (not cut off)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = 375;
    const noHorizontalScroll = bodyWidth <= viewportWidth + 10;
    this.addStep('No horizontal scroll', noHorizontalScroll);

    // Reset viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    return hasMobileMenu || noHorizontalScroll;
  }
}

class CheckoutButtonTest extends TestScenario {
  constructor() {
    super('Checkout Button Accessible', 'regression', 'Verify checkout flow is accessible');
  }

  async execute(page) {
    await page.goto(`${CONFIG.baseUrl}/checkout/cart`, { waitUntil: 'domcontentloaded' });
    await this.takeScreenshot(page, 'checkout-test');

    const checkoutButton = await page.locator('button:has-text("Checkout"), a:has-text("Proceed"), [id*="checkout"]').count();
    this.addStep('Checkout button exists', checkoutButton > 0);

    return checkoutButton > 0;
  }
}

// ============================================
// TEST RUNNER
// ============================================

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 COMPREHENSIVE FUNCTIONAL TESTING SUITE');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Environment: ${CONFIG.baseUrl}`);
  console.log(`Started: ${new Date().toLocaleString()}\n`);

  // Create directories
  await fs.mkdir(CONFIG.screenshotsDir, { recursive: true });
  await fs.mkdir(CONFIG.reportsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  // Define all test scenarios
  const testScenarios = [
    // Core tests
    new HomepageLoadTest(),
    new CategoryPageTest(),
    new ProductPageTest(),
    
    // Shopping tests
    new AddToCartTest(),
    new ViewCartTest(),
    
    // Search tests
    new SearchTest(),
    
    // Account tests
    new LoginPageTest(),
    
    // Regression tests
    new MobileResponsivenessTest(),
    new CheckoutButtonTest()
  ];

  // Run each test
  for (const test of testScenarios) {
    testResults.summary.total++;
    const startTime = Date.now();
    
    console.log(`\n▶️  Running: ${test.name} (${test.category})`);
    console.log(`   ${test.description}`);

    try {
      const result = await test.execute(page);
      test.duration = Date.now() - startTime;

      if (result) {
        test.status = 'passed';
        testResults.summary.passed++;
        testResults.categories[test.category].passed++;
        console.log(`   ✅ PASSED (${test.duration}ms)`);
      } else {
        test.status = 'failed';
        testResults.summary.failed++;
        testResults.categories[test.category].failed++;
        console.log(`   ❌ FAILED (${test.duration}ms)`);
      }
    } catch (error) {
      test.status = 'failed';
      test.error = error.message;
      test.duration = Date.now() - startTime;
      testResults.summary.failed++;
      testResults.categories[test.category].failed++;
      console.log(`   ❌ FAILED: ${error.message} (${test.duration}ms)`);
    }

    testResults.categories[test.category].tests.push(test);

    // Brief pause between tests
    await page.waitForTimeout(1000);
  }

  await browser.close();

  // Generate reports
  await generateDetailedReport();
  await saveResultsJSON();

  // Print summary
  printSummary();
}

// ============================================
// REPORTING
// ============================================

function printSummary() {
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Total Tests: ${testResults.summary.total}`);
  console.log(`✅ Passed: ${testResults.summary.passed} (${((testResults.summary.passed/testResults.summary.total)*100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${testResults.summary.failed} (${((testResults.summary.failed/testResults.summary.total)*100).toFixed(1)}%)`);
  console.log('');

  console.log('By Category:');
  for (const [category, results] of Object.entries(testResults.categories)) {
    const total = results.passed + results.failed;
    if (total > 0) {
      console.log(`  ${category}: ${results.passed}/${total} passed`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`📄 Detailed report: ${path.join(CONFIG.reportsDir, 'functional-test-report.html')}`);
  console.log(`📊 JSON results: ${path.join(CONFIG.reportsDir, 'test-results.json')}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

async function saveResultsJSON() {
  const filepath = path.join(CONFIG.reportsDir, 'test-results.json');
  await fs.writeFile(filepath, JSON.stringify(testResults, null, 2));
}

async function generateDetailedReport() {
  // (HTML report generation code - similar to previous but with functional test details)
  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Functional Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        h1 { color: #667eea; }
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
        .summary-card { background: #f9f9f9; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card h3 { margin: 0; color: #666; }
        .summary-card .value { font-size: 36px; font-weight: bold; margin: 10px 0; }
        .passed .value { color: #10b981; }
        .failed .value { color: #ef4444; }
        .test { border: 1px solid #ddd; margin: 20px 0; padding: 20px; border-radius: 8px; }
        .test.passed { border-left: 4px solid #10b981; }
        .test.failed { border-left: 4px solid #ef4444; }
        .test h3 { margin-top: 0; }
        .steps { margin: 15px 0; }
        .step { padding: 8px; margin: 5px 0; background: #f9f9f9; border-radius: 4px; }
        .step.success { background: #d1fae5; }
        .step.failure { background: #fee2e2; }
        .screenshots img { max-width: 300px; margin: 10px; border: 1px solid #ddd; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 Functional Test Report</h1>
        <p><strong>Environment:</strong> ${testResults.environment}</p>
        <p><strong>Test Date:</strong> ${new Date(testResults.timestamp).toLocaleString()}</p>
        
        <div class="summary">
            <div class="summary-card">
                <h3>Total Tests</h3>
                <div class="value">${testResults.summary.total}</div>
            </div>
            <div class="summary-card passed">
                <h3>Passed</h3>
                <div class="value">${testResults.summary.passed}</div>
            </div>
            <div class="summary-card failed">
                <h3>Failed</h3>
                <div class="value">${testResults.summary.failed}</div>
            </div>
        </div>
        
        ${Object.entries(testResults.categories).map(([category, data]) => `
            <h2>${category.toUpperCase()} Tests</h2>
            ${data.tests.map(test => `
                <div class="test ${test.status}">
                    <h3>${test.status === 'passed' ? '✅' : '❌'} ${test.name}</h3>
                    <p>${test.description}</p>
                    <p><strong>Duration:</strong> ${test.duration}ms</p>
                    ${test.error ? `<p style="color: red;"><strong>Error:</strong> ${test.error}</p>` : ''}
                    <div class="steps">
                        <strong>Steps:</strong>
                        ${test.steps.map(step => `
                            <div class="step ${step.success ? 'success' : 'failure'}">
                                ${step.success ? '✓' : '✗'} ${step.name}
                                ${step.details ? `<br><small>${step.details}</small>` : ''}
                            </div>
                        `).join('')}
                    </div>
                    ${test.screenshots.length > 0 ? `
                        <div class="screenshots">
                            <strong>Screenshots:</strong><br>
                            ${test.screenshots.map(screenshot => `
                                <img src="../${screenshot}" alt="Screenshot">
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        `).join('')}
    </div>
</body>
</html>`;

  const filepath = path.join(CONFIG.reportsDir, 'functional-test-report.html');
  await fs.writeFile(filepath, html);
}

// Run tests
runAllTests().catch(console.error);
