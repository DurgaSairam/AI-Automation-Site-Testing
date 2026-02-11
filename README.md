# FWT Test Suite v4 — Full Site Testing

## Quick Start

```bash
# 1. Install dependencies
npm install
npx playwright install chromium

# 2. Run full test suite on staging
npm test

# 3. Run on production
npm run test:prod

# 4. Quick smoke test (10 key tests only — runs in ~5 mins)
npm run test:smoke

# 5. Open last report in browser
npm run report
```

## What Gets Tested (50 scenarios)

| Group | Tests |
|-------|-------|
| **Core** | Homepage elements, Navigation, Breadcrumbs, Footer, Hero banner |
| **Categories** | Boys World, Girls World, Early Years, LEGO, Outdoor, Baby & Toddler, Arts & Crafts, Educational, Sale, New Arrivals |
| **Products** | Detail page, Image gallery, Colour/size swatches |
| **Search** | Results returned, No-results handling |
| **Shopping** | Add to cart, Cart page, Mini-cart, Remove item, Update quantity |
| **Account** | Login page, Login validation, Registration, Forgot password, Wishlist, Compare |
| **Checkout** | Full checkout flow, Address form fields |
| **Language** | Language switcher, Arabic RTL layout |
| **Static Pages** | Contact, About, Delivery, Returns, FAQ, Privacy, Terms |
| **SEO** | Homepage meta tags, Product structured data |
| **Regression** | Mobile (375px), Tablet (768px), 404 page, Page speed |

## Reports

Reports saved to `reports/` folder:
- `reports/latest.html` — always the most recent
- `reports/report-[timestamp].html` — archived reports

## Key Fixes in v4

- ✅ Search bar: tries 11 different selectors (custom Magento theme support)
- ✅ Navigation: tries all nav patterns (Luma + Porto + custom themes)
- ✅ Category products: 10-second progressive wait for AJAX loading
- ✅ Add to cart: auto-selects swatches/options on configurable products
- ✅ Cart & Checkout: adds product first, THEN tests cart/checkout buttons
- ✅ All failed tests show exact WHY with actionable error messages
