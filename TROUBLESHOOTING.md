# 🆘 Troubleshooting Guide: High Failure Rate

## Your Situation
- **680 pages tested**
- **0 passed** (0%)
- **159 warnings** (23%)
- **521 failed** (77%)
- **Load times: 5-12 seconds**
- **Every page has 1-2 errors**

This indicates a **systematic issue**, not individual page problems.

---

## 🔍 Step 1: Run Error Analysis (Most Important!)

```bash
# After your test completes, run this:
npm run analyze

# This will show you:
# - Exact error messages
# - Error frequency
# - Common patterns
# - Root cause identification
```

**This is the FIRST thing you should do!**

---

## 🎯 Most Likely Causes

### Cause 1: Timeout Issues (Very Common)

**Symptoms:**
- High load times (5-12s)
- All pages failing
- Error messages contain "timeout" or "exceeded"

**Solution:**
```bash
# Edit auto-test-suite.js
# Find line ~17 and change:

timeout: 30000,  # Change this from 30000 to 60000 or 90000
```

**Why?** Your production site takes 5-12 seconds to load, but the default timeout is only 30 seconds for the full page including all resources. Increase it to 60-90 seconds.

---

### Cause 2: Rate Limiting / Bot Protection

**Symptoms:**
- First few pages work, then all fail
- 403 Forbidden errors
- CloudFlare or similar challenges

**Solution:**
```javascript
// In auto-test-suite.js, add delays between pages

// Around line 395, in runTests() function, add:
await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

// Before this line:
const pageResult = await testPage(browser, url);
```

---

### Cause 3: Resource Loading Failures

**Symptoms:**
- JavaScript errors
- "Failed to load resource" messages
- Missing CSS/JS files

**Check:**
```bash
# Run diagnostics
./diagnose-prod.sh

# Look for:
# - 404 errors on JS/CSS files
# - CDN issues
# - Missing dependencies
```

---

### Cause 4: Server Performance Issues

**Symptoms:**
- Very slow load times (>5s consistently)
- 5xx status codes
- Random timeouts

**Solution:**
- Check server resources (CPU, memory)
- Contact hosting provider
- Test during different times of day
- Consider testing with fewer concurrent pages

---

## 🚀 Immediate Actions to Take

### Action 1: Increase Timeout (Do This First!)

```bash
# Edit auto-test-suite.js
nano auto-test-suite.js

# Find this section (around line 13-17):
const CONFIG = {
  baseUrl: process.env.TEST_URL || 'https://mcstaging.fantasyworldtoys.com',
  maxPages: 100,
  timeout: 30000,  # ← CHANGE THIS TO 90000
  screenshotOnError: true,
  ...
};

# Save and re-run test:
npm test
```

### Action 2: Test Fewer Pages First

```bash
# Edit auto-test-suite.js
# Change maxPages from 100 to 10 for testing:

maxPages: 10,  # Test only 10 pages first

# This helps identify if it's a rate limiting issue
```

### Action 3: Add Delays Between Requests

```bash
# In auto-test-suite.js, find the runTests() function (around line 380)
# Add a delay after each page test:

for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`[${i + 1}/${urls.length}] Testing: ${url}`);
    
    const pageResult = await testPage(browser, url);
    results.pages.push(pageResult);
    
    // ADD THIS LINE:
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    
    console.log(`  ➜ Status: ${pageResult.status.toUpperCase()} | Load: ${pageResult.loadTime}ms | Errors: ${pageResult.errors.length}\n`);
}
```

### Action 4: Test Single Page Manually

```bash
# Create a test file to debug one page:
cat > test-single-page.js << 'EOF'
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Navigating to page...');
  
  try {
    const response = await page.goto('https://fantasyworldtoys.com', {
      waitUntil: 'networkidle',
      timeout: 90000
    });
    
    console.log('Status:', response.status());
    console.log('Success!');
    
    // Wait to see the page
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  await browser.close();
})();
EOF

node test-single-page.js
```

---

## 📊 Understanding Error Messages

### "Navigation timeout of 30000 ms exceeded"
**Meaning:** Page took longer than 30s to load  
**Fix:** Increase timeout to 60000 or 90000

### "net::ERR_ABORTED"
**Meaning:** Request was cancelled or blocked  
**Fix:** Could be rate limiting, add delays

### "net::ERR_CONNECTION_REFUSED"
**Meaning:** Server refused connection  
**Fix:** Check if server is up, firewall rules

### "net::ERR_NAME_NOT_RESOLVED"
**Meaning:** DNS lookup failed  
**Fix:** Check domain configuration

---

## 🔧 Configuration for Slow Sites

If your site is genuinely slow (which seems to be the case with 5-12s load times):

```javascript
// Recommended CONFIG for slow production sites:
const CONFIG = {
  baseUrl: process.env.TEST_URL || 'https://fantasyworldtoys.com',
  maxPages: 50,          // Fewer pages initially
  timeout: 90000,        // 90 seconds
  screenshotOnError: true,
  viewport: {
    desktop: { width: 1920, height: 1080 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 375, height: 667 }
  }
};

// Also change in testPage function (around line 310):
const response = await page.goto(url, { 
  waitUntil: 'domcontentloaded',  // Changed from 'networkidle'
  timeout: CONFIG.timeout 
});
```

**Why `domcontentloaded`?**
- Faster than waiting for all network activity
- More forgiving for slow-loading resources
- Better for sites with many third-party scripts

---

## 🎯 Systematic Debugging Process

### Step 1: Diagnose
```bash
./diagnose-prod.sh
```

### Step 2: Analyze Errors
```bash
npm run analyze
```

### Step 3: Adjust Configuration
Based on error analysis, adjust:
- Timeout (most common)
- Wait strategy (networkidle vs domcontentloaded)
- Request delays
- Max pages

### Step 4: Test Again
```bash
npm test
```

### Step 5: Review Results
```bash
npm run analyze
```

---

## 📋 Checklist: Before Asking for Help

Before reaching out for support, ensure you've:

- [ ] Run `npm run analyze` to see actual error messages
- [ ] Increased timeout to 60000 or 90000
- [ ] Tested with maxPages: 10 to isolate the issue
- [ ] Run `./diagnose-prod.sh` to check server health
- [ ] Tested a single page manually
- [ ] Checked server status/logs
- [ ] Tried both 'networkidle' and 'domcontentloaded'
- [ ] Added delays between requests (if rate limiting suspected)

---

## 🆘 Next Steps

1. **Right now:**
   ```bash
   # Run error analysis on your existing results
   npm run analyze
   
   # This will tell you the EXACT errors
   ```

2. **Then:**
   - Increase timeout based on your load times
   - Re-run tests
   - Review if errors decrease

3. **If still failing:**
   - Share the output of `npm run analyze`
   - Share a few example error messages
   - Check if staging has similar issues

---

## 💡 Pro Tip

```bash
# Test staging vs production to compare:

# Test staging (should work better)
npm run test:staging
npm run analyze

# Test production
npm run test:production  
npm run analyze

# This tells you if the issue is environment-specific
```

---

## 🔍 Example: What Good Results Look Like

```
Total Pages: 680
Passed: 612 (90%)
Warnings: 48 (7%)
Failed: 20 (3%)
```

**Your goal:** Get failure rate below 10%

---

**The most important thing right now:** Run `npm run analyze` on your existing test results to see the actual error messages!
