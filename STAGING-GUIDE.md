# 🧪 Staging Testing Quick Start Guide

## Test Your Staging Environment First!

This guide helps you test your **staging environment** before testing production.

---

## 🚀 Super Quick Start (30 seconds)

### **Method 1: Using Environment Variable (Recommended)**

```bash
# 1. Set staging URL
export TEST_URL=https://mcstaging.fantasyworldtoys.com

# 2. Run tests
npm test
```

### **Method 2: Using .env File**

```bash
# 1. Create .env file from example
cp .env.example .env

# 2. Edit .env and set your staging URL
nano .env
# or
code .env

# 3. Install dotenv package
npm install dotenv

# 4. Run tests
npm test
```

### **Method 3: Direct Edit (Quick & Simple)**

```bash
# 1. Open auto-test-suite.js
nano auto-test-suite.js

# 2. Find this line (around line 13):
#    baseUrl: process.env.TEST_URL || 'https://mcstaging.fantasyworldtoys.com',
#
# 3. Replace with your actual staging URL if different:
#    baseUrl: 'https://your-actual-staging-url.com',

# 4. Save and run
npm test
```

---

## 📋 Complete Workflow: Staging → Production

### **Step 1: Test Staging Environment**

```bash
# Test staging
export TEST_URL=https://mcstaging.fantasyworldtoys.com
npm test

# Review the report
open test-report.html  # Mac
xdg-open test-report.html  # Linux
```

### **Step 2: If Staging Passes, Test Production**

```bash
# Test production
export TEST_URL=https://fantasyworldtoys.com
npm test

# Review and compare
node compare-results.js
```

### **Step 3: Set Up Automated Testing for Both**

**Option A: Separate GitHub Actions workflows**

Create two workflow files:

**`.github/workflows/staging-tests.yml`**
```yaml
name: Staging Tests

on:
  push:
    branches: [develop, staging]

jobs:
  test-staging:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npx playwright install chromium
      - run: npm test
        env:
          TEST_URL: https://mcstaging.fantasyworldtoys.com
      - uses: actions/upload-artifact@v3
        with:
          name: staging-test-report
          path: test-report.html
```

**`.github/workflows/production-tests.yml`**
```yaml
name: Production Tests

on:
  push:
    branches: [main, production]

jobs:
  test-production:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npx playwright install chromium
      - run: npm test
        env:
          TEST_URL: https://fantasyworldtoys.com
      - uses: actions/upload-artifact@v3
        with:
          name: production-test-report
          path: test-report.html
```

**Option B: Single workflow with matrix**

```yaml
name: Multi-Environment Tests

on:
  push:
    branches: [develop, staging, main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment:
          - name: staging
            url: https://mcstaging.fantasyworldtoys.com
          - name: production
            url: https://fantasyworldtoys.com
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npx playwright install chromium
      - run: npm test
        env:
          TEST_URL: ${{ matrix.environment.url }}
      - uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.environment.name }}-test-report
          path: test-report.html
```

---

## 🔍 What URL Should You Use?

### **Common Staging URL Patterns:**

- `https://mcstaging.fantasyworldtoys.com` ← **Your staging URL**
- `https://staging.fantasyworldtoys.com`
- `https://dev.fantasyworldtoys.com`
- `https://test.fantasyworldtoys.com`
- `https://fantasyworldtoys-staging.netlify.app`
- `https://staging-fantasyworldtoys.vercel.app`
- `http://staging.internal.company.com:8080` (if internal)

**To find your staging URL:**
1. Check your hosting platform dashboard
2. Ask your DevOps team
3. Check deployment logs
4. Look in your CI/CD configuration

---

## 🎯 Testing Strategy

### **Daily Development:**
```bash
# Quick staging check
export TEST_URL=https://mcstaging.fantasyworldtoys.com
npm test
```

### **Before Production Deploy:**
```bash
# 1. Test staging thoroughly
export TEST_URL=https://mcstaging.fantasyworldtoys.com
npm test

# 2. Review report carefully
open test-report.html

# 3. If all good, deploy to production

# 4. Test production
export TEST_URL=https://fantasyworldtoys.com
npm test

# 5. Compare results
node compare-results.js
```

