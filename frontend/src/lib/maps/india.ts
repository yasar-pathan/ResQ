/** Shared map framing for India-only ops/citizen views. */

export const INDIA_CENTER: [number, number] = [20.5937, 78.9629];
export const INDIA_DEFAULT_ZOOM = 5;
export const INDIA_PICKER_ZOOM = 12;
export const INDIA_FOCUS_ZOOM = 14;

/** Approximate India bounding box (WGS84). */
export const INDIA_MAX_BOUNDS: [[number, number], [number, number]] = [
  [6.0, 67.0],
  [38.0, 98.0],
];

/** Demo anchors. */
export const GUJARAT_CENTER: [number, number] = [22.2587, 71.1924];
export const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946];
export const BENGALURU_PICKER_ZOOM = 13;

/** Default picker anchor — aligned with Bit N Build '26 Gujarat Round. */
export const DEFAULT_PICKER_CENTER: [number, number] = BENGALURU_CENTER;

export function isInIndia(lat: number, lng: number): boolean {
  return lat >= INDIA_MAX_BOUNDS[0][0] && lat <= INDIA_MAX_BOUNDS[1][0] && lng >= INDIA_MAX_BOUNDS[0][1] && lng <= INDIA_MAX_BOUNDS[1][1];
}

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const INDIA_MAP_PROPS = {
  maxBounds: INDIA_MAX_BOUNDS,
  maxBoundsViscosity: 0.9,
  minZoom: 4,
} as const;
