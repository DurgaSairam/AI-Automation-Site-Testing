/**
 * CI/CD Integration Script
 * This script can be triggered after deployment to automatically run tests
 * 
 * Usage in CI/CD pipeline:
 * 1. GitHub Actions
 * 2. GitLab CI
 * 3. Jenkins
 * 4. Any webhook-triggered automation
 */

const { exec } = require('child_process');
const https = require('https');
const fs = require('fs').promises;

// Configuration
const CONFIG = {
  websiteUrl: process.env.TEST_URL || 'https://mcstaging.fantasyworldtoys.com',
  notificationWebhook: process.env.SLACK_WEBHOOK || process.env.DISCORD_WEBHOOK,
  emailNotification: process.env.EMAIL_NOTIFICATION,
  healthCheckTimeout: 30000,
  retryAttempts: 3
};

// Wait for deployment to be live
async function waitForDeployment(url, retries = CONFIG.retryAttempts) {
  console.log(`🔄 Checking if ${url} is accessible...`);
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log('✅ Website is live and accessible!\n');
        return true;
      }
    } catch (error) {
      console.log(`Attempt ${i + 1}/${retries} failed. Retrying in 10s...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  throw new Error('Website is not accessible after deployment');
}

// Run the test suite
function runTestSuite() {
  return new Promise((resolve, reject) => {
    console.log('🧪 Starting automated test suite...\n');
    
    const testProcess = exec('node auto-test-suite.js', (error, stdout, stderr) => {
      if (error) {
        console.error('Test execution error:', error);
        reject(error);
        return;
      }
      
      console.log(stdout);
      if (stderr) console.error(stderr);
      resolve(stdout);
    });
    
    testProcess.stdout.pipe(process.stdout);
    testProcess.stderr.pipe(process.stderr);
  });
}

// Send notification (Slack/Discord)
async function sendNotification(results) {
  if (!CONFIG.notificationWebhook) {
    console.log('⚠️  No notification webhook configured. Skipping notification.');
    return;
  }
  
  const passRate = ((results.summary.passed / results.summary.total) * 100).toFixed(1);
  const status = passRate > 80 ? '✅' : passRate > 50 ? '⚠️' : '❌';
  
  const message = {
    text: `${status} Automated Test Results - ${CONFIG.websiteUrl}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${status} Test Report: ${new Date().toLocaleString()}`
        }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Total Pages:*\n${results.summary.total}` },
          { type: "mrkdwn", text: `*Pass Rate:*\n${passRate}%` },
          { type: "mrkdwn", text: `*Passed:*\n${results.summary.passed}` },
          { type: "mrkdwn", text: `*Failed:*\n${results.summary.failed}` }
        ]
      }
    ]
  };
  
  try {
    await fetch(CONFIG.notificationWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    console.log('📨 Notification sent successfully!');
  } catch (error) {
    console.error('Failed to send notification:', error.message);
  }
}

// Main CI/CD execution flow
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('🚀 CI/CD POST-DEPLOYMENT TEST AUTOMATION');
  console.log('═══════════════════════════════════════\n');
  
  try {
    // Step 1: Wait for deployment to be live
    await waitForDeployment(CONFIG.websiteUrl);
    
    // Step 2: Run test suite
    await runTestSuite();
    
    // Step 3: Read results
    const resultsData = await fs.readFile('test-results.json', 'utf8');
    const results = JSON.parse(resultsData);
    
    // Step 4: Send notifications
    await sendNotification(results);
    
    // Step 5: Exit with appropriate code
    const failureRate = (results.summary.failed / results.summary.total) * 100;
    if (failureRate > 20) {
      console.log('\n❌ Too many failures detected! Marking build as unstable.');
      process.exit(1);
    } else {
      console.log('\n✅ Tests completed successfully!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ CI/CD test automation failed:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { waitForDeployment, runTestSuite, sendNotification };
