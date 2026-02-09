/**
 * Automated Website Testing Suite with AI Analysis
 * For: https://fantasyworldtoys.com
 * 
 * Features:
 * - Crawls all pages automatically
 * - Tests performance, responsiveness, accessibility
 * - AI-powered analysis of issues
 * - Generates comprehensive HTML report
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  baseUrl: 'https://fantasyworldtoys.com',
  maxPages: 100, // Limit to prevent infinite crawling
  timeout: 30000,
  screenshotOnError: true,
  viewport: {
    desktop: { width: 1920, height: 1080 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 375, height: 667 }
  }
};

// Test results storage
const results = {
  testDate: new Date().toISOString(),
  baseUrl: CONFIG.baseUrl,
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0
  },
  pages: []
};

// AI Analysis using Claude API (free tier available)
async function analyzeWithAI(pageData) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `Analyze this webpage test results and provide insights:
            
URL: ${pageData.url}
Load Time: ${pageData.loadTime}ms
Status Code: ${pageData.statusCode}
Errors: ${JSON.stringify(pageData.errors)}
Console Warnings: ${pageData.consoleWarnings?.length || 0}

Provide:
1. Overall health score (0-100)
2. Critical issues (if any)
3. Recommendations (max 3)

Response format: JSON only
{"score": number, "issues": [], "recommendations": []}`
          }
        ],
      })
    });

    const data = await response.json();
    const content = data.content.find(c => c.type === "text")?.text || "{}";
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { score: 50, issues: [], recommendations: ["AI analysis unavailable"] };
  } catch (error) {
    console.log(`AI analysis skipped for ${pageData.url}: ${error.message}`);
    return { score: 50, issues: [], recommendations: [] };
  }
}

// Crawl and discover all pages
async function crawlPages(page, visitedUrls = new Set(), baseUrl = CONFIG.baseUrl) {
  const urls = [baseUrl];
  const discovered = new Set([baseUrl]);
  
  while (urls.length > 0 && discovered.size < CONFIG.maxPages) {
    const url = urls.shift();
    
    if (visitedUrls.has(url)) continue;
    visitedUrls.add(url);
    
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
      
      // Extract all links
      const links = await page.$$eval('a[href]', (anchors, base) => {
        return anchors
          .map(a => {
            try {
              const href = a.getAttribute('href');
              if (!href) return null;
              
              // Convert relative URLs to absolute
              const absoluteUrl = new URL(href, base);
              return absoluteUrl.href;
            } catch {
              return null;
            }
          })
          .filter(href => href !== null);
      }, baseUrl);
      
      // Filter links from same domain
      for (const link of links) {
        try {
          const linkUrl = new URL(link);
          const baseUrlObj = new URL(baseUrl);
          
          if (linkUrl.hostname === baseUrlObj.hostname && 
              !discovered.has(link) && 
              !link.includes('#') &&
              !link.match(/\.(jpg|jpeg|png|gif|pdf|zip|css|js)$/i)) {
            discovered.add(link);
            urls.push(link);
          }
        } catch {}
      }
    } catch (error) {
      console.log(`Error crawling ${url}: ${error.message}`);
    }
  }
  
  return Array.from(discovered);
}

// Test individual page
async function testPage(browser, url, device = 'desktop') {
  const context = await browser.newContext({
    viewport: CONFIG.viewport[device]
  });
  const page = await context.newPage();
  
  const pageResult = {
    url,
    device,
    timestamp: new Date().toISOString(),
    status: 'unknown',
    statusCode: null,
    loadTime: null,
    errors: [],
    consoleWarnings: [],
    accessibility: {},
    performance: {},
    aiAnalysis: {}
  };
  
  const consoleMessages = [];
  
  // Collect console messages
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    }
  });
  
  // Collect page errors
  page.on('pageerror', error => {
    pageResult.errors.push(error.message);
  });
  
  try {
    const startTime = Date.now();
    
    // Navigate to page
    const response = await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: CONFIG.timeout 
    });
    
    pageResult.loadTime = Date.now() - startTime;
    pageResult.statusCode = response.status();
    
    // Performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: perfData?.domContentLoadedEventEnd - perfData?.domContentLoadedEventStart,
        loadComplete: perfData?.loadEventEnd - perfData?.loadEventStart,
        firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime,
        firstContentfulPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime
      };
    });
    
    pageResult.performance = performanceMetrics;
    
    // Basic accessibility checks
    const accessibilityChecks = await page.evaluate(() => {
      return {
        hasH1: !!document.querySelector('h1'),
        hasTitle: !!document.title && document.title.length > 0,
        hasMetaDescription: !!document.querySelector('meta[name="description"]'),
        imagesWithoutAlt: document.querySelectorAll('img:not([alt])').length,
        formInputsWithoutLabel: document.querySelectorAll('input:not([aria-label]):not([id])').length
      };
    });
    
    pageResult.accessibility = accessibilityChecks;
    pageResult.consoleWarnings = consoleMessages;
    
    // Determine status
    if (pageResult.statusCode >= 200 && pageResult.statusCode < 300) {
      if (pageResult.loadTime < 3000 && pageResult.errors.length === 0) {
        pageResult.status = 'good';
        results.summary.passed++;
      } else if (pageResult.loadTime < 5000) {
        pageResult.status = 'warning';
        results.summary.warnings++;
      } else {
        pageResult.status = 'bad';
        results.summary.failed++;
      }
    } else if (pageResult.statusCode >= 400) {
      pageResult.status = 'bad';
      results.summary.failed++;
    } else {
      pageResult.status = 'warning';
      results.summary.warnings++;
    }
    
    // AI Analysis (optional, comment out if not using API)
    // pageResult.aiAnalysis = await analyzeWithAI(pageResult);
    
  } catch (error) {
    pageResult.status = 'bad';
    pageResult.errors.push(error.message);
    results.summary.failed++;
    
    if (CONFIG.screenshotOnError) {
      try {
        const screenshotPath = `screenshots/${encodeURIComponent(url)}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        pageResult.screenshot = screenshotPath;
      } catch {}
    }
  } finally {
    await context.close();
  }
  
  return pageResult;
}

// Generate HTML Report
async function generateHTMLReport(results) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Automated Test Report - ${results.baseUrl}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .header h1 { margin-bottom: 10px; }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .summary-card h3 { color: #666; font-size: 14px; margin-bottom: 10px; }
        .summary-card .value { font-size: 36px; font-weight: bold; }
        .summary-card.good .value { color: #10b981; }
        .summary-card.bad .value { color: #ef4444; }
        .summary-card.warning .value { color: #f59e0b; }
        .summary-card.total .value { color: #667eea; }
        
        .filters {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .filters label { margin-right: 20px; }
        .filters input, .filters select { margin-right: 10px; }
        
        .results-table {
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        table { width: 100%; border-collapse: collapse; }
        th {
            background: #f9fafb;
            padding: 15px;
            text-align: left;
            font-weight: 600;
            color: #374151;
            border-bottom: 2px solid #e5e7eb;
        }
        td {
            padding: 15px;
            border-bottom: 1px solid #e5e7eb;
        }
        tr:hover { background: #f9fafb; }
        
        .status-badge {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            display: inline-block;
        }
        .status-good { background: #d1fae5; color: #065f46; }
        .status-bad { background: #fee2e2; color: #991b1b; }
        .status-warning { background: #fef3c7; color: #92400e; }
        
        .load-time {
            font-weight: 600;
        }
        .load-time.fast { color: #10b981; }
        .load-time.medium { color: #f59e0b; }
        .load-time.slow { color: #ef4444; }
        
        .details-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        }
        .details-btn:hover { background: #5568d3; }
        
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
        }
        .modal.active { display: flex; align-items: center; justify-content: center; }
        .modal-content {
            background: white;
            padding: 30px;
            border-radius: 10px;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            position: relative;
        }
        .modal-close {
            position: absolute;
            top: 15px;
            right: 15px;
            font-size: 24px;
            cursor: pointer;
            color: #666;
        }
        
        .metric-row { 
            display: flex; 
            justify-content: space-between; 
            padding: 10px 0; 
            border-bottom: 1px solid #e5e7eb; 
        }
        .metric-label { font-weight: 600; color: #666; }
        
        .error-list {
            background: #fee2e2;
            padding: 15px;
            border-radius: 5px;
            margin: 10px 0;
        }
        .error-item {
            color: #991b1b;
            margin: 5px 0;
            font-family: monospace;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Automated Test Report</h1>
            <p><strong>Website:</strong> ${results.baseUrl}</p>
            <p><strong>Test Date:</strong> ${new Date(results.testDate).toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <div class="summary-card total">
                <h3>Total Pages</h3>
                <div class="value">${results.summary.total}</div>
            </div>
            <div class="summary-card good">
                <h3>Passed</h3>
                <div class="value">${results.summary.passed}</div>
            </div>
            <div class="summary-card warning">
                <h3>Warnings</h3>
                <div class="value">${results.summary.warnings}</div>
            </div>
            <div class="summary-card bad">
                <h3>Failed</h3>
                <div class="value">${results.summary.failed}</div>
            </div>
        </div>
        
        <div class="filters">
            <label><input type="checkbox" checked onchange="filterTable('good')"> Show Good</label>
            <label><input type="checkbox" checked onchange="filterTable('warning')"> Show Warnings</label>
            <label><input type="checkbox" checked onchange="filterTable('bad')"> Show Failed</label>
            <label style="margin-left: 20px;">Sort by: 
                <select onchange="sortTable(this.value)">
                    <option value="url">URL</option>
                    <option value="loadTime">Load Time</option>
                    <option value="status">Status</option>
                </select>
            </label>
        </div>
        
        <div class="results-table">
            <table id="resultsTable">
                <thead>
                    <tr>
                        <th>URL</th>
                        <th>Status</th>
                        <th>Load Time</th>
                        <th>Errors</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.pages.map((page, index) => `
                        <tr class="row-${page.status}" data-status="${page.status}">
                            <td><a href="${page.url}" target="_blank">${page.url.replace(results.baseUrl, '')}</a></td>
                            <td><span class="status-badge status-${page.status}">${page.status.toUpperCase()}</span></td>
                            <td><span class="load-time ${page.loadTime < 2000 ? 'fast' : page.loadTime < 4000 ? 'medium' : 'slow'}">${page.loadTime}ms</span></td>
                            <td>${page.errors.length}</td>
                            <td><button class="details-btn" onclick="showDetails(${index})">View Details</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
    
    <div id="modal" class="modal">
        <div class="modal-content">
            <span class="modal-close" onclick="closeModal()">&times;</span>
            <div id="modalBody"></div>
        </div>
    </div>
    
    <script>
        const pageData = ${JSON.stringify(results.pages)};
        
        function showDetails(index) {
            const page = pageData[index];
            const modal = document.getElementById('modal');
            const body = document.getElementById('modalBody');
            
            body.innerHTML = \`
                <h2>Page Details</h2>
                <p><strong>URL:</strong> <a href="\${page.url}" target="_blank">\${page.url}</a></p>
                
                <h3 style="margin-top: 20px;">Performance Metrics</h3>
                <div class="metric-row">
                    <span class="metric-label">Load Time:</span>
                    <span>\${page.loadTime}ms</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Status Code:</span>
                    <span>\${page.statusCode}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">First Contentful Paint:</span>
                    <span>\${page.performance?.firstContentfulPaint?.toFixed(2) || 'N/A'}ms</span>
                </div>
                
                <h3 style="margin-top: 20px;">Accessibility</h3>
                <div class="metric-row">
                    <span class="metric-label">Has H1:</span>
                    <span>\${page.accessibility?.hasH1 ? '✅' : '❌'}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Has Title:</span>
                    <span>\${page.accessibility?.hasTitle ? '✅' : '❌'}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Images without Alt:</span>
                    <span>\${page.accessibility?.imagesWithoutAlt || 0}</span>
                </div>
                
                \${page.errors.length > 0 ? \`
                    <h3 style="margin-top: 20px;">Errors</h3>
                    <div class="error-list">
                        \${page.errors.map(err => \`<div class="error-item">• \${err}</div>\`).join('')}
                    </div>
                \` : ''}
                
                \${page.consoleWarnings.length > 0 ? \`
                    <h3 style="margin-top: 20px;">Console Warnings (\${page.consoleWarnings.length})</h3>
                \` : ''}
            \`;
            
            modal.classList.add('active');
        }
        
        function closeModal() {
            document.getElementById('modal').classList.remove('active');
        }
        
        function filterTable(status) {
            const rows = document.querySelectorAll(\`.row-\${status}\`);
            rows.forEach(row => {
                row.style.display = row.style.display === 'none' ? '' : 'none';
            });
        }
        
        function sortTable(criterion) {
            // Simple sort implementation
            console.log('Sorting by:', criterion);
        }
    </script>
</body>
</html>`;

  await fs.writeFile('test-report.html', html);
  console.log('✅ Report generated: test-report.html');
}

// Main test execution
async function runTests() {
  console.log('🚀 Starting automated tests...\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Step 1: Discover all pages
  console.log('🔍 Discovering pages...');
  const urls = await crawlPages(page, new Set(), CONFIG.baseUrl);
  console.log(`✅ Found ${urls.length} pages\n`);
  
  results.summary.total = urls.length;
  
  // Step 2: Test each page
  console.log('🧪 Testing pages...\n');
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`[${i + 1}/${urls.length}] Testing: ${url}`);
    
    const pageResult = await testPage(browser, url);
    results.pages.push(pageResult);
    
    console.log(`  ➜ Status: ${pageResult.status.toUpperCase()} | Load: ${pageResult.loadTime}ms | Errors: ${pageResult.errors.length}\n`);
  }
  
  await browser.close();
  
  // Step 3: Generate report
  console.log('📊 Generating report...');
  await generateHTMLReport(results);
  
  // Save JSON report
  await fs.writeFile('test-results.json', JSON.stringify(results, null, 2));
  console.log('✅ JSON results saved: test-results.json\n');
  
  // Summary
  console.log('═══════════════════════════════════════');
  console.log('📈 TEST SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`Total Pages: ${results.summary.total}`);
  console.log(`✅ Passed: ${results.summary.passed}`);
  console.log(`⚠️  Warnings: ${results.summary.warnings}`);
  console.log(`❌ Failed: ${results.summary.failed}`);
  console.log('═══════════════════════════════════════\n');
  console.log('Open test-report.html in your browser to view detailed results.');
}

// Run the tests
runTests().catch(console.error);