### **Continuous Monitoring:**
```bash
# Set up cron for staging (every 6 hours)
cat > test-staging.sh << 'EOF'
#!/bin/bash
export TEST_URL=https://mcstaging.fantasyworldtoys.com
cd /path/to/project
npm test
EOF

chmod +x test-staging.sh

# Add to crontab
# 0 */6 * * * /path/to/test-staging.sh >> /path/to/staging-tests.log 2>&1
```

---

## 💡 Pro Tips for Staging Testing

### **1. Test More Aggressively on Staging**

```javascript
// In auto-test-suite.js, for staging only:
const CONFIG = {
  baseUrl: process.env.TEST_URL || 'https://mcstaging.fantasyworldtoys.com',
  maxPages: 200,  // Test more pages on staging
  timeout: 60000,  // Longer timeout (staging might be slower)
  screenshotOnError: true,
};
```

### **2. Use Different Performance Thresholds**

```javascript
// Staging can be slower, adjust thresholds
if (pageResult.loadTime < 5000 && pageResult.errors.length === 0) {
  pageResult.status = 'good';  // More lenient for staging
}
```

### **3. Enable More Detailed Logging**

```javascript
// Add to staging tests for debugging
console.log('Testing URL:', CONFIG.baseUrl);
console.log('Page details:', pageResult);
```

### **4. Test Authentication Flows**

If your staging requires auth:
```javascript
// Add to auto-test-suite.js before navigation
await page.goto('https://mcstaging.fantasyworldtoys.com/login');
await page.fill('input[name="username"]', process.env.STAGING_USER);
await page.fill('input[name="password"]', process.env.STAGING_PASS);
await page.click('button[type="submit"]');
await page.waitForNavigation();
```

---

## 🔐 Authentication & Private Staging

### **If staging is password-protected:**

**Method 1: Basic Auth in URL**
```bash
export TEST_URL=https://username:password@mcstaging.fantasyworldtoys.com
```

**Method 2: HTTP Auth Header**
```javascript
// In auto-test-suite.js
const context = await browser.newContext({
  httpCredentials: {
    username: process.env.STAGING_USER || 'admin',
    password: process.env.STAGING_PASS || 'password'
  }
});
```

**Method 3: VPN/Firewall**
If staging is behind VPN, run tests from a machine with VPN access.

---

## 📊 Staging vs Production Reports

### **Organize Reports by Environment:**

```bash
# Staging test
export TEST_URL=https://mcstaging.fantasyworldtoys.com
npm test
mv test-report.html staging-test-report.html
mv test-results.json staging-results.json

# Production test
export TEST_URL=https://fantasyworldtoys.com
npm test
mv test-report.html production-test-report.html
mv test-results.json production-results.json

# Compare
node compare-results.js staging-results.json production-results.json
```

---

## ✅ Staging Testing Checklist

Before deploying to production:

- [ ] All staging tests pass
- [ ] No critical errors in staging report
- [ ] Performance meets thresholds
- [ ] Accessibility checks pass
- [ ] New features tested on staging
- [ ] Compare staging vs last production results
- [ ] Get team approval on staging report

---

## 🆘 Troubleshooting Staging Tests

### **Problem: Staging URL not accessible**
```bash
# Test if staging is reachable
curl -I https://mcstaging.fantasyworldtoys.com

# Check DNS
nslookup mcstaging.fantasyworldtoys.com
```

### **Problem: Tests fail on staging but not locally**
- Check if staging has different environment variables
- Verify staging database has test data
- Check if APIs are pointing to correct endpoints

### **Problem: Staging is very slow**
```javascript
// Increase timeout for staging
const CONFIG = {
  timeout: 90000  // 90 seconds for staging
};
```

---

## 🎉 You're Ready!

Start testing your staging environment now:

```bash
export TEST_URL=https://mcstaging.fantasyworldtoys.com
npm test
```

Happy Staging Testing! 🚀
