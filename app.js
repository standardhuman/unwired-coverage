/**
 * Unwired Coverage Checker
 * Checks if an address falls within service coverage area
 */

import RBush from 'rbush';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon } from '@turf/helpers';
import distance from '@turf/distance';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import polygonToLine from '@turf/polygon-to-line';

// Configuration
const MAYBE_DISTANCE_MILES = 2; // Show "maybe" if within this distance of coverage

// DOM elements
const addressInput = document.getElementById('address-input');
const unitInput = document.getElementById('unit-input');
const checkBtn = document.getElementById('check-btn');
const form = document.getElementById('coverage-form');
const resultDiv = document.getElementById('result');
const loadingDiv = document.getElementById('loading');
const initLoadingDiv = document.getElementById('init-loading');

// State
let coverageData = null;
let spatialIndex = null;
let autocomplete = null;
let selectedPlace = null;

/**
 * Initialize the coverage checker
 */
async function init() {
  try {
    // Load coverage data
    await loadCoverageData();

    // Initialize Google Places Autocomplete
    await loadGooglePlaces();

    // Hide init loading
    initLoadingDiv.hidden = true;

    console.log('Coverage checker initialized');
  } catch (error) {
    console.error('Failed to initialize:', error);
    showError('Failed to load coverage data. Please refresh the page.');
    initLoadingDiv.hidden = true;
  }
}

/**
 * Load and index coverage polygons
 */
async function loadCoverageData() {
  const response = await fetch('/coverage.json');
  if (!response.ok) {
    throw new Error(`Failed to load coverage data: ${response.status}`);
  }

  coverageData = await response.json();
  console.log(`Loaded ${coverageData.count} coverage polygons`);

  // Build spatial index
  spatialIndex = new RBush();

  const items = coverageData.features.map(feature => ({
    minX: feature.bbox.minLng,
    minY: feature.bbox.minLat,
    maxX: feature.bbox.maxLng,
    maxY: feature.bbox.maxLat,
    id: feature.id,
  }));

  spatialIndex.load(items);
  console.log('Spatial index built');
}

/**
 * Load Google Places API and initialize autocomplete
 */
async function loadGooglePlaces() {
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    // For development, allow manual coordinate entry
    console.warn('No Google Places API key provided');
    addressInput.placeholder = 'API key required for autocomplete';
    return;
  }

  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.google?.maps?.places) {
      initAutocomplete();
      resolve();
      return;
    }

    // Load the script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=__initGooglePlaces`;
    script.async = true;
    script.defer = true;

    window.__initGooglePlaces = () => {
      delete window.__initGooglePlaces;
      initAutocomplete();
      resolve();
    };

    script.onerror = () => reject(new Error('Failed to load Google Places API'));
    document.head.appendChild(script);
  });
}

/**
 * Initialize Google Places Autocomplete on the address input
 */
function initAutocomplete() {
  autocomplete = new google.maps.places.Autocomplete(addressInput, {
    types: ['address'],
    componentRestrictions: { country: 'us' },
    fields: ['formatted_address', 'geometry', 'address_components'],
  });

  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();

    if (!place.geometry?.location) {
      selectedPlace = null;
      checkBtn.disabled = true;
      return;
    }

    selectedPlace = {
      address: place.formatted_address,
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };

    checkBtn.disabled = false;
    console.log('Selected place:', selectedPlace);
  });

  // Reset selection when user types
  addressInput.addEventListener('input', () => {
    selectedPlace = null;
    checkBtn.disabled = true;
  });
}

/**
 * Check if a point is within coverage area
 * Returns: { status: 'covered' | 'maybe' | 'not_covered', distanceMiles?: number }
 */
function checkCoverage(lng, lat) {
  const startTime = performance.now();

  // Query spatial index for candidate polygons
  const candidates = spatialIndex.search({
    minX: lng,
    minY: lat,
    maxX: lng,
    maxY: lat,
  });

  console.log(`Found ${candidates.length} candidate polygons`);

  // Create Turf point
  const pt = point([lng, lat]);

  // Check point-in-polygon for each candidate
  for (const candidate of candidates) {
    const feature = coverageData.features[candidate.id];
    const poly = polygon(feature.coordinates);

    if (booleanPointInPolygon(pt, poly)) {
      const elapsed = (performance.now() - startTime).toFixed(2);
      console.log(`Match found in polygon ${candidate.id} (${elapsed}ms)`);
      return { status: 'covered' };
    }
  }

  // Not in coverage - check if within MAYBE_DISTANCE_MILES of any polygon
  const nearestDistance = findNearestPolygonDistance(pt, lng, lat);
  const elapsed = (performance.now() - startTime).toFixed(2);

  if (nearestDistance !== null && nearestDistance <= MAYBE_DISTANCE_MILES) {
    console.log(`Maybe coverage - ${nearestDistance.toFixed(2)} miles from nearest polygon (${elapsed}ms)`);
    return { status: 'maybe', distanceMiles: nearestDistance };
  }

  console.log(`No coverage found, nearest polygon ${nearestDistance?.toFixed(2) ?? 'unknown'} miles away (${elapsed}ms)`);
  return { status: 'not_covered', distanceMiles: nearestDistance };
}

