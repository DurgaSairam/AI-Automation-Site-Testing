/**
 * Error Analysis Tool
 * Analyzes test results to identify root causes of failures
 */

const fs = require('fs').promises;

async function analyzeErrors() {
  try {
    const data = await fs.readFile('test-results.json', 'utf8');
    const results = JSON.parse(data);
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 DETAILED ERROR ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Collect all unique errors
    const errorCounts = new Map();
    const errorExamples = new Map();
    const statusCodes = new Map();
    const loadTimes = [];
    const consoleErrors = new Map();
    
    results.pages.forEach(page => {
      // Count status codes
      const statusKey = page.statusCode || 'unknown';
      statusCodes.set(statusKey, (statusCodes.get(statusKey) || 0) + 1);
      
      // Collect load times
      if (page.loadTime) {
        loadTimes.push(page.loadTime);
      }
      
      // Analyze errors
      page.errors.forEach(error => {
        // Extract error type
        let errorType = 'Unknown Error';
        
        if (error.includes('timeout')) {
          errorType = 'Timeout Error';
        } else if (error.includes('Navigation') || error.includes('net::')) {
          errorType = 'Network/Navigation Error';
        } else if (error.includes('ERR_NAME_NOT_RESOLVED')) {
          errorType = 'DNS Resolution Error';
        } else if (error.includes('ERR_CONNECTION_REFUSED')) {
          errorType = 'Connection Refused';
        } else if (error.includes('ERR_CERT')) {
          errorType = 'SSL Certificate Error';
        } else if (error.includes('404')) {
          errorType = '404 Not Found';
        } else if (error.includes('500') || error.includes('502') || error.includes('503')) {
          errorType = 'Server Error (5xx)';
        } else {
          // Try to extract first meaningful part
          const match = error.match(/^([^:]+):/);
          if (match) {
            errorType = match[1];
          }
        }
        
        errorCounts.set(errorType, (errorCounts.get(errorType) || 0) + 1);
        
        if (!errorExamples.has(errorType)) {
          errorExamples.set(errorType, {
            error: error.substring(0, 200),
            url: page.url,
            statusCode: page.statusCode
          });
        }
      });
      
      // Analyze console errors/warnings
      page.consoleWarnings?.forEach(msg => {
        const key = msg.type || 'unknown';
        consoleErrors.set(key, (consoleErrors.get(key) || 0) + 1);
      });
    });
    
    // Calculate statistics
    const avgLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
    const maxLoadTime = Math.max(...loadTimes);
    const minLoadTime = Math.min(...loadTimes);
    
    // Sort errors by frequency
    const sortedErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    
    // Print Summary
    console.log('📊 SUMMARY STATISTICS');
    console.log('─────────────────────────────────────────────────────────\n');
    console.log(`Total Pages Tested: ${results.summary.total}`);
    console.log(`Passed: ${results.summary.passed} (${((results.summary.passed/results.summary.total)*100).toFixed(1)}%)`);
    console.log(`Warnings: ${results.summary.warnings} (${((results.summary.warnings/results.summary.total)*100).toFixed(1)}%)`);
    console.log(`Failed: ${results.summary.failed} (${((results.summary.failed/results.summary.total)*100).toFixed(1)}%)`);
    console.log('');
    
    // Load Time Analysis
    console.log('⏱️  LOAD TIME ANALYSIS');
    console.log('─────────────────────────────────────────────────────────\n');
    console.log(`Average: ${avgLoadTime.toFixed(0)}ms`);
    console.log(`Min: ${minLoadTime}ms`);
    console.log(`Max: ${maxLoadTime}ms`);
    console.log('');
    
    // HTTP Status Codes
    console.log('📡 HTTP STATUS CODES');
    console.log('─────────────────────────────────────────────────────────\n');
    const sortedStatus = Array.from(statusCodes.entries()).sort((a, b) => b[1] - a[1]);
    sortedStatus.forEach(([code, count]) => {
      const percentage = ((count / results.summary.total) * 100).toFixed(1);
      console.log(`${code}: ${count} pages (${percentage}%)`);
    });
    console.log('');
    
    // Top Errors
    console.log('❌ TOP ERROR TYPES');
    console.log('─────────────────────────────────────────────────────────\n');
    sortedErrors.slice(0, 10).forEach(([errorType, count], index) => {
      const percentage = ((count / results.summary.total) * 100).toFixed(1);
      console.log(`${index + 1}. ${errorType}`);
      console.log(`   Count: ${count} occurrences (${percentage}% of pages)`);
      
      const example = errorExamples.get(errorType);
      if (example) {
        console.log(`   Example URL: ${example.url}`);
        console.log(`   Status Code: ${example.statusCode}`);
        console.log(`   Error: ${example.error.substring(0, 150)}...`);
      }
      console.log('');
    });
    
    // Console Errors
    if (consoleErrors.size > 0) {
      console.log('🖥️  CONSOLE ERRORS/WARNINGS');
      console.log('─────────────────────────────────────────────────────────\n');
      const sortedConsole = Array.from(consoleErrors.entries()).sort((a, b) => b[1] - a[1]);
      sortedConsole.forEach(([type, count]) => {
        console.log(`${type}: ${count} messages`);
      });
      console.log('');
    }
    
    // Find patterns in failed pages
    console.log('🔍 FAILURE PATTERNS');
    console.log('─────────────────────────────────────────────────────────\n');
    
    const failedPages = results.pages.filter(p => p.status === 'bad');
    const urlPatterns = new Map();
    
    failedPages.forEach(page => {
      const url = new URL(page.url);
      const pathParts = url.pathname.split('/').filter(p => p);
      const pattern = pathParts.length > 0 ? pathParts[0] : 'root';
      urlPatterns.set(pattern, (urlPatterns.get(pattern) || 0) + 1);
    });
    
    const sortedPatterns = Array.from(urlPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    console.log('Most affected URL patterns:');
    sortedPatterns.forEach(([pattern, count]) => {
      console.log(`  /${pattern}/*  : ${count} failed pages`);
    });
    console.log('');
    
    // Recommendations
    console.log('💡 RECOMMENDATIONS');
    console.log('─────────────────────────────────────────────────────────\n');
    
    const recommendations = [];
    
    if (avgLoadTime > 5000) {
      recommendations.push('⚠️  Average load time is very high (>5s). Server optimization needed.');
    }
    
    if (results.summary.failed / results.summary.total > 0.5) {
      recommendations.push('❌ Over 50% failure rate - there may be a systematic issue.');
    }
    
    if (statusCodes.has(null) || statusCodes.has('null')) {
      recommendations.push('🔌 Many pages returning no status code - check network connectivity.');
    }
    
    const has4xx = Array.from(statusCodes.keys()).some(code => 
      code >= 400 && code < 500
    );
    if (has4xx) {
      recommendations.push('🔗 Found 4xx errors - broken links or missing pages.');
    }
    
    const has5xx = Array.from(statusCodes.keys()).some(code => 
      code >= 500 && code < 600
    );
    if (has5xx) {
      recommendations.push('🖥️  Found 5xx errors - server-side issues.');
    }
    
    if (errorCounts.has('Timeout Error')) {
      recommendations.push('⏱️  Timeout errors detected - increase timeout or optimize server response.');
    }
    
    if (errorCounts.has('DNS Resolution Error')) {
      recommendations.push('🌐 DNS errors detected - check domain configuration.');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ No obvious patterns detected. Review individual page errors.');
    }
    
    recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
    console.log('');
    
    // Sample of failed pages
    console.log('📋 SAMPLE OF FAILED PAGES (First 10)');
    console.log('─────────────────────────────────────────────────────────\n');
    
    failedPages.slice(0, 10).forEach(page => {
      console.log(`URL: ${page.url}`);
      console.log(`  Status Code: ${page.statusCode}`);
      console.log(`  Load Time: ${page.loadTime}ms`);
      console.log(`  Errors: ${page.errors.length}`);
      if (page.errors.length > 0) {
        console.log(`  First Error: ${page.errors[0].substring(0, 100)}`);
      }
      console.log('');
    });
    
    // Generate detailed report
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalPages: results.summary.total,
        passed: results.summary.passed,
        warnings: results.summary.warnings,
        failed: results.summary.failed,
        passRate: ((results.summary.passed/results.summary.total)*100).toFixed(2) + '%'
      },
      loadTimeStats: {
        average: Math.round(avgLoadTime),
        min: minLoadTime,
        max: maxLoadTime
      },
      statusCodes: Object.fromEntries(statusCodes),
      topErrors: sortedErrors.slice(0, 10).map(([type, count]) => ({
        type,
        count,
        percentage: ((count / results.summary.total) * 100).toFixed(2) + '%',
        example: errorExamples.get(type)
      })),
      failurePatterns: Object.fromEntries(sortedPatterns),
      recommendations
    };
    
    await fs.writeFile('error-analysis.json', JSON.stringify(reportData, null, 2));
    console.log('✅ Detailed analysis saved to: error-analysis.json\n');
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('💡 Next Steps:');
    console.log('  1. Review the top error types above');
    console.log('  2. Check error-analysis.json for full details');
    console.log('  3. Investigate sample failed pages');
    console.log('  4. Consider increasing timeout if needed');
    console.log('  5. Check server logs for corresponding errors');
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('Error reading test results:', error.message);
    console.log('\nMake sure you have run tests first: npm test');
  }
}

if (require.main === module) {
  analyzeErrors();
}

module.exports = { analyzeErrors };
