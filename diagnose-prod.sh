#!/bin/bash

# Production Diagnostics Script
# Helps identify why tests are failing in production

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   🔍 Production Environment Diagnostics                  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

PROD_URL="https://fantasyworldtoys.com"
STAGING_URL="https://mcstaging.fantasyworldtoys.com"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  BASIC CONNECTIVITY TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test production domain
echo "Testing production: $PROD_URL"
if curl -sI --max-time 10 "$PROD_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Production is reachable"
    PROD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$PROD_URL")
    echo "  Status Code: $PROD_STATUS"
    PROD_TIME=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 "$PROD_URL")
    echo "  Response Time: ${PROD_TIME}s"
else
    echo -e "${RED}✗${NC} Production is NOT reachable"
fi
echo ""

# Test staging domain
echo "Testing staging: $STAGING_URL"
if curl -sI --max-time 10 "$STAGING_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Staging is reachable"
    STAGING_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$STAGING_URL")
    echo "  Status Code: $STAGING_STATUS"
    STAGING_TIME=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 "$STAGING_URL")
    echo "  Response Time: ${STAGING_TIME}s"
else
    echo -e "${RED}✗${NC} Staging is NOT reachable"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  DNS RESOLUTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Production DNS:"
nslookup fantasyworldtoys.com | grep -A2 "Name:" || echo "DNS lookup failed"
echo ""

echo "Staging DNS:"
nslookup mcstaging.fantasyworldtoys.com | grep -A2 "Name:" || echo "DNS lookup failed"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  SSL CERTIFICATE CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Production SSL:"
openssl s_client -connect fantasyworldtoys.com:443 -servername fantasyworldtoys.com </dev/null 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "SSL check failed"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  SAMPLE PAGE TESTS (First 5 Common Pages)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PAGES=(
    "/"
    "/about"
    "/contact"
    "/products"
    "/brands"
)

for page in "${PAGES[@]}"; do
    URL="${PROD_URL}${page}"
    echo "Testing: $URL"
    
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL" 2>/dev/null)
    TIME=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 "$URL" 2>/dev/null)
    SIZE=$(curl -s -o /dev/null -w "%{size_download}" --max-time 10 "$URL" 2>/dev/null)
    
    if [ "$STATUS" = "200" ]; then
        echo -e "  ${GREEN}✓${NC} Status: $STATUS | Time: ${TIME}s | Size: ${SIZE} bytes"
    elif [ "$STATUS" = "000" ]; then
        echo -e "  ${RED}✗${NC} Failed to connect (timeout or network error)"
    else
        echo -e "  ${YELLOW}⚠${NC} Status: $STATUS | Time: ${TIME}s"
    fi
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  SERVER HEADERS ANALYSIS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Production headers:"
curl -sI --max-time 10 "$PROD_URL" | head -20
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  ROBOTS.TXT & SITEMAP CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ROBOTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${PROD_URL}/robots.txt")
echo "robots.txt: HTTP $ROBOTS_STATUS"

SITEMAP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${PROD_URL}/sitemap.xml")
echo "sitemap.xml: HTTP $SITEMAP_STATUS"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7️⃣  COMMON ISSUES DETECTED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check for common issues
ISSUES_FOUND=0

if [ -z "$PROD_TIME" ] || (( $(echo "$PROD_TIME > 5" | bc -l 2>/dev/null || echo 0) )); then
    echo -e "${YELLOW}⚠${NC} Slow server response time (>5s)"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ "$PROD_STATUS" != "200" ] && [ -n "$PROD_STATUS" ]; then
    echo -e "${RED}✗${NC} Production not returning 200 OK"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if ! curl -sI --max-time 10 "$PROD_URL" | grep -q "text/html"; then
    echo -e "${YELLOW}⚠${NC} Response may not be HTML"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓${NC} No obvious issues detected from basic tests"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 RECOMMENDATIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Based on your test results showing 521 failures:"
echo ""
echo "1. Run detailed error analysis:"
echo "   npm run analyze"
echo ""
echo "2. Check if it's a timeout issue:"
echo "   - If pages are slow, increase timeout in auto-test-suite.js"
echo "   - Edit line ~17: timeout: 60000 (for 60 seconds)"
echo ""
echo "3. Test a single page manually:"
echo "   node -e 'require(\"playwright\").chromium.launch().then(async b => {"
echo "     const p = await b.newPage();"
echo "     await p.goto(\"$PROD_URL\");"
echo "     console.log(await p.title());"
echo "     await b.close();"
echo "   })'"
echo ""
echo "4. Compare staging vs production:"
echo "   - Test staging first to see if issues are environment-specific"
echo "   - Run: npm run test:staging"
echo ""
echo "5. Check server logs:"
echo "   - High failure rate suggests server-side issues"
echo "   - Contact hosting provider if needed"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