/**
 * Find distance to the nearest coverage polygon boundary
 * Uses expanded bounding box search to find nearby polygons
 */
function findNearestPolygonDistance(pt, lng, lat) {
  // Search radius in degrees (roughly MAYBE_DISTANCE_MILES * 2 to be safe)
  // 1 degree lat ≈ 69 miles, 1 degree lng varies by latitude
  const searchRadiusDeg = (MAYBE_DISTANCE_MILES * 2) / 69;

  // Query spatial index with expanded bounding box
  const nearbyCandidates = spatialIndex.search({
    minX: lng - searchRadiusDeg,
    minY: lat - searchRadiusDeg,
    maxX: lng + searchRadiusDeg,
    maxY: lat + searchRadiusDeg,
  });

  if (nearbyCandidates.length === 0) {
    return null;
  }

  let minDistance = Infinity;

  for (const candidate of nearbyCandidates) {
    const feature = coverageData.features[candidate.id];
    const poly = polygon(feature.coordinates);

    // Convert polygon to line (boundary)
    const line = polygonToLine(poly);

    // Find nearest point on the polygon boundary
    // Handle both single line and multi-line (from polygons with holes)
    const lines = line.type === 'FeatureCollection' ? line.features : [line];

    for (const lineFeature of lines) {
      const nearest = nearestPointOnLine(lineFeature, pt, { units: 'miles' });
      const dist = distance(pt, nearest, { units: 'miles' });

      if (dist < minDistance) {
        minDistance = dist;
      }
    }
  }

  return minDistance === Infinity ? null : minDistance;
}

/**
 * Display success result
 */
function showSuccess(address) {
  resultDiv.hidden = false;
  resultDiv.className = 'uwc-result uwc-result--success';
  resultDiv.innerHTML = `
    <div class="uwc-result-icon">✓</div>
    <div class="uwc-result-title">Great news! Service is available.</div>
    <div class="uwc-result-message">Unwired service is available at this address.</div>
    <a href="#" class="uwc-result-action">
      Get Started
      <span>→</span>
    </a>
  `;
}

/**
 * Display maybe result (close to coverage area)
 */
function showMaybe(address, distanceMiles) {
  resultDiv.hidden = false;
  resultDiv.className = 'uwc-result uwc-result--maybe';
  const distanceText = distanceMiles ? ` (${distanceMiles.toFixed(1)} miles from our coverage area)` : '';
  resultDiv.innerHTML = `
    <div class="uwc-result-icon">?</div>
    <div class="uwc-result-title">Service may be available</div>
    <div class="uwc-result-message">This address is very close to our coverage area${distanceText}. Contact us to check if we can serve you!</div>
    <a href="#" class="uwc-result-action">
      Contact Us
      <span>→</span>
    </a>
  `;
}

/**
 * Display not-covered result
 */
function showNotCovered(address) {
  resultDiv.hidden = false;
  resultDiv.className = 'uwc-result uwc-result--error';
  resultDiv.innerHTML = `
    <div class="uwc-result-icon">✗</div>
    <div class="uwc-result-title">Not currently in our service area</div>
    <div class="uwc-result-message">We don't have coverage at this address yet, but we're expanding!</div>
    <a href="#" class="uwc-result-action">
      Join Waitlist
      <span>→</span>
    </a>
  `;
}

/**
 * Display error message
 */
function showError(message) {
  resultDiv.hidden = false;
  resultDiv.className = 'uwc-result uwc-result--error';
  resultDiv.innerHTML = `
    <div class="uwc-result-icon">⚠</div>
    <div class="uwc-result-title">Something went wrong</div>
    <div class="uwc-result-message">${message}</div>
  `;
}

/**
 * Handle form submission
 */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!selectedPlace) {
    showError('Please select an address from the dropdown suggestions.');
    return;
  }

  // Show loading
  resultDiv.hidden = true;
  loadingDiv.hidden = false;
  checkBtn.disabled = true;

  // Small delay for UX (shows loading state)
  await new Promise(resolve => setTimeout(resolve, 300));

  try {
    const result = checkCoverage(selectedPlace.lng, selectedPlace.lat);

    if (result.status === 'covered') {
      showSuccess(selectedPlace.address);
    } else if (result.status === 'maybe') {
      showMaybe(selectedPlace.address, result.distanceMiles);
    } else {
      showNotCovered(selectedPlace.address);
    }
  } catch (error) {
    console.error('Coverage check failed:', error);
    showError('Failed to check coverage. Please try again.');
  } finally {
    loadingDiv.hidden = true;
    checkBtn.disabled = false;
  }
});

// Initialize on load
init();
