// Quick Error Analysis - Copy this entire file and save as analyze-errors.js
// Then run: node analyze-errors.js

const fs = require('fs');

try {
  const data = fs.readFileSync('test-results.json', 'utf8');
  const results = JSON.parse(data);
  
  console.log('\n═══════════════════════════════════════');
  console.log('🔍 ERROR ANALYSIS REPORT');
  console.log('═══════════════════════════════════════\n');
  
  // Collect errors
  const errorMap = new Map();
  const statusCodes = new Map();
  let totalErrors = 0;
  
  results.pages.forEach(page => {
    // Count status codes
    statusCodes.set(page.statusCode, (statusCodes.get(page.statusCode) || 0) + 1);
    
    // Count errors
    page.errors.forEach(error => {
      totalErrors++;
      let errorType = 'Other';
      
      if (error.includes('timeout') || error.includes('Timeout')) {
        errorType = 'TIMEOUT';
      } else if (error.includes('net::') || error.includes('ERR_')) {
        errorType = 'NETWORK ERROR';
      } else if (error.includes('Navigation')) {
        errorType = 'NAVIGATION ERROR';
      }
      
      if (!errorMap.has(errorType)) {
        errorMap.set(errorType, { count: 0, examples: [] });
      }
      const errorData = errorMap.get(errorType);
      errorData.count++;
      if (errorData.examples.length < 3) {
        errorData.examples.push({ url: page.url, error: error.substring(0, 100) });
      }
    });
  });
  
  // Print Summary
  console.log('📊 SUMMARY:');
  console.log(`Total Pages: ${results.summary.total}`);
  console.log(`Passed: ${results.summary.passed} (${((results.summary.passed/results.summary.total)*100).toFixed(1)}%)`);
  console.log(`Failed: ${results.summary.failed} (${((results.summary.failed/results.summary.total)*100).toFixed(1)}%)`);
  console.log(`Total Errors: ${totalErrors}\n`);
  
  // Status Codes
  console.log('📡 STATUS CODES:');
  Array.from(statusCodes.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([code, count]) => {
      console.log(`  ${code}: ${count} pages (${((count/results.summary.total)*100).toFixed(1)}%)`);
    });
  console.log('');
  
  // Top Errors
  console.log('❌ ERROR BREAKDOWN:');
  Array.from(errorMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([type, data]) => {
      console.log(`\n${type}: ${data.count} occurrences (${((data.count/totalErrors)*100).toFixed(1)}% of errors)`);
      console.log('Examples:');
      data.examples.forEach(ex => {
        console.log(`  URL: ${ex.url}`);
        console.log(`  Error: ${ex.error}...\n`);
      });
    });
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  
  if (errorMap.has('TIMEOUT')) {
    console.log('⚠️  TIMEOUT ERRORS DETECTED!');
    console.log('   Solution: Edit auto-test-suite.js');
    console.log('   Change line ~17 from:');
    console.log('     timeout: 30000,');
    console.log('   To:');
    console.log('     timeout: 90000,\n');
  }
  
  if (errorMap.has('NETWORK ERROR')) {
    console.log('⚠️  NETWORK ERRORS DETECTED!');
    console.log('   Possible causes:');
    console.log('   - Rate limiting (too many requests)');
    console.log('   - Server blocking automated requests');
    console.log('   - Actual network connectivity issues\n');
  }
  
  const failureRate = (results.summary.failed / results.summary.total) * 100;
  if (failureRate > 50) {
    console.log('❌ CRITICAL: Over 50% failure rate!');
    console.log('   This indicates a systematic issue.');
    console.log('   Most likely: Timeout settings too low for your site.\n');
  }
  
  console.log('═══════════════════════════════════════\n');
  
} catch (error) {
  console.log('\n❌ Error:', error.message);
  console.log('\nMake sure test-results.json exists in the current directory.');
  console.log('Run your tests first: npm test\n');
}
