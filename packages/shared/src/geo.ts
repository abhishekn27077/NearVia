import { GeoCoordinates, BoundingBox } from "@nearvia/types";

/**
 * Calculates the great-circle distance between two geographic points using the Haversine formula.
 * @param point1 Origin coordinates { latitude, longitude }
 * @param point2 Destination coordinates { latitude, longitude }
 * @returns Distance in kilometers
 */
export function calculateHaversineDistanceKm(
  point1: GeoCoordinates,
  point2: GeoCoordinates,
): number {
  const EARTH_RADIUS_KM = 6371;

  const dLat = degreesToRadians(point2.latitude - point1.latitude);
  const dLng = degreesToRadians(point2.longitude - point1.longitude);

  const lat1Rad = degreesToRadians(point1.latitude);
  const lat2Rad = degreesToRadians(point2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) *
      Math.sin(dLng / 2) *
      Math.cos(lat1Rad) *
      Math.cos(lat2Rad);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_KM * c * 100) / 100; // Round to 2 decimal places
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Checks if two points are within a specified radius (in km).
 */
export function isWithinRadius(
  point1: GeoCoordinates,
  point2: GeoCoordinates,
  radiusKm: number,
): boolean {
  return calculateHaversineDistanceKm(point1, point2) <= radiusKm;
}

/**
 * Checks if two points are within the default NEARVIA 5 km hyperlocal radius.
 */
export function isWithin5KmRadius(
  point1: GeoCoordinates,
  point2: GeoCoordinates,
): boolean {
  return isWithinRadius(point1, point2, 5.0);
}

/**
 * Calculates an approximate bounding box given a center point and a radius in kilometers.
 * Useful for fast index-based SQL pre-filtering before PostGIS ST_DWithin or exact distance evaluation.
 */
export function calculateBoundingBox(
  center: GeoCoordinates,
  radiusKm: number,
): BoundingBox {
  const LATITUDE_DEGREE_KM = 111.045; // 1 deg lat ≈ 111 km
  const latDelta = radiusKm / LATITUDE_DEGREE_KM;
  const lngDelta =
    radiusKm /
    (LATITUDE_DEGREE_KM * Math.cos(degreesToRadians(center.latitude)));

  return {
    minLat: center.latitude - latDelta,
    maxLat: center.latitude + latDelta,
    minLng: center.longitude - lngDelta,
    maxLng: center.longitude + lngDelta,
  };
}

/**
 * Validates if coordinates are within standard planetary bounds.
 */
export function isValidCoordinate(coord: GeoCoordinates): boolean {
  return (
    typeof coord.latitude === "number" &&
    typeof coord.longitude === "number" &&
    coord.latitude >= -90 &&
    coord.latitude <= 90 &&
    coord.longitude >= -180 &&
    coord.longitude <= 180
  );
}

/**
 * Geocoding Service Abstraction
 */
export interface IGeocodingService {
  forwardGeocode(address: string): Promise<GeoCoordinates | null>;
  reverseGeocode(coords: GeoCoordinates): Promise<string | null>;
}

export interface LocalityPreset {
  name: string;
  latitude: number;
  longitude: number;
}

export const BANGALORE_LOCALITIES: LocalityPreset[] = [
  { name: "MG Road / Brigade Road", latitude: 12.9716, longitude: 77.5946 },
  { name: "Koramangala 4th Block", latitude: 12.9352, longitude: 77.6245 },
  { name: "Indiranagar 100ft Road", latitude: 12.9784, longitude: 77.6408 },
  { name: "HSR Layout Sector 1", latitude: 12.9121, longitude: 77.6446 },
  { name: "Whitefield ITPL Main Rd", latitude: 12.9863, longitude: 77.7337 },
  { name: "Jayanagar 4th Block", latitude: 12.925, longitude: 77.5938 },
  { name: "Electronic City Phase 1", latitude: 12.8399, longitude: 77.677 },
  { name: "BTM Layout 2nd Stage", latitude: 12.9166, longitude: 77.6101 },
  { name: "Malleshwaram 8th Cross", latitude: 13.0031, longitude: 77.5643 },
  { name: "Rajajinagar 1st Block", latitude: 12.9982, longitude: 77.553 },
  { name: "Yeshwanthpur Market", latitude: 13.0238, longitude: 77.5529 },
  { name: "Hebbal Flyover Junction", latitude: 13.0358, longitude: 77.597 },
  { name: "Marathahalli Bridge", latitude: 12.9591, longitude: 77.6974 },
  { name: "Bellandur EcoSpace", latitude: 12.926, longitude: 77.6762 },
  { name: "Sarjapur Road Wipro Gate", latitude: 12.9103, longitude: 77.6853 },
  { name: "Banashankari 2nd Stage", latitude: 12.9255, longitude: 77.5468 },
];

