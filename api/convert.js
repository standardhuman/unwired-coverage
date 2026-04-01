import { XMLParser } from 'fast-xml-parser';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

function parseCoordinates(coordString) {
  return String(coordString)
    .trim()
    .split(/\s+/)
    .map(coord => {
      const [lng, lat] = coord.split(',').map(Number);
      return [lng, lat];
    });
}

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

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const kmlContent = req.body.kml;
    if (!kmlContent) {
      return res.status(400).json({ error: 'Missing "kml" field in request body' });
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });

    const parsed = parser.parse(kmlContent);
    const doc = parsed.kml.Document;
    const container = doc.Folder || doc;
    const placemarks = Array.isArray(container.Placemark) ? container.Placemark : [container.Placemark];

    const features = [];
    let featureId = 0;
    let polygonsWithHoles = 0;
    const warnings = [];

    for (let i = 0; i < placemarks.length; i++) {
      const placemark = placemarks[i];
      const polygons = extractPolygons(placemark);

      if (polygons.length === 0) {
        warnings.push(`Skipping placemark ${i}: no Polygon found (keys: ${Object.keys(placemark).join(', ')})`);
        continue;
      }

      for (const polygon of polygons) {
        const outerRing = parseCoordinates(polygon.outerBoundaryIs.LinearRing.coordinates);
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

        const bbox = calculateBbox(outerRing);
        const coordinates = [outerRing];
        if (innerRings.length > 0) {
          coordinates.push(...innerRings);
        }

        features.push({ id: featureId++, bbox, coordinates });
      }
    }

    const output = {
      type: 'CoverageData',
      count: features.length,
      features,
    };

    const jsonString = JSON.stringify(output);
    const sizeMB = (Buffer.byteLength(jsonString) / 1024 / 1024).toFixed(2);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="coverage.json"');
    return res.status(200).send(jsonString);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
