/**
 * Test Results Comparison Tool
 * Compares current test results with previous runs to detect regressions
 */

const fs = require('fs').promises;
const path = require('path');

async function compareResults(currentFile = 'test-results.json', previousFile = null) {
  try {
    // Load current results
    const currentData = await fs.readFile(currentFile, 'utf8');
    const current = JSON.parse(currentData);
    
    // If no previous file specified, look for the most recent backup
    if (!previousFile) {
      const files = await fs.readdir('.');
      const backups = files.filter(f => f.startsWith('test-results-backup-'));
      
      if (backups.length === 0) {
        console.log('No previous results found for comparison.');
        console.log('Run tests again later to enable comparison.');
        return;
      }
      
      backups.sort().reverse();
      previousFile = backups[0];
    }
    
    const previousData = await fs.readFile(previousFile, 'utf8');
    const previous = JSON.parse(previousData);
    
    // Compare results
    const comparison = {
      timestamp: new Date().toISOString(),
      currentDate: current.testDate,
      previousDate: previous.testDate,
      summary: {
        current: current.summary,
        previous: previous.summary,
        changes: {
          total: current.summary.total - previous.summary.total,
          passed: current.summary.passed - previous.summary.passed,
          failed: current.summary.failed - previous.summary.failed,
          warnings: current.summary.warnings - previous.summary.warnings
        }
      },
      regressions: [],
      improvements: [],
      newPages: [],
      removedPages: []
    };
    
    // Create lookup maps
    const previousPages = new Map(previous.pages.map(p => [p.url, p]));
    const currentPages = new Map(current.pages.map(p => [p.url, p]));
    
    // Find changes
    for (const [url, currentPage] of currentPages) {
      const previousPage = previousPages.get(url);
      
      if (!previousPage) {
        comparison.newPages.push(url);
        continue;
      }
      
      // Check for regressions
      if (currentPage.status === 'bad' && previousPage.status !== 'bad') {
        comparison.regressions.push({
          url,
          previousStatus: previousPage.status,
          currentStatus: currentPage.status,
          previousLoadTime: previousPage.loadTime,
          currentLoadTime: currentPage.loadTime,
          newErrors: currentPage.errors.length - previousPage.errors.length
        });
      }
      
      // Check for improvements
      if (currentPage.status === 'good' && previousPage.status !== 'good') {
        comparison.improvements.push({
          url,
          previousStatus: previousPage.status,
          currentStatus: currentPage.status,
          loadTimeImprovement: previousPage.loadTime - currentPage.loadTime
        });
      }
      
      // Check for significant load time changes
      const loadTimeDiff = currentPage.loadTime - previousPage.loadTime;
      if (Math.abs(loadTimeDiff) > 1000) { // More than 1 second difference
        if (loadTimeDiff > 0) {
          comparison.regressions.push({
            url,
            type: 'performance',
            previousLoadTime: previousPage.loadTime,
            currentLoadTime: currentPage.loadTime,
            degradation: loadTimeDiff
          });
        } else {
          comparison.improvements.push({
            url,
            type: 'performance',
            previousLoadTime: previousPage.loadTime,
            currentLoadTime: currentPage.loadTime,
            improvement: Math.abs(loadTimeDiff)
          });
        }
      }
    }
    
    // Find removed pages
    for (const [url] of previousPages) {
      if (!currentPages.has(url)) {
        comparison.removedPages.push(url);
      }
    }
    
    // Save comparison
    await fs.writeFile('test-comparison.json', JSON.stringify(comparison, null, 2));
    
    // Generate comparison report
    await generateComparisonReport(comparison);
    
    // Print summary
    console.log('\n═══════════════════════════════════════');
    console.log('📊 COMPARISON SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Current: ${new Date(comparison.currentDate).toLocaleString()}`);
    console.log(`Previous: ${new Date(comparison.previousDate).toLocaleString()}`);
    console.log('');
    console.log(`Total Pages: ${comparison.summary.current.total} (${comparison.summary.changes.total >= 0 ? '+' : ''}${comparison.summary.changes.total})`);
    console.log(`Passed: ${comparison.summary.current.passed} (${comparison.summary.changes.passed >= 0 ? '+' : ''}${comparison.summary.changes.passed})`);
    console.log(`Failed: ${comparison.summary.current.failed} (${comparison.summary.changes.failed >= 0 ? '+' : ''}${comparison.summary.changes.failed})`);
    console.log('');
    console.log(`🔴 Regressions: ${comparison.regressions.length}`);
    console.log(`🟢 Improvements: ${comparison.improvements.length}`);
    console.log(`🆕 New Pages: ${comparison.newPages.length}`);
    console.log(`🗑️  Removed Pages: ${comparison.removedPages.length}`);
    console.log('═══════════════════════════════════════\n');
    
    if (comparison.regressions.length > 0) {
      console.log('⚠️  REGRESSIONS DETECTED:');
      comparison.regressions.slice(0, 5).forEach(r => {
        console.log(`  - ${r.url}`);
        if (r.type === 'performance') {
          console.log(`    Load time: ${r.previousLoadTime}ms → ${r.currentLoadTime}ms (+${r.degradation}ms)`);
        } else {
          console.log(`    Status: ${r.previousStatus} → ${r.currentStatus}`);
        }
      });
      console.log('');
    }
    
    // Backup current results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.copyFile(currentFile, `test-results-backup-${timestamp}.json`);
    
    console.log('✅ Comparison complete! View test-comparison-report.html for details.\n');
    
    // Return exit code based on regressions
    return comparison.regressions.length > 0 ? 1 : 0;
    
  } catch (error) {
    console.error('Error comparing results:', error.message);
    return 1;
  }
}

async function generateComparisonReport(comparison) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Comparison Report</title>
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
        .comparison-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .metric-card h3 { color: #666; margin-bottom: 15px; }
        .metric-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .change { font-weight: bold; }
        .change.positive { color: #10b981; }
        .change.negative { color: #ef4444; }
        .change.neutral { color: #666; }
        
        .section {
            background: white;
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .section h2 { margin-bottom: 20px; color: #374151; }
        .item { padding: 15px; background: #f9fafb; margin-bottom: 10px; border-radius: 5px; }
        .item-url { font-weight: 600; margin-bottom: 5px; }
        .item-details { color: #666; font-size: 14px; }
        
        .regression { border-left: 4px solid #ef4444; }
        .improvement { border-left: 4px solid #10b981; }
        .new { border-left: 4px solid #3b82f6; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Test Comparison Report</h1>
            <p><strong>Current:</strong> ${new Date(comparison.currentDate).toLocaleString()}</p>
            <p><strong>Previous:</strong> ${new Date(comparison.previousDate).toLocaleString()}</p>
        </div>
        
        <div class="comparison-grid">
            <div class="metric-card">
                <h3>Current Results</h3>
                <div class="metric-row">
                    <span>Total Pages</span>
                    <span>${comparison.summary.current.total}</span>
                </div>
                <div class="metric-row">
                    <span>Passed</span>
                    <span>${comparison.summary.current.passed}</span>
                </div>
                <div class="metric-row">
                    <span>Failed</span>
                    <span>${comparison.summary.current.failed}</span>
                </div>
                <div class="metric-row">
                    <span>Warnings</span>
                    <span>${comparison.summary.current.warnings}</span>
                </div>
            </div>
            
            <div class="metric-card">
                <h3>Changes</h3>
                <div class="metric-row">
                    <span>Total Pages</span>
                    <span class="change ${comparison.summary.changes.total === 0 ? 'neutral' : comparison.summary.changes.total > 0 ? 'positive' : 'negative'}">
                        ${comparison.summary.changes.total >= 0 ? '+' : ''}${comparison.summary.changes.total}
                    </span>
                </div>
                <div class="metric-row">
                    <span>Passed</span>
                    <span class="change ${comparison.summary.changes.passed >= 0 ? 'positive' : 'negative'}">
                        ${comparison.summary.changes.passed >= 0 ? '+' : ''}${comparison.summary.changes.passed}
                    </span>
                </div>
                <div class="metric-row">
                    <span>Failed</span>
                    <span class="change ${comparison.summary.changes.failed <= 0 ? 'positive' : 'negative'}">
                        ${comparison.summary.changes.failed >= 0 ? '+' : ''}${comparison.summary.changes.failed}
                    </span>
                </div>
                <div class="metric-row">
                    <span>Warnings</span>
                    <span class="change ${comparison.summary.changes.warnings <= 0 ? 'positive' : 'negative'}">
                        ${comparison.summary.changes.warnings >= 0 ? '+' : ''}${comparison.summary.changes.warnings}
                    </span>
                </div>
            </div>
        </div>
        
        ${comparison.regressions.length > 0 ? `
        <div class="section">
            <h2>🔴 Regressions (${comparison.regressions.length})</h2>
            ${comparison.regressions.map(r => `
                <div class="item regression">
                    <div class="item-url">${r.url}</div>
                    <div class="item-details">
                        ${r.type === 'performance' ? 
                            `Load time: ${r.previousLoadTime}ms → ${r.currentLoadTime}ms (slower by ${r.degradation}ms)` :
                            `Status: ${r.previousStatus} → ${r.currentStatus}`
                        }
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        ${comparison.improvements.length > 0 ? `
        <div class="section">
            <h2>🟢 Improvements (${comparison.improvements.length})</h2>
            ${comparison.improvements.map(i => `
                <div class="item improvement">
                    <div class="item-url">${i.url}</div>
                    <div class="item-details">
                        ${i.type === 'performance' ? 
                            `Load time: ${i.previousLoadTime}ms → ${i.currentLoadTime}ms (faster by ${i.improvement}ms)` :
                            `Status: ${i.previousStatus} → ${i.currentStatus}`
                        }
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        ${comparison.newPages.length > 0 ? `
        <div class="section">
            <h2>🆕 New Pages (${comparison.newPages.length})</h2>
            ${comparison.newPages.map(url => `
                <div class="item new">
                    <div class="item-url">${url}</div>
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        ${comparison.removedPages.length > 0 ? `
        <div class="section">
            <h2>🗑️ Removed Pages (${comparison.removedPages.length})</h2>
            ${comparison.removedPages.map(url => `
                <div class="item">
                    <div class="item-url">${url}</div>
                </div>
            `).join('')}
        </div>
        ` : ''}
    </div>
</body>
</html>`;

  await fs.writeFile('test-comparison-report.html', html);
}

// Run if executed directly
if (require.main === module) {
  const previousFile = process.argv[2];
  compareResults('test-results.json', previousFile)
    .then(exitCode => process.exit(exitCode))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { compareResults };