/**
 * Standard Geocoding Service Implementation (Memory & Registry backed, extensible to OpenStreetMap Nominatim)
 */
export class StandardGeocodingService implements IGeocodingService {
  async forwardGeocode(address: string): Promise<GeoCoordinates | null> {
    if (!address || address.trim().length === 0) return null;
    const lower = address.toLowerCase();

    // Check locality dictionary match
    const match = BANGALORE_LOCALITIES.find(
      (l) =>
        lower.includes(l.name.toLowerCase()) ||
        l.name.toLowerCase().includes(lower),
    );
    if (match) {
      return { latitude: match.latitude, longitude: match.longitude };
    }

    // Default to city center if address contains Bangalore / Bengaluru
    if (lower.includes("bangalore") || lower.includes("bengaluru")) {
      return { latitude: 12.9716, longitude: 77.5946 };
    }

    return null;
  }

  async reverseGeocode(coords: GeoCoordinates): Promise<string | null> {
    if (!isValidCoordinate(coords)) return null;

    // Find closest locality within 2 km
    let closest: LocalityPreset | null = null;
    let minDistance = Infinity;

    for (const loc of BANGALORE_LOCALITIES) {
      const dist = calculateHaversineDistanceKm(coords, {
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
      if (dist < minDistance) {
        minDistance = dist;
        closest = loc;
      }
    }

    if (closest && minDistance <= 3.0) {
      return `${closest.name} (${minDistance.toFixed(1)} km)`;
    }

    return `Location at ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
  }
}

export const defaultGeocodingService = new StandardGeocodingService();

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  durationFormatted: string;
  coordinates: [number, number][]; // [lat, lng] array for Leaflet polyline
  mode: "driving" | "walking";
  source: "osrm" | "calculated";
}

/**
 * Format estimated travel duration (ETA) in minutes or hours
 */
export function formatEta(durationMinutes: number): string {
  if (durationMinutes < 1) {
    return "< 1 min";
  }
  if (durationMinutes >= 60) {
    const hours = Math.floor(durationMinutes / 60);
    const mins = Math.round(durationMinutes % 60);
    return mins > 0 ? `~${hours}h ${mins}m` : `~${hours}h`;
  }
  return `~${Math.round(durationMinutes)} mins`;
}

/**
 * Generate a safe external turn-by-turn navigation URL
 */
export function getDirectionsUrl(
  origin: GeoCoordinates,
  destination: GeoCoordinates,
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
}

/**
 * Fetch real road route geometry, distance, and travel time from OSRM with graceful offline fallback
 */
export async function fetchRoutingDirections(
  origin: GeoCoordinates,
  destination: GeoCoordinates,
  mode: "driving" | "walking" = "driving",
): Promise<RouteResult> {
  const directDistance = calculateHaversineDistanceKm(origin, destination);

  try {
    const profile = mode === "walking" ? "walking" : "driving";
    const url = `https://router.project-osrm.org/route/v1/${profile}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data: any = await response.json();
      if (data && data.code === "Ok" && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = Math.round((route.distance / 1000) * 100) / 100;
        const durationMinutes = Math.round((route.duration / 60) * 10) / 10;
        const geojsonCoords = route.geometry.coordinates;
        const coordinates: [number, number][] = geojsonCoords.map(
          ([lng, lat]: [number, number]) => [lat, lng],
        );

        return {
          distanceKm,
          durationMinutes,
          durationFormatted: formatEta(durationMinutes),
          coordinates,
          mode,
          source: "osrm",
        };
      }
    }
  } catch {
    // Graceful offline fallback
  }

  // Realistic city routing calculation (1.28x road factor, 24km/h driving or 4.5km/h walking)
  const roadDistanceKm = Math.round(directDistance * 1.28 * 100) / 100;
  const speedKmh = mode === "walking" ? 4.5 : 24.0;
  const durationMinutes = Math.round((roadDistanceKm / speedKmh) * 60);

  return {
    distanceKm: roadDistanceKm,
    durationMinutes,
    durationFormatted: formatEta(durationMinutes),
    coordinates: [
      [origin.latitude, origin.longitude],
      [destination.latitude, destination.longitude],
    ],
    mode,
    source: "calculated",
  };
}

