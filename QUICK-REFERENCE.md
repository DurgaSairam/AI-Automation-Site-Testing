# 🎯 Quick Reference - Fantasy World Toys Testing

## Your URLs
- **Staging:** https://mcstaging.fantasyworldtoys.com
- **Production:** https://fantasyworldtoys.com

---

## 🚀 Quick Commands

### Test Staging (3 ways)

```bash
# Method 1: Using the staging script (easiest)
./test-staging.sh https://mcstaging.fantasyworldtoys.com

# Method 2: Using npm script
npm run test:staging

# Method 3: Using environment variable
export TEST_URL=https://mcstaging.fantasyworldtoys.com
npm test
```

### Test Production

```bash
# Method 1: Using npm script
npm run test:production

# Method 2: Using environment variable
export TEST_URL=https://fantasyworldtoys.com
npm test
```

### Compare Results

```bash
npm run compare
```

---

## 📋 First Time Setup

```bash
# 1. Clone your repo
git clone https://github.com/DurgaSairam/AI-Automation-Site-Testing.git
cd AI-Automation-Site-Testing

# 2. Install dependencies
npm install
npx playwright install chromium

# 3. Make scripts executable
chmod +x *.sh

# 4. Test staging
./test-staging.sh https://mcstaging.fantasyworldtoys.com
```

---

## 🔄 Daily Workflow

```bash
# Morning: Quick staging check
npm run test:staging

# After changes: Test staging again
npm run test:staging

# Before deploy: Test production
npm run test:production

# Compare to catch regressions
npm run compare
```

---

## 📊 Where are the reports?

After running tests, you'll find:

- `test-report.html` - Interactive dashboard (open in browser)
- `test-results.json` - Raw data
- `staging-report-*.html` - Staging-specific reports (if using staging script)
- `test-comparison-report.html` - Comparison report (after running compare)

---

## 🔔 Enable Notifications (Optional)

### Slack
```bash
export SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK"
npm run test:ci
```

### Discord
```bash
export DISCORD_WEBHOOK="https://discord.com/api/webhooks/YOUR/WEBHOOK"
npm run test:ci
```

---

## 🤖 GitHub Actions Setup

Already configured! Just:

1. Push this repo to GitHub
2. Enable Actions in repo settings
3. Tests will run automatically on push to main

The workflow is in: `.github/workflows/testing.yml`

---

## 🆘 Troubleshooting

### Tests failing?
```bash
# Check if staging is accessible
curl -I https://mcstaging.fantasyworldtoys.com

# Increase timeout for slow sites
# Edit auto-test-suite.js, line ~17: timeout: 60000
```

### Need more detailed output?
```bash
# Run directly for full logs
node auto-test-suite.js
```

### Chromium installation issues?
```bash
# Ubuntu/Debian
sudo apt-get install -y libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1

# Then reinstall
npx playwright install chromium
```

---

## 📁 Important Files

- `auto-test-suite.js` - Main testing engine
- `package.json` - Dependencies & scripts
- `test-staging.sh` - Convenient staging test script
- `README.md` - Full documentation
- `STAGING-GUIDE.md` - Detailed staging guide

---

## 💡 Pro Tips

1. **Always test staging first** before production
2. **Run compare** regularly to catch regressions
3. **Review HTML reports** - they're interactive and detailed
4. **Set up cron jobs** for automated daily testing
5. **Enable notifications** to get alerted of failures

---

## 🎓 Learning More

- Full documentation: `README.md`
- Staging workflow: `STAGING-GUIDE.md`
- Deployment integrations: `DEPLOYMENT-GUIDE.md`
- All files explained: `PROJECT-SUMMARY.md`

---

## ✅ Quick Health Check

```bash
# Test if everything is working
node -v                  # Should show Node.js version
npm -v                   # Should show npm version
npx playwright --version # Should show Playwright version

# Run a quick test
npm run test:staging
```

---

**🌟 You're all set! Start with `npm run test:staging` 🚀**
