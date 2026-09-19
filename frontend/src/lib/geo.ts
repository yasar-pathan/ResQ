export type GeoResult =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: "unsupported" | "denied" | "unavailable" | "timeout" };

export function getCurrentPosition(timeoutMs = 10000): Promise<GeoResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ ok: false, reason: "unsupported" });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          ok: true,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          resolve({ ok: false, reason: "denied" });
        } else if (err.code === err.TIMEOUT) {
          resolve({ ok: false, reason: "timeout" });
        } else {
          resolve({ ok: false, reason: "unavailable" });
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}
