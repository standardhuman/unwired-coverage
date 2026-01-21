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

// Navigate to Placemarks
const folder = parsed.kml.Document.Folder;
const placemarks = Array.isArray(folder.Placemark) ? folder.Placemark : [folder.Placemark];

console.log(`Found ${placemarks.length} polygons`);

/**
 * Parse coordinate string to array of [lng, lat] pairs
 */
function parseCoordinates(coordString) {
  return coordString
    .trim()
    .split(/\s+/)
    .map(coord => {
      const [lng, lat] = coord.split(',').map(Number);
      return [lng, lat];
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

  return { minLng, minLat, maxLng, maxLat };
}

const features = [];
let polygonsWithHoles = 0;

for (let i = 0; i < placemarks.length; i++) {
  const placemark = placemarks[i];
  const polygon = placemark.Polygon;

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
    id: i,
    bbox,
    coordinates,
  });
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
