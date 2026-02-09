#!/bin/bash

# Automated Testing Suite - Quick Setup Script
# This script helps you get started quickly

set -e  # Exit on error

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   🧪 Automated Testing Suite - Quick Setup               ║"
echo "║   For: https://fantasyworldtoys.com                       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    echo "Recommended version: 18.x or higher"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js detected: $NODE_VERSION"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed!"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo "✅ npm detected: $NPM_VERSION"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"
echo ""

# Install Playwright browsers
echo "🌐 Installing Playwright Chromium browser..."
npx playwright install chromium

if [ $? -ne 0 ]; then
    echo "❌ Failed to install Playwright browsers"
    exit 1
fi

echo "✅ Playwright browsers installed successfully"
echo ""

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p screenshots
echo "✅ Directories created"
echo ""

# Configuration wizard
echo "═══════════════════════════════════════════════════════════"
echo "⚙️  CONFIGURATION WIZARD"
echo "═══════════════════════════════════════════════════════════"
echo ""

read -p "Do you want to run a test now? (y/n): " RUN_TEST

if [[ $RUN_TEST =~ ^[Yy]$ ]]; then
    echo ""
    echo "🧪 Running first test..."
    echo "This may take a few minutes depending on your website size..."
    echo ""
    
    node auto-test-suite.js
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Test completed successfully!"
        echo ""
        echo "📊 View your report:"
        
        # Try to open the report in browser
        if command -v xdg-open &> /dev/null; then
            xdg-open test-report.html
        elif command -v open &> /dev/null; then
            open test-report.html
        else
            echo "   → Open test-report.html in your browser"
        fi
    else
        echo "⚠️  Test completed with errors. Check the output above."
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🎯 NEXT STEPS"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "1️⃣  Run tests manually:"
echo "   npm test"
echo ""
echo "2️⃣  Integrate with CI/CD:"
echo "   → GitHub Actions: Copy .github-workflows-testing.yml to .github/workflows/"
echo "   → GitLab: See DEPLOYMENT-GUIDE.md"
echo "   → Jenkins: See DEPLOYMENT-GUIDE.md"
echo ""
echo "3️⃣  Set up scheduled testing:"
echo "   ./setup-cron.sh"
echo ""
echo "4️⃣  Enable notifications (optional):"
echo "   export SLACK_WEBHOOK='your-webhook-url'"
echo "   export DISCORD_WEBHOOK='your-webhook-url'"
echo ""
echo "5️⃣  Compare results over time:"
echo "   node compare-results.js"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📚 DOCUMENTATION"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "→ README.md - Complete feature documentation"
echo "→ DEPLOYMENT-GUIDE.md - Integration guides for all platforms"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✨ Setup complete! Happy testing! 🎉"
echo "═══════════════════════════════════════════════════════════"
