# 🚀 Deployment & Integration Guide

This guide covers various ways to integrate automated testing into your deployment workflow for **fantasyworldtoys.com**.

## 📋 Table of Contents

1. [Quick Setup](#quick-setup)
2. [Deployment Platform Integration](#deployment-platform-integration)
3. [Scheduling Options](#scheduling-options)
4. [Notification Setup](#notification-setup)
5. [Advanced Scenarios](#advanced-scenarios)

---

## ⚡ Quick Setup

### Prerequisites Check

```bash
# Check Node.js version (need 16+)
node --version

# Check npm
npm --version
```

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browsers
npx playwright install chromium

# 3. Run your first test
npm test
```

That's it! Open `test-report.html` to see results.

---

## 🌐 Deployment Platform Integration

### Option 1: GitHub Actions (Recommended for GitHub repos)

**Steps:**

1. **Copy the workflow file:**
   ```bash
   mkdir -p .github/workflows
   cp .github-workflows-testing.yml .github/workflows/testing.yml
   ```

2. **Configure secrets (optional):**
   - Go to GitHub repo → Settings → Secrets and variables → Actions
   - Add `SLACK_WEBHOOK` or `DISCORD_WEBHOOK` for notifications

3. **Trigger conditions:**
   
   The workflow runs on:
   - Push to `main` or `production` branches
   - Manual trigger via GitHub UI
   - Deployment completion

4. **View results:**
   - Go to Actions tab in your repo
   - Download artifacts to see HTML reports
   - Reports auto-publish to GitHub Pages (if configured)

**GitHub Actions YAML structure:**
```yaml
on:
  push:
    branches: [main, production]
  workflow_dispatch:  # Manual trigger
```

---

### Option 2: Webhook Integration (For any platform)

Perfect for **Vercel, Netlify, custom deployments**.

**Steps:**

1. **Start the webhook listener:**
   ```bash
   # In production/server
   npm install pm2 -g
   pm2 start webhook-listener.js --name "test-webhook"
   pm2 save
   pm2 startup
   ```

2. **Configure your deployment platform:**

   **For Vercel:**
   - Dashboard → Settings → Git → Deploy Hooks
   - Add webhook URL: `http://your-server:3000/webhook/deployment`

   **For Netlify:**
   - Site settings → Build & deploy → Deploy notifications
   - Add webhook for "Deploy succeeded"
   - URL: `http://your-server:3000/webhook/deployment`

3. **Secure your webhook (recommended):**
   ```bash
   export WEBHOOK_SECRET="your-random-secret-key"
   ```

4. **Test the webhook:**
   ```bash
   curl -X POST http://localhost:3000/webhook/deployment \
     -H "Content-Type: application/json" \
     -d '{"state":"success"}'
   ```

---

### Option 3: GitLab CI/CD

**Steps:**

1. **Create `.gitlab-ci.yml`:**
   ```yaml
   stages:
     - deploy
     - test

   deploy:
     stage: deploy
     script:
       - echo "Deploying application..."
       # Your deployment commands

   automated-test:
     stage: test
     image: node:18
     script:
       - npm install
       - npx playwright install chromium
       - npm run test:ci
     artifacts:
       paths:
         - test-report.html
         - test-results.json
       expire_in: 30 days
     only:
       - main
       - production
   ```

2. **Add environment variables (optional):**
   - Settings → CI/CD → Variables
   - Add `SLACK_WEBHOOK` or `DISCORD_WEBHOOK`

---

### Option 4: Jenkins Pipeline

**Steps:**

1. **Create `Jenkinsfile`:**
   ```groovy
   pipeline {
       agent any
       
       stages {
           stage('Deploy') {
               steps {
                   // Your deployment steps
                   echo 'Deploying application...'
               }
           }
           
           stage('Install Dependencies') {
               steps {
                   sh 'npm install'
                   sh 'npx playwright install chromium'
               }
           }
           
           stage('Run Tests') {
               steps {
                   sh 'npm run test:ci'
               }
           }
           
           stage('Publish Report') {
               steps {
                   publishHTML([
                       reportDir: './',
                       reportFiles: 'test-report.html',
                       reportName: 'Test Report',
                       keepAll: true
                   ])
                   
                   archiveArtifacts artifacts: 'test-results.json'
               }
           }
       }
       
       post {
           always {
               // Cleanup or notifications
               echo 'Tests completed'
           }
       }
   }
   ```

---

## ⏰ Scheduling Options

### Option 1: Cron Jobs (Linux/Mac)

**Interactive setup:**
```bash
chmod +x setup-cron.sh
./setup-cron.sh
```

**Manual setup:**
```bash
# Edit crontab
crontab -e

# Add one of these lines:

# Every hour
0 * * * * cd /path/to/project && node auto-test-suite.js >> cron.log 2>&1

# Every 6 hours
0 */6 * * * cd /path/to/project && node auto-test-suite.js >> cron.log 2>&1

# Daily at 2 AM
0 2 * * * cd /path/to/project && node auto-test-suite.js >> cron.log 2>&1
```

**View logs:**
```bash
tail -f cron.log
```

---

### Option 2: Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. **Trigger:** Choose schedule (daily, hourly, etc.)
4. **Action:** Start a program
5. **Program:** `node`
6. **Arguments:** `C:\path\to\auto-test-suite.js`
7. **Start in:** `C:\path\to\project`

---

### Option 3: PM2 with Cron (Node.js process manager)

```bash
# Install PM2
npm install pm2 -g

# Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'auto-test',
    script: 'auto-test-suite.js',
    cron_restart: '0 */6 * * *',  // Every 6 hours
    autorestart: false
  }]
}
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 🔔 Notification Setup

### Slack Integration

1. **Create Slack Incoming Webhook:**
   - Go to https://api.slack.com/apps
   - Create new app → Incoming Webhooks
   - Activate and add to channel
   - Copy webhook URL

2. **Set environment variable:**
   ```bash
   export SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
   ```

3. **Test:**
   ```bash
   npm run test:ci
   ```

---

### Discord Integration

1. **Create Discord Webhook:**
   - Server Settings → Integrations → Webhooks
   - Create webhook for desired channel
   - Copy webhook URL

2. **Set environment variable:**
   ```bash
   export DISCORD_WEBHOOK="https://discord.com/api/webhooks/YOUR/WEBHOOK"
   ```

---

### Email Notifications (Using Nodemailer)

Add to `ci-integration.js`:

```javascript
const nodemailer = require('nodemailer');

async function sendEmailNotification(results) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  const passRate = ((results.summary.passed / results.summary.total) * 100).toFixed(1);
  
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.NOTIFICATION_EMAIL,
    subject: `Test Report: ${passRate}% Pass Rate`,
    html: `
      <h2>Automated Test Results</h2>
      <p><strong>Website:</strong> ${results.baseUrl}</p>
      <p><strong>Total Pages:</strong> ${results.summary.total}</p>
      <p><strong>Passed:</strong> ${results.summary.passed}</p>
      <p><strong>Failed:</strong> ${results.summary.failed}</p>
      <p><strong>Pass Rate:</strong> ${passRate}%</p>
    `
  });
}
```

---

## 🔧 Advanced Scenarios

### Scenario 1: Multi-Environment Testing

Test staging before production:

```javascript
// environments.js
const environments = [
  {
    name: 'Staging',
    url: 'https://staging.fantasyworldtoys.com'
  },
  {
    name: 'Production',
    url: 'https://fantasyworldtoys.com'
  }
];

async function testAllEnvironments() {
  for (const env of environments) {
    console.log(`Testing ${env.name}...`);
    CONFIG.baseUrl = env.url;
    await runTests();
  }
}
```

---

### Scenario 2: Conditional Deployment

Only deploy if tests pass:

```yaml
# .github/workflows/deploy.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npx playwright install chromium
      - run: npm test
  
  deploy:
    needs: test  # Only runs if test succeeds
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: ./deploy.sh
```

---

### Scenario 3: Performance Budgets

Fail if performance degrades:

```javascript
// In auto-test-suite.js
const PERFORMANCE_BUDGET = {
  maxLoadTime: 3000,  // 3 seconds
  maxFailedPages: 5
};

// After tests complete
if (results.summary.failed > PERFORMANCE_BUDGET.maxFailedPages) {
  console.error('❌ Too many failures!');
  process.exit(1);
}
```

---

### Scenario 4: Parallel Testing

Test multiple pages simultaneously:

```javascript
// In auto-test-suite.js
const pLimit = require('p-limit');
const limit = pLimit(5);  // 5 concurrent tests

const testPromises = urls.map(url => 
  limit(() => testPage(browser, url))
);

results.pages = await Promise.all(testPromises);
```

---

## 🛠️ Troubleshooting

### Tests timing out?
```javascript
// Increase timeout in CONFIG
const CONFIG = {
  timeout: 60000  // 60 seconds
};
```

### Memory issues with large sites?
```javascript
// Reduce concurrent pages
const CONFIG = {
  maxPages: 50  // Lower limit
};
```

### Chromium installation fails?
```bash
# Install system dependencies (Ubuntu/Debian)
sudo apt-get install -y \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxkbcommon0 \
  libgbm1
```

---

## 📊 Monitoring & Maintenance

### Keep test history:
```bash
# Comparison script automatically backs up results
node compare-results.js
```

### Clean old reports:
```bash
# Keep last 30 days
find . -name "test-results-backup-*.json" -mtime +30 -delete
```

### Monitor disk usage:
```bash
du -sh screenshots/
```

---

## ✅ Best Practices Checklist

- [ ] Tests run automatically after deployment
- [ ] Notifications configured for failures
- [ ] Reports archived for trend analysis
- [ ] Performance budgets set
- [ ] Comparison enabled to catch regressions
- [ ] Secrets properly configured (not in code)
- [ ] Logs monitored regularly
- [ ] Documentation updated

---

## 🆘 Need Help?

1. Check the main README.md
2. Review console output for errors
3. Examine test-results.json for detailed data
4. Enable verbose logging

---

**Happy Testing! 🎉**
