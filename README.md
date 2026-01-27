# Unwired Coverage Checker

A fast, embeddable address coverage checker that determines if a location falls within Unwired's service area. Users type an address, select from Google Places autocomplete suggestions, and instantly see if service is available.

**Live demo:** https://unwired-coverage.briancline.co

## Features

- **Google Places Autocomplete** - Address input with smart suggestions
- **Fast spatial queries** - Checks 3,009 coverage polygons in <10ms using RBush spatial indexing
- **Polygon hole support** - Correctly handles 150 polygons with interior exclusion zones
- **"Maybe" coverage zone** - Addresses near (within 2 miles of) coverage boundaries show "Service may be available" instead of outright rejection
- **Embeddable** - Self-contained component for integration into unwiredltd.com
- **Mobile responsive** - Clean UI that works on all screen sizes

## Tech Stack

- **Vite** - Fast development and optimized production builds
- **Turf.js** - Point-in-polygon geographic calculations
- **RBush** - High-performance spatial index for bounding box queries
- **Google Places API** - Address autocomplete and geocoding
- **Playwright** - Automated browser testing

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npx playwright test

# Build for production
npm run build
```

## Project Structure

```
unwired-coverage/
├── index.html              # Main page
├── app.js                  # Coverage check logic
├── styles.css              # Unwired-branded styles
├── public/
│   └── coverage.json       # Pre-processed polygon data (6.2MB)
├── scripts/
│   └── convert-kml.js      # KML → JSON conversion script
├── tests/
│   ├── coverage.spec.js    # General coverage tests
│   └── specific-addresses.spec.js  # SF address validation tests
├── package.json
├── vite.config.js
└── vercel.json
```

## Configuration

### "Maybe" Coverage Distance

Addresses outside coverage but within a certain distance of a coverage boundary show a "Service may be available" result instead of rejection. This is configurable in `app.js`:

```javascript
// Configuration
const MAYBE_DISTANCE_MILES = 2; // Show "maybe" if within this distance of coverage
```

Set to `0` to disable the "maybe" feature entirely.

### Google Places API Key

The API key is configured via Vercel environment variable:

```bash
# Set in Vercel dashboard or CLI
vercel env add VITE_GOOGLE_PLACES_API_KEY production
```

**Required API restrictions:**
- HTTP referrers: `https://*.unwiredltd.com/*`, `https://*.briancline.co/*`
- APIs enabled: Places API, Maps JavaScript API

### Updating Coverage Data

If you receive new coverage KML data:

```bash
# Convert KML to optimized JSON
npm run convert -- /path/to/new-coverage.kml

# The script outputs to public/coverage.json
```

## How It Works

1. **Page Load** - Coverage JSON loads and builds a spatial index from polygon bounding boxes
2. **Address Entry** - User types address, Google Places suggests completions
3. **Selection** - User selects address, we extract lat/lng from Places geometry
4. **Spatial Query** - RBush finds candidate polygons whose bounding boxes contain the point
5. **Point-in-Polygon** - Turf.js checks if point is inside each candidate polygon
6. **Near-Miss Check** - If not in coverage, calculates distance to nearest polygon boundary
7. **Result** - Display "Service available", "Service may be available" (if within 2 miles), or "Not in coverage area"

### Performance

| Metric | Value |
|--------|-------|
| Coverage data | 6.2MB (gzips to ~500KB) |
| Polygons | 3,009 total, 150 with holes |
| Index build | ~100ms on page load |
| Query time | <10ms per address |

## Embedding

The component can be embedded on unwiredltd.com:

```html
<!-- Option 1: Include built bundle -->
<div id="coverage-checker"></div>
<script src="https://unwired-coverage.briancline.co/assets/index-[hash].js"></script>

<!-- Option 2: iframe -->
<iframe
  src="https://unwired-coverage.briancline.co"
  width="100%"
  height="500"
  frameborder="0">
</iframe>
```

## Testing

```bash
# Run all tests
npx playwright test

# Run with browser visible
npx playwright test --headed

# Run specific test file
npx playwright test tests/specific-addresses.spec.js
```

### Test Coverage

- **SF in coverage**: 1 Market St, 28 W Portal Ave
- **SF near coverage (maybe)**: 153 Granville Way (within 2 miles of boundary)
- **SF out of coverage**: 1054 Taraval St
- **Outside service area**: Los Angeles addresses

Run "maybe" tests against local dev server:
```bash
npm run dev &
npx playwright test tests/maybe-coverage.spec.js
```

## Deployment

Deployed automatically to Vercel on push to `main`.

- **Production URL**: https://unwired-coverage.briancline.co
- **Vercel Dashboard**: https://vercel.com/sailorskills/unwired-coverage

## Brand Guidelines

| Element | Value |
|---------|-------|
| Primary Blue | `#0071bc` |
| Success Green | `#52CF8F` |
| Maybe Amber | `#f0ad4e` |
| Error Red | `#e74c3c` |
| Heading Font | Lexend |
| Body Font | Work Sans |
| Border Radius | 5px |

## License

Private - Unwired Ltd.
