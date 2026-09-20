/** Shared map framing for India-only ops/citizen views. */

export const INDIA_CENTER: [number, number] = [20.5937, 78.9629];
export const INDIA_DEFAULT_ZOOM = 5;
export const INDIA_PICKER_ZOOM = 12;
export const INDIA_FOCUS_ZOOM = 14;

/** Approximate India bounding box (WGS84). */
export const INDIA_MAX_BOUNDS: [[number, number], [number, number]] = [
  [6.5, 68.0],
  [35.7, 97.5],
];

/** Demo / default picker anchor — Bengaluru. */
export const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946];
export const BENGALURU_PICKER_ZOOM = 13;

export function isInIndia(lat: number, lng: number): boolean {
  return lat >= INDIA_MAX_BOUNDS[0][0] && lat <= INDIA_MAX_BOUNDS[1][0] && lng >= INDIA_MAX_BOUNDS[0][1] && lng <= INDIA_MAX_BOUNDS[1][1];
}

export const INDIA_MAP_PROPS = {
  maxBounds: INDIA_MAX_BOUNDS,
  maxBoundsViscosity: 1.0,
  minZoom: 4,
} as const;
