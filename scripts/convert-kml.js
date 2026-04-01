/**
 * Convert KML coverage polygons to optimized GeoJSON with bounding boxes
 *
 * Usage: node scripts/convert-kml.js [path-to-kml]
 * Default: looks for filled_full_poly.kml in Downloads
 */

import { readFileSync, writeFileSync } from 'fs';
import { XMLParser } from 'fast-xml-parser';

const inputPath = process.argv[2] || `${process.env.HOME}/Downloads/filled_full_poly.kml`;
const outputPath = './coverage.json';

console.log(`Reading KML from: ${inputPath}`);

const kmlContent = readFileSync(inputPath, 'utf-8');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

const parsed = parser.parse(kmlContent);

// Navigate to Placemarks - handle both Folder-wrapped and direct Document placemarks
const doc = parsed.kml.Document;
const container = doc.Folder || doc;
const placemarks = Array.isArray(container.Placemark) ? container.Placemark : [container.Placemark];

console.log(`Found ${placemarks.length} polygons`);

/**
 * Parse coordinate string to array of [lng, lat] pairs
 */
const PRECISION = 5; // ~1 meter accuracy

function parseCoordinates(coordString) {
  return coordString
    .trim()
    .split(/\s+/)
    .map(coord => {
      const [lng, lat] = coord.split(',').map(Number);
      return [+lng.toFixed(PRECISION), +lat.toFixed(PRECISION)];
    });
}

/**
 * Calculate bounding box for a ring of coordinates
 */
function calculateBbox(coords) {
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return {
    minLng: +minLng.toFixed(PRECISION),
    minLat: +minLat.toFixed(PRECISION),
    maxLng: +maxLng.toFixed(PRECISION),
    maxLat: +maxLat.toFixed(PRECISION),
  };
}

const features = [];
let polygonsWithHoles = 0;

/**
 * Extract Polygon elements from a placemark, handling both direct
 * Polygon and MultiGeometry wrapping.
 */
function extractPolygons(placemark) {
  if (placemark.Polygon) {
    return Array.isArray(placemark.Polygon) ? placemark.Polygon : [placemark.Polygon];
  }
  if (placemark.MultiGeometry) {
    const mg = placemark.MultiGeometry;
    if (mg.Polygon) {
      return Array.isArray(mg.Polygon) ? mg.Polygon : [mg.Polygon];
    }
  }
  return [];
}

let featureId = 0;

for (let i = 0; i < placemarks.length; i++) {
  const placemark = placemarks[i];
  const polygons = extractPolygons(placemark);

  if (polygons.length === 0) {
    console.warn(`Skipping placemark ${i}: no Polygon found (keys: ${Object.keys(placemark).join(', ')})`);
    continue;
  }

  for (const polygon of polygons) {

  // Parse outer boundary
  const outerRing = parseCoordinates(
    polygon.outerBoundaryIs.LinearRing.coordinates
  );

  // Parse inner boundaries (holes) if present
  const innerRings = [];
  if (polygon.innerBoundaryIs) {
    const innerBoundaries = Array.isArray(polygon.innerBoundaryIs)
      ? polygon.innerBoundaryIs
      : [polygon.innerBoundaryIs];

    for (const inner of innerBoundaries) {
      innerRings.push(parseCoordinates(inner.LinearRing.coordinates));
    }
    polygonsWithHoles++;
  }

  // Calculate bounding box from outer ring
  const bbox = calculateBbox(outerRing);

  // Build GeoJSON polygon (outer ring + holes)
  const coordinates = [outerRing];
  if (innerRings.length > 0) {
    coordinates.push(...innerRings);
  }

  features.push({
    id: featureId++,
    bbox,
    coordinates,
  });

  } // end for polygon in polygons
}

console.log(`Polygons with holes: ${polygonsWithHoles}`);

// Create compact output format
const output = {
  type: 'CoverageData',
  count: features.length,
  features,
};

const jsonString = JSON.stringify(output);
writeFileSync(outputPath, jsonString);

const sizeMB = (Buffer.byteLength(jsonString) / 1024 / 1024).toFixed(2);
console.log(`Output written to: ${outputPath}`);
console.log(`File size: ${sizeMB} MB`);
