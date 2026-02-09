# 🧪 Automated Testing Suite for fantasyworldtoys.com

A comprehensive automated testing solution with AI-powered analysis, designed to run after every deployment.

## 🌟 Features

- ✅ **Automatic Page Discovery** - Crawls and discovers all pages on your website
- ⚡ **Performance Testing** - Measures load times, FCP, and other metrics
- ♿ **Accessibility Checks** - Validates basic accessibility requirements
- 🤖 **AI Analysis** - Optional AI-powered insights using Claude API
- 📊 **Beautiful HTML Reports** - Interactive dashboard with filtering and sorting
- 🔔 **Notifications** - Slack/Discord integration for test results
- 🚀 **CI/CD Ready** - GitHub Actions, GitLab CI, Jenkins compatible

## 📋 Prerequisites

- Node.js 16 or higher
- npm or yarn

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
npx playwright install chromium
```

### 2. Run Tests Manually

```bash
# Basic test run
npm test

# Or directly
node auto-test-suite.js
```

### 3. View Results

After tests complete, open `test-report.html` in your browser to see the interactive dashboard.

## 🔧 Configuration

Edit the `CONFIG` object in `auto-test-suite.js`:

```javascript
const CONFIG = {
  baseUrl: 'https://fantasyworldtoys.com',
  maxPages: 100,              // Maximum pages to test
  timeout: 30000,             // Page load timeout (ms)
  screenshotOnError: true,    // Capture screenshots on failures
  viewport: {
    desktop: { width: 1920, height: 1080 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 375, height: 667 }
  }
};
```

## 🤖 AI-Powered Analysis (Optional)

To enable AI analysis with Claude API:

1. The script uses Claude API without requiring an API key (handled automatically)
2. Uncomment this line in `auto-test-suite.js`:

```javascript
// Line ~265
pageResult.aiAnalysis = await analyzeWithAI(pageResult);
```

3. AI will provide:
   - Health score (0-100)
   - Critical issues identification
   - Actionable recommendations

## 🔄 CI/CD Integration

### GitHub Actions

1. Copy `.github-workflows-testing.yml` to `.github/workflows/testing.yml`
2. Configure secrets in your repository:
   - `SLACK_WEBHOOK` (optional)
   - `DISCORD_WEBHOOK` (optional)

3. The workflow will automatically:
   - Run tests after deployment
   - Generate reports
   - Post results as PR comments
   - Upload artifacts

### Manual CI/CD Trigger

```bash
# Run CI integration script
npm run test:ci

# Or with environment variables
SLACK_WEBHOOK="https://hooks.slack.com/..." node ci-integration.js
```

### GitLab CI

Create `.gitlab-ci.yml`:

```yaml
test:
  stage: test
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

### Jenkins

```groovy
pipeline {
    agent any
    stages {
        stage('Setup') {
            steps {
                sh 'npm install'
                sh 'npx playwright install chromium'
            }
        }
        stage('Test') {
            steps {
                sh 'npm run test:ci'
            }
        }
        stage('Publish Report') {
            steps {
                publishHTML([
                    reportDir: './',
                    reportFiles: 'test-report.html',
                    reportName: 'Test Report'
                ])
            }
        }
    }
}
```

## 📊 Understanding the Report

### Status Indicators

- **🟢 Good** - Page loads < 3s, no errors, status 2xx
- **🟡 Warning** - Page loads 3-5s OR has minor issues
- **🔴 Bad** - Page loads > 5s OR errors OR status 4xx/5xx

### Metrics Explained

| Metric | Description | Good | Warning | Bad |
|--------|-------------|------|---------|-----|
| Load Time | Total page load time | < 2s | 2-4s | > 4s |
| Status Code | HTTP response code | 2xx | 3xx | 4xx/5xx |
| FCP | First Contentful Paint | < 1.8s | 1.8-3s | > 3s |
| Accessibility | Has H1, title, meta | All ✅ | Some ❌ | Many ❌ |

## 🔔 Notifications

### Slack Integration

```bash
export SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
npm run test:ci
```

### Discord Integration

```bash
export DISCORD_WEBHOOK="https://discord.com/api/webhooks/YOUR/WEBHOOK/URL"
npm run test:ci
```

## 📁 Output Files

- `test-report.html` - Interactive HTML dashboard
- `test-results.json` - Raw test data in JSON format
- `screenshots/` - Error screenshots (if enabled)

## 🎯 Best Practices

1. **Run After Each Deployment** - Integrate with your CI/CD pipeline
2. **Monitor Trends** - Compare reports over time to spot regressions
3. **Set Thresholds** - Configure failure thresholds in `ci-integration.js`
4. **Review Failed Tests** - Investigate failures before releasing
5. **Update Baseline** - Adjust CONFIG as your site grows

## 🐛 Troubleshooting

### Tests timing out?
- Increase `CONFIG.timeout` value
- Check if website requires authentication
- Verify website is accessible

### Too many pages discovered?
- Reduce `CONFIG.maxPages`
- Add URL filters in crawling logic

### Screenshots not saving?
- Ensure `screenshots/` directory exists
- Check file permissions

### AI analysis not working?
- Claude API is called without requiring API key setup
- Check your internet connection
- Network issues may cause AI analysis to be skipped

## 🔒 Free Tools Used

1. **Playwright** - Browser automation (Free, Open Source)
2. **Node.js** - Runtime environment (Free)
3. **Claude API** - AI analysis (Free tier available via Claude.ai)
4. **GitHub Actions** - CI/CD (Free for public repos)

## 📈 Extending the Suite

### Add Custom Tests

Edit `testPage()` function in `auto-test-suite.js`:

```javascript
// Add custom check
const customCheck = await page.evaluate(() => {
  return {
    hasSearchBar: !!document.querySelector('[type="search"]'),
    hasFooter: !!document.querySelector('footer')
  };
});
pageResult.customChecks = customCheck;
```

### Add More Devices

```javascript
viewport: {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
  smallMobile: { width: 320, height: 568 }  // Add this
}
```

### Test Multiple Environments

```javascript
const environments = [
  'https://staging.fantasyworldtoys.com',
  'https://fantasyworldtoys.com'
];

for (const env of environments) {
  CONFIG.baseUrl = env;
  await runTests();
}
```

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the console output for detailed errors
3. Examine `test-results.json` for raw data

## 📄 License

MIT License - Free to use and modify

---

**Made with ❤️ for automated quality assurance**
