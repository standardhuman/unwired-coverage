/**
 * Unwired Coverage Checker
 * Checks if an address falls within service coverage area
 */

import RBush from 'rbush';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon } from '@turf/helpers';

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
  const apiKey = window.GOOGLE_PLACES_API_KEY;

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
      return true;
    }
  }

  const elapsed = (performance.now() - startTime).toFixed(2);
  console.log(`No coverage found (${elapsed}ms)`);
  return false;
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
    const inCoverage = checkCoverage(selectedPlace.lng, selectedPlace.lat);

    if (inCoverage) {
      showSuccess(selectedPlace.address);
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
